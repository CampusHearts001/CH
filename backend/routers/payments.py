"""CampusMatch UPI orders and bank-confirmed manual membership approval.

Only a trusted admin may approve after checking the bank statement.
Never trust a submitted UTR, checkout redirect, or gateway's manual paid flag.
"""

from __future__ import annotations

import os
import asyncio
from urllib.parse import urlparse
from datetime import datetime, timezone
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from supabase import Client

import config
from auth import get_current_user_id
from database import get_db

router = APIRouter(prefix="/payments", tags=["payments"])


def _subscription(db: Client, user_id: str) -> dict | None:
    result = (
        db.table("subscriptions").select("*").eq("user_id", user_id).limit(1).execute()
    )
    return result.data[0] if result.data else None


def _active(row: dict | None) -> bool:
    if not row or row.get("status") != "active" or not row.get("current_period_end"):
        return False
    try:
        end = datetime.fromisoformat(row["current_period_end"].replace("Z", "+00:00"))
        return end.tzinfo is not None and end > datetime.now(timezone.utc)
    except (TypeError, ValueError, AttributeError):
        return False


def _require_admin(user_id: str) -> None:
    admin_id = os.environ.get("PAYMENT_ADMIN_USER_ID", "").strip()
    if not admin_id or user_id != admin_id:
        raise HTTPException(status_code=403, detail="Admin access required")


def _gateway_headers() -> dict[str, str]:
    if not config.UPI_GATEWAY_API_KEY or not config.UPI_GATEWAY_API_SECRET:
        raise HTTPException(503, "UPI gateway credentials are not configured")
    return {
        "X-Api-Key": config.UPI_GATEWAY_API_KEY,
        "X-Api-Secret": config.UPI_GATEWAY_API_SECRET,
        "Accept": "application/json",
    }


def _safe_checkout_url(value: object) -> str:
    base = urlparse(config.UPI_GATEWAY_BASE_URL)
    if not isinstance(value, str):
        raise HTTPException(502, "Gateway did not provide a checkout URL")
    parsed = urlparse(value)
    if (parsed.scheme, parsed.netloc) != (
        "https",
        base.netloc,
    ) or not parsed.path.startswith("/pay/"):
        raise HTTPException(502, "Unexpected gateway checkout URL")
    return value


async def _fetch_order(order_id: str) -> dict:
    # Never accept an arbitrary order ID from the client: caller must read it from their own subscription.
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
            response = await client.get(
                f"{config.UPI_GATEWAY_BASE_URL}/api/v1/orders/{order_id}",
                headers=_gateway_headers(),
            )
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, "Could not retrieve payment order") from exc
    data = payload.get("data") if isinstance(payload, dict) else None
    if (
        payload.get("success") is not True
        or not isinstance(data, dict)
        or data.get("order_id") != order_id
    ):
        raise HTTPException(502, "Invalid gateway order response")
    if str(data.get("currency", "INR")) != "INR" or str(data.get("amount")) not in (
        "129",
        "129.0",
        "129.00",
    ):
        raise HTTPException(502, "Gateway order amount or currency mismatch")
    return data


class ApprovePayment(BaseModel):
    user_id: str = Field(min_length=36, max_length=36)
    gateway_order_id: str = Field(min_length=1, max_length=200)
    bank_transaction_ref: str = Field(min_length=6, max_length=200)
    bank_payment_confirmed: bool


@router.get("/status")
def payment_status(
    user_id: str = Depends(get_current_user_id), db: Client = Depends(get_db)
):
    row = _subscription(db, user_id)
    active = _active(row)
    return {
        "active": active,
        "status": (
            "active"
            if active
            else (row.get("status", "inactive") if row else "inactive")
        ),
        "current_period_end": row.get("current_period_end") if row else None,
        "cancel_at_period_end": (
            row.get("cancel_at_period_end", False) if row else False
        ),
    }


