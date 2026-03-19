from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.database import get_db
from app.auth import secondme as auth
from app.game_manager.room import room_manager
from app.models.user import User

router = APIRouter(prefix="/lobby", tags=["lobby"])


async def get_token_from_header(authorization: str = Header(None)) -> str:
    """Extract token from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    return authorization.replace("Bearer ", "")


class CreateRoomRequest(BaseModel):
    mode: str  # "deck" or "dice"
    max_players: Optional[int] = 8


class JoinRoomRequest(BaseModel):
    room_id: str


class UpdatePointsRequest(BaseModel):
    user_id: str
    points_change: int


class AddBotRequest(BaseModel):
    count: Optional[int] = 1


@router.get("/rooms")
async def list_rooms():
    """List all available rooms."""
    return {"rooms": room_manager.get_all_rooms()}


@router.post("/rooms")
async def create_room(
    request: CreateRoomRequest,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Create a new room."""
    # Extract token from header
    token = await get_token_from_header(authorization)
    # Verify token
    payload = auth.verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Validate mode
    if request.mode not in ["deck", "dice"]:
        raise HTTPException(status_code=400, detail="Invalid game mode")

    # Create room
    room = room_manager.create_room(request.mode, request.max_players or 8)

    return {
        "room_id": room.room_id,
        "mode": room.mode,
        "max_players": room.max_players,
    }


@router.post("/rooms/join")
async def join_room(
    request: JoinRoomRequest,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Join an existing room."""
    # Extract token from header
    token = await get_token_from_header(authorization)
    # Verify token
    payload = auth.verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    room = room_manager.get_room(request.room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if room.is_full():
        raise HTTPException(status_code=400, detail="Room is full")

    if room.game_started:
        raise HTTPException(status_code=400, detail="Game already started")

    # Return room info and WebSocket URL
    return {
        "room_id": room.room_id,
        "mode": room.mode,
        "max_players": room.max_players,
        "player_count": len(room.players),
        "ws_url": f"/ws/game/{room.room_id}",
    }


@router.post("/rooms/{room_id}/leave")
async def leave_room(room_id: str, authorization: str = Header(None)):
    """Leave a room."""
    token = await get_token_from_header(authorization)
    payload = auth.verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    player_id = payload.get("sub")
    room = room_manager.get_room(room_id)

    if room:
        room.remove_player(player_id)
        if not room.players:
            await room_manager.delete_room(room_id)

    return {"success": True}


@router.delete("/rooms/{room_id}")
async def delete_room(room_id: str, authorization: str = Header(None)):
    """Delete a room (owner only)."""
    token = await get_token_from_header(authorization)
    payload = auth.verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    player_id = payload.get("sub")
    room = room_manager.get_room(room_id)

    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Check if user is the owner
    if room.owner_id != player_id:
        raise HTTPException(status_code=403, detail="Only the owner can delete this room")

    await room_manager.delete_room(room_id)

    room_manager.delete_room(room_id)
    return {"success": True}


@router.post("/rooms/{room_id}/bots")
async def add_bots(
    room_id: str,
    request: AddBotRequest,
    authorization: str = Header(None)
):
    """Add bot players to a room."""
    # Verify token
    token = await get_token_from_header(authorization)
    payload = auth.verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if room.game_started:
        raise HTTPException(status_code=400, detail="Game already started")

    # Add bots
    added = room.add_bots(request.count or 1)

    return {
        "success": True,
        "added": added,
        "player_count": len(room.players),
        "players": [
            {
                "player_id": pid,
                "nickname": p["nickname"],
                "avatar": p["avatar"],
                "is_bot": p.get("is_bot", False),
            }
            for pid, p in room.players.items()
        ]
    }


@router.post("/points/update")
async def update_points(
    request: UpdatePointsRequest,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Update user points (admin endpoint for game results)."""
    token = await get_token_from_header(authorization)
    payload = auth.verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.points = max(0, user.points + request.points_change)
    await db.commit()

    return {"points": user.points}


@router.get("/leaderboard")
async def get_leaderboard(
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """Get leaderboard."""
    result = await db.execute(
        select(User)
        .order_by(User.points.desc())
        .limit(limit)
    )
    users = result.scalars().all()

    return {
        "leaderboard": [
            {
                "rank": i + 1,
                "user_id": u.id,
                "username": u.username,
                "avatar": u.avatar,
                "points": u.points,
                "games_played": u.games_played,
                "games_won": u.games_won,
            }
            for i, u in enumerate(users)
        ]
    }
