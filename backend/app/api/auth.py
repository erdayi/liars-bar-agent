from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import secrets

from app.database import get_db
from app.auth import secondme as auth
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/login")
async def login():
    """Redirect to SecondMe OAuth2 authorization URL."""
    state = secrets.token_urlsafe(16)
    auth_url = auth.get_authorization_url(state)
    return {"authorization_url": auth_url, "state": state}


@router.get("/callback")
async def callback(code: str = "", state: str = "", db: AsyncSession = Depends(get_db)):
    """Handle OAuth2 callback."""
    print(f"=== CALLBACK RECEIVED ===")
    print(f"code: {code}")
    print(f"state: {state}")
    if not code:
        raise HTTPException(status_code=400, detail="No code provided")

    # Exchange code for token
    print(f"Exchanging code for token...")
    token_data = await auth.exchange_code_for_token(code)
    print(f"Token data: {token_data}")
    if not token_data:
        raise HTTPException(status_code=400, detail="Failed to obtain access token")

    access_token = token_data.get("accessToken")
    if not access_token:
        raise HTTPException(status_code=400, detail="No access token in response")

    # Get user info from SecondMe
    user_info = await auth.get_secondme_user(access_token)
    if not user_info:
        raise HTTPException(status_code=400, detail="Failed to get user info")

    # Extract user data - new API returns route as user ID
    secondme_id = user_info.get("route") or user_info.get("email") or "unknown"
    username = user_info.get("name", "Anonymous")
    email = user_info.get("email", f"{secondme_id}@secondme.local")
    avatar = user_info.get("avatar") or user_info.get("avatarUrl") or "fox"

    # Get or create user and store tokens
    user = await auth.get_or_create_user(
        db, secondme_id, username, email, avatar,
        access_token=access_token,
        refresh_token=token_data.get("refreshToken")
    )

    # Create JWT token
    jwt_token = auth.create_access_token({
        "sub": user.id,
        "user_id": user.secondme_id,
        "username": user.username,
        "avatar": user.avatar,
    })

    # Redirect to frontend with token in hash (more secure)
    redirect_url = f"http://localhost:5173/#/lobby?token={jwt_token}"
    return RedirectResponse(url=redirect_url)


@router.get("/me")
async def get_current_user(
    token: str = "",
    db: AsyncSession = Depends(get_db)
):
    """Get current user info from token."""
    # Try to get token from Authorization header
    # For now just use the token param
    if not token:
        # Try to get from request - will be handled differently
        pass

    payload = auth.verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatar": user.avatar,
        "points": user.points,
        "games_played": user.games_played,
        "games_won": user.games_won,
    }
