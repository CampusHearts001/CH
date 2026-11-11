"""
CampusMatch - Reports router (report + silently block).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

import config
from auth import get_active_user_id
from database import get_db
from models import ReportCreate, ReportResponse

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def report_user(
    payload: ReportCreate,
    user_id: str = Depends(get_active_user_id),
    db: Client = Depends(get_db),
):
    reported_id = str(payload.reported_id)
    if reported_id == user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot report yourself.")

    result = (
        db.table("reports")
        .insert({"reporter_id": user_id, "reported_id": reported_id, "reason": payload.reason})
        .execute()
    )
    if not result.data:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to submit report.")

    # The reporter never sees this person again
    existing = db.table("swipes").select("id").eq("swiper_id", user_id).eq("swiped_id", reported_id).execute()
    if existing.data:
        db.table("swipes").update({"direction": "left"}).eq("id", existing.data[0]["id"]).execute()
    else:
        db.table("swipes").insert({"swiper_id": user_id, "swiped_id": reported_id, "direction": "left"}).execute()

    # If they were matched, reporting also ends the match
    u1, u2 = sorted([user_id, reported_id])
    db.table("matches").delete().eq("user1_id", u1).eq("user2_id", u2).execute()

    # Basic auto-moderation: hide a profile once several different people report it
    reporters = {
        r["reporter_id"]
        for r in (db.table("reports").select("reporter_id").eq("reported_id", reported_id).execute().data or [])
    }
    if len(reporters) >= config.AUTO_HIDE_REPORTS:
        db.table("profiles").update({"is_active": False}).eq("id", reported_id).execute()

    return result.data[0]
