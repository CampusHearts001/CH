"""
CampusMatch - Auth utilities.
Validates the Supabase JWT from the Authorization header.
"""
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status

import config
from database import auth_client


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