@router.post("/order/create")
async def create_order(
    user_id: str = Depends(get_current_user_id), db: Client = Depends(get_db)
):
    _gateway_headers()
    profile = db.table("profiles").select("id").eq("id", user_id).limit(1).execute()
    if not profile.data:
        raise HTTPException(status_code=403, detail="Complete your profile first")

    row = _subscription(db, user_id)
    if _active(row):
        raise HTTPException(
            status_code=409, detail="You already have an active membership"
        )
    if row and row.get("status") == "pending" and row.get("gateway_order_id"):
        order = await _fetch_order(row["gateway_order_id"])
        # Even if the gateway says paid, manual UTR is NOT bank verification.
        if order.get("status") != "pending":
            raise HTTPException(
                409, "Existing order needs administrator review. Do not pay again."
            )
        return {
            "order_id": row["gateway_order_id"],
            "payment_url": _safe_checkout_url(order.get("payment_url")),
            "amount": 129,
            "currency": "INR",
            "status": "pending",
            "reused": True,
        }

    client_order_id = f"cm_{uuid4().hex}"
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
            response = await client.post(
                f"{config.UPI_GATEWAY_BASE_URL}/api/v1/orders",
                headers={**_gateway_headers(), "Content-Type": "application/json"},
                json={
                    "amount": config.SUBSCRIPTION_AMOUNT_PAISE / 100,
                    "client_order_id": client_order_id,
                },
            )
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(
            status_code=502, detail="Could not create payment order"
        ) from exc

    order = payload.get("data") if isinstance(payload, dict) else None
    if (
        not isinstance(payload, dict)
        or payload.get("success") is not True
        or not isinstance(order, dict)
    ):
        raise HTTPException(status_code=502, detail="Gateway rejected the order")
    order_id, payment_url = order.get("order_id"), order.get("payment_url")
    if (
        not isinstance(order_id, str)
        or not order_id
        or not isinstance(payment_url, str)
        or not payment_url.startswith(config.UPI_GATEWAY_BASE_URL + "/")
    ):
        raise HTTPException(
            status_code=502, detail="Gateway returned invalid checkout details"
        )

    payment_url = _safe_checkout_url(payment_url)
    pending = {
        "user_id": user_id,
        "status": "pending",
        "gateway_order_id": order_id,
        "cancel_at_period_end": False,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    # Do not erase an unexpired paid membership. Existing expired rows can be reused.
    if row:
        db.table("subscriptions").update(pending).eq("user_id", user_id).execute()
    else:
        db.table("subscriptions").insert(pending).execute()
    return {
        "order_id": order_id,
        "payment_url": payment_url,
        "amount": config.SUBSCRIPTION_AMOUNT_PAISE / 100,
        "currency": config.SUBSCRIPTION_CURRENCY,
        "status": "pending",
    }


@router.get("/admin/pending")
async def list_pending(
    user_id: str = Depends(get_current_user_id),
    db: Client = Depends(get_db),
):
    _require_admin(user_id)

    result = (
        db.table("subscriptions")
        .select("user_id,gateway_order_id,updated_at,status")
        .eq("status", "pending")
        .order("updated_at", desc=True)
        .limit(100)
        .execute()
    )

    orders = [row for row in (result.data or []) if row.get("gateway_order_id")]
    if not orders:
        return {"orders": []}

    student_ids = list({order["user_id"] for order in orders})
    profiles_result = (
        db.table("profiles")
        .select("id,name,college,avatar_url")
        .in_("id", student_ids)
        .execute()
    )
    profiles = {profile["id"]: profile for profile in (profiles_result.data or [])}

    # Limit simultaneous gateway requests to avoid overwhelming the gateway.
    semaphore = asyncio.Semaphore(5)

    async def enrich_order(order: dict) -> dict:
        profile = profiles.get(order["user_id"], {})
        order["student_name"] = profile.get("name")
        order["college"] = profile.get("college")
        order["avatar_url"] = profile.get("avatar_url")

        # None means unavailable or not submitted; gateway_lookup_error distinguishes them.
        order["submitted_utr"] = None
        order["gateway_status"] = None
        order["gateway_lookup_error"] = False

        try:
            async with semaphore:
                gateway_order = await _fetch_order(order["gateway_order_id"])
            order["gateway_status"] = gateway_order.get("status")
            # Only a review-status UTR is an unverified student submission.
            if gateway_order.get("status") == "review":
                order["submitted_utr"] = gateway_order.get("submitted_utr")
        except (HTTPException, httpx.HTTPError, ValueError):
            # Do not lose a pending order just because the gateway is unavailable.
            order["gateway_lookup_error"] = True

        return order

    return {"orders": await asyncio.gather(*(enrich_order(order) for order in orders))}


@router.post("/admin/approve")
def approve_payment(
    payload: ApprovePayment,
    user_id: str = Depends(get_current_user_id),
    db: Client = Depends(get_db),
):
    _require_admin(user_id)
    if payload.bank_payment_confirmed is not True:
        raise HTTPException(
            status_code=400,
            detail="Verify the exact ₹129 bank credit and transaction reference before approval",
        )
    # The database RPC performs the insert + subscription activation atomically.
    # It is restricted to service_role; never expose the service-role key in the browser.
    try:
        result = db.rpc(
            "approve_campusmatch_payment",
            {
                "p_user_id": payload.user_id,
                "p_gateway_order_id": payload.gateway_order_id,
                "p_bank_transaction_ref": payload.bank_transaction_ref.strip(),
                "p_reviewed_by": user_id,
            },
        ).execute()

    except Exception as exc:
        # Avoid leaking database internals or transaction identifiers to the client.
        raise HTTPException(
            status_code=409,
            detail="Approval failed: check the order, bank reference, and whether payment was already recorded",
        ) from exc
    return {
        "approved": True,
        "user_id": payload.user_id,
        "current_period_end": result.data,
    }


class RejectPayment(BaseModel):
    user_id: str = Field(min_length=36, max_length=36)
    gateway_order_id: str = Field(min_length=1, max_length=200)
    reason: str = Field(min_length=5, max_length=500)


@router.post("/admin/reject")
def reject_payment(
    payload: RejectPayment,
    user_id: str = Depends(get_current_user_id),
    db: Client = Depends(get_db),
):
    _require_admin(user_id)

    try:
        result = db.rpc(
            "reject_campusmatch_payment",
            {
                "p_user_id": payload.user_id,
                "p_gateway_order_id": payload.gateway_order_id,
                "p_reason": payload.reason.strip(),
                "p_reviewed_by": user_id,
            },
        ).execute()

    except Exception as exc:
        raise HTTPException(
            status_code=409,
            detail=(
                "Rejection failed. Check that the order is "
                "still pending and has not already been reviewed."
            ),
        ) from exc

    if result.data is not True:
        raise HTTPException(
            status_code=409,
            detail="Payment rejection was not confirmed.",
        )

    return {
        "rejected": True,
        "gateway_order_id": payload.gateway_order_id,
        "reason": payload.reason.strip(),
    }


@router.get("/admin/history")
def payment_history(
    user_id: str = Depends(get_current_user_id),
    db: Client = Depends(get_db),
):
    _require_admin(user_id)

    result = (
        db.table("payment_reviews")
        .select(
            "id,user_id,gateway_order_id,decision,"
            "reason,bank_transaction_ref,reviewed_by,reviewed_at"
        )
        .order("reviewed_at", desc=True)
        .limit(100)
        .execute()
    )

    return {"reviews": result.data or []}
