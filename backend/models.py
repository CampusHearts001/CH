"""
CampusMatch - Pydantic models (request / response schemas).
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------------------------------------------------------------- profiles
class ProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    age: int = Field(ge=18, le=99)
    bio: Optional[str] = Field(default=None, max_length=500)
    gender: str = Field(pattern=r"^(male|female|non-binary)$")
    interested_in: str = Field(pattern=r"^(male|female|non-binary|everyone)$")
    college: str = Field(min_length=1, max_length=150)
    interests: Optional[List[str]] = Field(default_factory=list, max_length=20)
    avatar_url: Optional[str] = None
    contact_info: str = Field(min_length=3, max_length=200)  # needed for the contact exchange


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    age: Optional[int] = Field(default=None, ge=18, le=99)
    bio: Optional[str] = Field(default=None, max_length=500)
    gender: Optional[str] = Field(default=None, pattern=r"^(male|female|non-binary)$")
    interested_in: Optional[str] = Field(default=None, pattern=r"^(male|female|non-binary|everyone)$")
    college: Optional[str] = Field(default=None, min_length=1, max_length=150)
    interests: Optional[List[str]] = Field(default=None, max_length=20)
    avatar_url: Optional[str] = None
    contact_info: Optional[str] = Field(default=None, min_length=3, max_length=200)


class ProfileResponse(BaseModel):
    """The user's OWN profile (includes contact_info)."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    age: Optional[int] = None
    bio: Optional[str] = None
    gender: str
    interested_in: str
    college: str
    interests: Optional[List[str]] = None
    avatar_url: Optional[str] = None
    contact_info: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None


class PublicProfile(BaseModel):
    """What OTHER users may see. Never contains contact_info."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    age: Optional[int] = None
    bio: Optional[str] = None
    gender: str
    college: str
    interests: Optional[List[str]] = None
    avatar_url: Optional[str] = None


PUBLIC_FIELDS = "id,name,age,bio,gender,college,interests,avatar_url"


# ------------------------------------------------------------------ swipes
class SwipeCreate(BaseModel):
    swiped_id: UUID
    direction: str = Field(pattern=r"^(left|right)$")


class SwipeResponse(BaseModel):
    swiper_id: UUID
    swiped_id: UUID
    direction: str
    matched: bool = False
    match_id: Optional[UUID] = None


# ----------------------------------------------------------------- matches
class MatchResponse(BaseModel):
    id: UUID
    user1_id: UUID
    user2_id: UUID
    created_at: Optional[datetime] = None
    other_user: Optional[PublicProfile] = None
    i_shared: bool = False
    they_shared: bool = False
    both_shared: bool = False
    other_contact: Optional[str] = None


class ContactShareResponse(BaseModel):
    success: bool
    both_shared: bool
    other_contact: Optional[str] = None
    message: str


# ------------------------------------------------------------------- games
class GameCreate(BaseModel):
    match_id: UUID


class GuessSubmit(BaseModel):
    guess: str = Field(min_length=5, max_length=5)

    @field_validator("guess")
    @classmethod
    def guess_must_be_alpha(cls, v: str) -> str:
        if not v.isalpha() or not v.isascii():
            raise ValueError("Guess must contain only letters.")
        return v.lower()


class LetterResult(BaseModel):
    letter: str
    result: str  # green | yellow | grey


class GuessResult(BaseModel):
    guess: str
    results: List[LetterResult]
    player_id: Optional[str] = None


class GameResponse(BaseModel):
    id: UUID
    match_id: UUID
    word: Optional[str] = None  # revealed only once the game is over
    guesses: List[GuessResult] = Field(default_factory=list)
    current_turn: Optional[UUID] = None
    winner: Optional[UUID] = None
    status: str
    is_my_turn: bool = False
    max_guesses: int = 6
    created_at: Optional[datetime] = None


class GuessResponse(BaseModel):
    results: List[LetterResult]
    game_status: str
    current_turn: Optional[UUID] = None
    winner: Optional[UUID] = None
    is_correct: bool
    guesses_remaining: int


# ----------------------------------------------------------------- reports
class ReportCreate(BaseModel):
    reported_id: UUID
    reason: Optional[str] = Field(default=None, max_length=500)


class ReportResponse(BaseModel):
    id: UUID
    reporter_id: UUID
    reported_id: UUID
    reason: Optional[str] = None
    created_at: Optional[datetime] = None
