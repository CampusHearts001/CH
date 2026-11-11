"""
CampusMatch - Matches router: match list, contact exchange, unmatch.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from auth import get_current_user_id
from database import get_db
from models import PUBLIC_FIELDS, ContactShareResponse, MatchResponse

router = APIRouter(prefix="/matches", tags=["matches"])


def _get_my_match(db: Client, match_id: str, user_id: str) -> dict:
    res = db.table("matches").select("*").eq("id", match_id).execute()
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Match not found.")
    match = res.data[0]
    if user_id not in (str(match["user1_id"]), str(match["user2_id"])):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not part of this match.")
    return match


def _other_id(match: dict, user_id: str) -> str:
    return str(match["user2_id"]) if str(match["user1_id"]) == user_id else str(match["user1_id"])


def _shared_flags(match: dict, user_id: str) -> tuple[bool, bool]:
    is_user1 = str(match["user1_id"]) == user_id
    mine = match["contact_shared_1"] if is_user1 else match["contact_shared_2"]
    theirs = match["contact_shared_2"] if is_user1 else match["contact_shared_1"]
    return bool(mine), bool(theirs)


def _contact_of(db: Client, other_id: str) -> str | None:
    res = db.table("profiles").select("contact_info").eq("id", other_id).execute()
    return res.data[0].get("contact_info") if res.data else None


@router.get("", response_model=list[MatchResponse])
def get_my_matches(user_id: str = Depends(get_current_user_id), db: Client = Depends(get_db)):
    matches = (
        db.table("matches")
        .select("*")
        .or_(f"user1_id.eq.{user_id},user2_id.eq.{user_id}")
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    if not matches:
        return []

    other_ids = [_other_id(m, user_id) for m in matches]
    profiles = (
        db.table("profiles")
        .select(PUBLIC_FIELDS + ",contact_info")
        .in_("id", other_ids)
        .execute()
        .data
        or []
    )
    by_id = {str(p["id"]): p for p in profiles}

    out = []
    for m in matches:
        other = by_id.get(_other_id(m, user_id))
        if not other:
            continue
        mine, theirs = _shared_flags(m, user_id)
        both = mine and theirs
        contact = other.get("contact_info") if both else None
        public = {k: v for k, v in other.items() if k != "contact_info"}  # never leak it early
        out.append(
            {
                **m,
                "other_user": public,
                "i_shared": mine,
                "they_shared": theirs,
                "both_shared": both,
                "other_contact": contact,
            }
        )
    return out


@router.post("/{match_id}/share-contact", response_model=ContactShareResponse)
def share_contact(match_id: str, user_id: str = Depends(get_current_user_id), db: Client = Depends(get_db)):
    """Opt in to the contact exchange. Their number is revealed only when BOTH have opted in."""
    match = _get_my_match(db, match_id, user_id)
    field = "contact_shared_1" if str(match["user1_id"]) == user_id else "contact_shared_2"
    db.table("matches").update({field: True}).eq("id", match_id).execute()

    match = _get_my_match(db, match_id, user_id)  # re-read the latest state
    mine, theirs = _shared_flags(match, user_id)
    both = mine and theirs
    return ContactShareResponse(
        success=True,
        both_shared=both,
        other_contact=_contact_of(db, _other_id(match, user_id)) if both else None,
        message="Contact exchanged! You can now reach each other."
        if both
        else "Contact shared! It will unlock when they share theirs too.",
    )


@router.get("/{match_id}/contact", response_model=ContactShareResponse)
def get_contact(match_id: str, user_id: str = Depends(get_current_user_id), db: Client = Depends(get_db)):
    match = _get_my_match(db, match_id, user_id)
    mine, theirs = _shared_flags(match, user_id)
    both = mine and theirs
    return ContactShareResponse(
        success=True,
        both_shared=both,
        other_contact=_contact_of(db, _other_id(match, user_id)) if both else None,
        message="Contact exchanged!"
        if both
        else ("Waiting for them to share back." if mine else "Share your contact first."),
    )


@router.delete("/{match_id}", status_code=status.HTTP_204_NO_CONTENT)
def unmatch(match_id: str, user_id: str = Depends(get_current_user_id), db: Client = Depends(get_db)):
    """End a match. The other person simply stops seeing it; the pair never reappears in Discover."""
    _get_my_match(db, match_id, user_id)
    db.table("matches").delete().eq("id", match_id).execute()
