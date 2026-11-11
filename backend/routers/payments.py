"""Razorpay weekly subscription endpoints for CampusMatch."""

from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from supabase import Client

import config
from auth import get_current_user_id
from database import get_db

router = APIRouter(prefix="/payments", tags=["payments"])
RAZORPAY_API = "https://api.razorpay.com/v1"


class VerifySubscriptionPayload(BaseModel):
    razorpay_subscription_id: str = Field(min_length=5, max_length=100)
    razorpay_payment_id: str = Field(min_length=5, max_length=100)
    razorpay_signature: str = Field(min_length=20, max_length=256)


def _require_razorpay_config() -> None:
    if not all(
        (config.RAZORPAY_KEY_ID, config.RAZORPAY_KEY_SECRET, config.RAZORPAY_PLAN_ID)
    ):
        raise HTTPException(
            503,
            "Razorpay is not configured. Set the backend Razorpay key, secret and weekly plan ID.",
        )


def _auth(user_id: str):
    return (config.RAZORPAY_KEY_ID, config.RAZORPAY_KEY_SECRET)


async def _razorpay_request(method: str, path: str, **kwargs) -> dict:
    _require_razorpay_config()
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.request(
                method,
                f"{RAZORPAY_API}{path}",
                auth=(config.RAZORPAY_KEY_ID, config.RAZORPAY_KEY_SECRET),
                headers={"Content-Type": "application/json"},
                **kwargs,
            )
        data = response.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(
            502, "Could not communicate with Razorpay. Please try again."
        )
    if response.is_error:
        description = (data.get("error") or {}).get(
            "description"
        ) or "Razorpay rejected the request."
        raise HTTPException(502, description)
    return data


def _profile_exists(db: Client, user_id: str) -> bool:
    result = db.table("profiles").select("id").eq("id", user_id).limit(1).execute()
    return bool(result.data)


def _get_subscription_row(db: Client, user_id: str) -> dict | None:
    result = (
        db.table("subscriptions").select("*").eq("user_id", user_id).limit(1).execute()
    )
    return result.data[0] if result.data else None


def _iso_from_unix(value: int | float | None) -> datetime:
    return (
        datetime.fromtimestamp(value, tz=timezone.utc)
        if value
        else datetime.now(timezone.utc)
    )


def _grant_paid_period(
    db: Client,
    user_id: str,
    subscription_id: str,
    payment_id: str,
    amount: int,
    currency: str,
    paid_at_unix: int | float | None,
) -> None:
    """Record a captured payment once and extend access by exactly seven days."""
    existing_payment = (
        db.table("payments")
        .select("id")
        .eq("razorpay_payment_id", payment_id)
        .limit(1)
        .execute()
        .data
    )
    if existing_payment:
        return

    paid_at = _iso_from_unix(paid_at_unix)
    current = _get_subscription_row(db, user_id)
