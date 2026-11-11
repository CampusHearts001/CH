"""
CampusMatch - Profiles router: own profile + the discovery feed.
"""

import random

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

import config
from auth import (
    AuthUser,
    email_allowed,
    get_current_user,
    get_current_user_id,
    get_active_user_id,
)
from database import get_db
from models import (
    PUBLIC_FIELDS,
    ProfileCreate,
    ProfileResponse,
    ProfileUpdate,
    PublicProfile,
)

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("/me", response_model=ProfileResponse)
def get_my_profile(
    user_id: str = Depends(get_current_user_id), db: Client = Depends(get_db)
):
    result = db.table("profiles").select("*").eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Profile not found. Please complete your profile setup.",
        )
    return result.data[0]


@router.post("/me", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED)
def create_my_profile(
    payload: ProfileCreate,
    user: AuthUser = Depends(get_current_user),
    db: Client = Depends(get_db),
):
    # Campus gate is enforced HERE (server side) - browser checks can be bypassed.
    if not email_allowed(user.email):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only students with a college email address can join CampusMatch.",
        )
    if config.REQUIRE_VERIFIED_EMAIL and not user.email_verified:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Please confirm your college email (check your inbox) before creating a profile.",
        )

    existing = db.table("profiles").select("id").eq("id", user.id).execute()
    if existing.data:
        raise HTTPException(status.HTTP_409_CONFLICT, "Profile already exists.")

    result = (
        db.table("profiles").insert({"id": user.id, **payload.model_dump()}).execute()
    )
    if not result.data:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to create profile."
        )
    return result.data[0]


@router.put("/me", response_model=ProfileResponse)
def update_my_profile(
    payload: ProfileUpdate,
    user_id: str = Depends(get_current_user_id),
    db: Client = Depends(get_db),
):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update.")

    result = db.table("profiles").update(update_data).eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found.")
    return result.data[0]


@router.get("/discover", response_model=PublicProfile)
def discover_profile(
    user_id: str = Depends(get_active_user_id), db: Client = Depends(get_db)
):
    """
    Return ONE random profile for the current user to swipe on.

    Rules:
      - never yourself, never someone you've already swiped on (or reported)
      - only people from your own college
      - only the gender(s) you are interested in (default: the opposite gender)
      - only people who are interested in your gender (so every heart can become a match)
    """
    me_res = (
        db.table("profiles")
        .select("gender,interested_in,college")
        .eq("id", user_id)
        .execute()
    )
    if not me_res.data:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Complete your profile setup before discovering others.",
        )
    me = me_res.data[0]

    swiped = {
        row["swiped_id"]
        for row in (
            db.table("swipes")
            .select("swiped_id")
            .eq("swiper_id", user_id)
            .limit(5000)
            .execute()
            .data
            or []
        )
    }

    query = (
        db.table("profiles")
        .select(PUBLIC_FIELDS + ",interested_in")
        .eq("is_active", True)
        .eq("college", me["college"])
        .neq("id", user_id)
    )
    if me["interested_in"] != "everyone":
        query = query.eq("gender", me["interested_in"])

    rows = query.limit(2000).execute().data or []
    candidates = [
        r
        for r in rows
        if r["id"] not in swiped
        and r.get("interested_in") in ("everyone", me["gender"])
    ]

    if not candidates:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "No more profiles to show right now. Check back later!",
        )

    pick = random.choice(candidates)
    pick.pop("interested_in", None)
    return pick
