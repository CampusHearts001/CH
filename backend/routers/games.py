"""
CampusMatch - Games router.
Turn-based Wordle for matched pairs: a low-pressure way to talk before sharing contact details.
"""

import random

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from auth import get_active_user_id
from database import get_db
from models import (
    GameCreate,
    GameResponse,
    GuessResponse,
    GuessResult,
    GuessSubmit,
    LetterResult,
)

router = APIRouter(prefix="/games", tags=["games"])

MAX_GUESSES = 6

WORD_LIST = """
apple brave crane dance eagle flame grace heart index jewel knife light maple night ocean
piano queen raise solar table unity valor water yacht zebra amuse beach candy dream earth
flair globe honey image karma lemon mango noble orbit pearl rover stone tiger ultra vivid
wheat young angel blaze chest diver elbow frost giant haste ivory joker laser mixer nerve
olive power quill shelf tower venom witch bread climb drive field glass house juice lunch
music novel paper quick river sweet trust voice world youth smile story train plant brain
cloud dairy dress fruit green happy jolly kiosk lucky magic nurse party proud quiet radio
sugar tasty urban video wagon yummy actor basic charm daily eager fancy grand hobby input
""".split()


def _letter_results(guess: str, word: str) -> list[LetterResult]:
    """Standard Wordle scoring (handles repeated letters correctly)."""
    result = ["grey"] * 5
    remaining = list(word)
    for i in range(5):  # greens first
        if guess[i] == word[i]:
            result[i] = "green"
            remaining[i] = None
    for i in range(5):  # then yellows
        if result[i] == "grey" and guess[i] in remaining:
            result[i] = "yellow"
            remaining[remaining.index(guess[i])] = None
    return [LetterResult(letter=guess[i], result=result[i]) for i in range(5)]


def _get_match(db: Client, match_id: str, user_id: str) -> dict:
    res = db.table("matches").select("*").eq("id", match_id).execute()
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Match not found.")
    match = res.data[0]
    if user_id not in (str(match["user1_id"]), str(match["user2_id"])):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You are not part of this match."
        )
    return match


def _get_game(db: Client, game_id: str, user_id: str) -> tuple[dict, dict]:
    res = db.table("games").select("*").eq("id", game_id).execute()
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Game not found.")
    game = res.data[0]
    return game, _get_match(db, str(game["match_id"]), user_id)


def _public_game(game: dict, user_id: str) -> dict:
    """Shape a DB row for the client. The secret word is hidden until the game is over."""
    over = game["status"] != "active"
    return {
        **game,
        "word": game["word"] if over else None,
        "guesses": [GuessResult(**g) for g in (game.get("guesses") or [])],
        "is_my_turn": (not over) and str(game["current_turn"]) == user_id,
        "max_guesses": MAX_GUESSES,
    }


@router.post("", response_model=GameResponse, status_code=status.HTTP_201_CREATED)
def create_game(
    payload: GameCreate,
    user_id: str = Depends(get_active_user_id),
    db: Client = Depends(get_db),
):
    """Start a new game. If one is already running for this match, return that one instead."""
    match_id = str(payload.match_id)
    _get_match(db, match_id, user_id)

    active = (
        db.table("games")
        .select("*")
        .eq("match_id", match_id)
        .eq("status", "active")
        .execute()
    )
    if active.data:
        return _public_game(active.data[0], user_id)

    res = (
        db.table("games")
        .insert(
            {
                "match_id": match_id,
                "word": random.choice(WORD_LIST),
                "guesses": [],
                "current_turn": user_id,  # whoever starts goes first
                "status": "active",
            }
        )
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to create game."
        )
    return _public_game(res.data[0], user_id)


@router.get("/match/{match_id}", response_model=GameResponse)
def get_match_game(
    match_id: str,
    user_id: str = Depends(get_active_user_id),
    db: Client = Depends(get_db),
):
    """The currently running game for a match (404 if there isn't one)."""
    _get_match(db, match_id, user_id)
    res = (
        db.table("games")
        .select("*")
        .eq("match_id", match_id)
        .eq("status", "active")
        .execute()
    )
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active game for this match.")
    return _public_game(res.data[0], user_id)


@router.get("/{game_id}", response_model=GameResponse)
def get_game(
    game_id: str,
    user_id: str = Depends(get_active_user_id),
    db: Client = Depends(get_db),
):
    game, _ = _get_game(db, game_id, user_id)
    return _public_game(game, user_id)


@router.post("/{game_id}/guess", response_model=GuessResponse)
def submit_guess(
    game_id: str,
    payload: GuessSubmit,
    user_id: str = Depends(get_active_user_id),
    db: Client = Depends(get_db),
):
    game, match = _get_game(db, game_id, user_id)

    if game["status"] != "active":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This game is already over.")
    if str(game["current_turn"]) != user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "It is not your turn.")

    guess = payload.guess
    results = _letter_results(guess, game["word"])
    guesses = (game.get("guesses") or []) + [
        {
            "guess": guess,
            "results": [r.model_dump() for r in results],
            "player_id": user_id,
        }
    ]

    correct = guess == game["word"]
    new_status = (
        "won" if correct else ("lost" if len(guesses) >= MAX_GUESSES else "active")
    )
    winner = user_id if correct else None
    other = (
        str(match["user2_id"])
        if str(match["user1_id"]) == user_id
        else str(match["user1_id"])
    )
    next_turn = other if new_status == "active" else user_id

    # Only update if it is still this player's turn (guards against double-clicks / two tabs)
    updated = (
        db.table("games")
        .update(
            {
                "guesses": guesses,
                "current_turn": next_turn,
                "status": new_status,
                "winner": winner,
            }
        )
        .eq("id", game_id)
        .eq("current_turn", user_id)
        .eq("status", "active")
        .execute()
    )
    if not updated.data:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "The game changed - please try again."
        )

    return GuessResponse(
        results=results,
        game_status=new_status,
        current_turn=next_turn,
        winner=winner,
        is_correct=correct,
        guesses_remaining=max(0, MAX_GUESSES - len(guesses)),
    )
