"""
CampusMatch - Auth utilities.
Validates the Supabase JWT from the Authorization header.
"""
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status

import config
from database import auth_client, get_db
from datetime import datetime, timezone


@dataclass
class AuthUser:
    id: str
    email: str
    email_verified: bool


def get_current_user(authorization: str = Header(...)) -> AuthUser:
    """Verify the bearer token with Supabase and return the authenticated user."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authorization header must start with 'Bearer '")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing access token")

    try:
        response = auth_client.auth.get_user(token)
        user = response.user if response else None
    except Exception:
        user = None

    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    return AuthUser(
        id=str(user.id),
        email=(user.email or "").lower(),
        email_verified=bool(getattr(user, "email_confirmed_at", None)),
    )


def get_current_user_id(user: AuthUser = Depends(get_current_user)) -> str:
    return user.id


def email_allowed(email: str) -> bool:
    """True if the email belongs to one of the allowed college domains."""
    if not config.ALLOWED_EMAIL_DOMAINS:
        return True  # unrestricted (development only)
    domain = email.split("@")[-1]
    return any(domain == d or domain.endswith("." + d) for d in config.ALLOWED_EMAIL_DOMAINS)


def get_active_user_id(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
) -> str:
    """Require a paid, unexpired CampusMatch subscription for app features."""
    try:
        result = (
            db.table("subscriptions")
            .select("status,current_period_end")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        subscription = result.data[0] if result.data else None
    except Exception:
        subscription = None

    if not subscription or subscription.get("status") != "active":
        from fastapi import HTTPException
        raise HTTPException(402, "An active CampusMatch subscription is required.")

    end = subscription.get("current_period_end")
    try:
        expires_at = datetime.fromisoformat(end.replace("Z", "+00:00"))
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
    except (AttributeError, ValueError):
        from fastapi import HTTPException
        raise HTTPException(402, "Your subscription is not active. Please renew.")

    if expires_at <= datetime.now(timezone.utc):
        from fastapi import HTTPException
        raise HTTPException(402, "Your CampusMatch subscription has expired. Please renew.")
    return user_id
