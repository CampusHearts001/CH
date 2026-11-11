"""
CampusMatch - Swipes router.

A swipe is private: the other person is NEVER told about a left swipe, and a right
swipe (a "heart") stays secret until the other person hearts you back. Nobody can
ever find out they were rejected - that is the whole point of the app.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from auth import get_active_user_id
from database import get_db
from models import SwipeCreate, SwipeResponse

router = APIRouter(prefix="/swipes", tags=["swipes"])


def _find_match(db: Client, a: str, b: str) -> str | None:
    u1, u2 = sorted([a, b])
    res = (
        db.table("matches").select("id").eq("user1_id", u1).eq("user2_id", u2).execute()
    )
    return res.data[0]["id"] if res.data else None


def _create_match(db: Client, a: str, b: str) -> str | None:
    """Create the match (idempotent - safe if both people swipe at the same moment)."""
    existing = _find_match(db, a, b)
    if existing:
        return existing
    u1, u2 = sorted([a, b])
    try:
        res = db.table("matches").insert({"user1_id": u1, "user2_id": u2}).execute()
        if res.data:
            return res.data[0]["id"]
    except Exception:
        pass  # unique-constraint race: the other request created it first
    return _find_match(db, a, b)


@router.post("", response_model=SwipeResponse, status_code=status.HTTP_201_CREATED)
def record_swipe(
    payload: SwipeCreate,
    user_id: str = Depends(get_active_user_id),
    db: Client = Depends(get_db),
):
    swiped_id = str(payload.swiped_id)

    if swiped_id == user_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "You cannot swipe on yourself."
        )

    # The target must be a real, active profile
    target = (
        db.table("profiles")
        .select("id")
        .eq("id", swiped_id)
        .eq("is_active", True)
        .execute()
    )
    if not target.data:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "That profile is no longer available."
        )

    # A first swipe is final (stops people flipping a 'left' to 'right' via the API)
    existing = (
        db.table("swipes")
        .select("direction")
        .eq("swiper_id", user_id)
        .eq("swiped_id", swiped_id)
        .execute()
    )
    if existing.data:
        direction = existing.data[0]["direction"]
    else:
        direction = payload.direction
        db.table("swipes").insert(
            {"swiper_id": user_id, "swiped_id": swiped_id, "direction": direction}
        ).execute()

    match_id = None
    if direction == "right":
        reverse = (
            db.table("swipes")
            .select("id")
            .eq("swiper_id", swiped_id)
            .eq("swiped_id", user_id)
            .eq("direction", "right")
            .execute()
        )
        if reverse.data:
            match_id = _create_match(db, user_id, swiped_id)

    return {
        "swiper_id": user_id,
        "swiped_id": swiped_id,
        "direction": direction,
        "matched": match_id is not None,
        "match_id": match_id,
    }
