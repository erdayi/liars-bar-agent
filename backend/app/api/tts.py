from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta

from app.database import get_db
from app.auth import secondme as auth
from app.models.user import User

router = APIRouter(prefix="/tts", tags=["tts"])


async def get_user_from_token(db: AsyncSession, token: str):
    """Get user from JWT token."""
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

    return user


async def get_valid_access_token(user: User, db: AsyncSession) -> str:
    """Get a valid access token, refreshing if needed."""
    # Check if token is still valid
    if user.access_token and user.token_expires_at:
        # Use timezone-aware datetime for comparison
        now = datetime.utcnow().replace(tzinfo=None)
        expires = user.token_expires_at.replace(tzinfo=None) if user.token_expires_at.tzinfo else user.token_expires_at
        if expires > now:
            return user.access_token

    # Token expired, try to refresh
    if not user.refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token available")

    token_data = await auth.refresh_access_token(user.refresh_token)
    if not token_data or not token_data.get("accessToken"):
        raise HTTPException(status_code=401, detail="Failed to refresh token")

    # Update stored token
    user.access_token = token_data["accessToken"]
    if token_data.get("refreshToken"):
        user.refresh_token = token_data["refreshToken"]
    user.token_expires_at = datetime.utcnow() + timedelta(hours=2)
    await db.commit()

    return user.access_token


@router.get("/voices")
async def list_voices(
    token: str = "",
    db: AsyncSession = Depends(get_db)
):
    """List available TTS voices."""
    # Return a list of available voices
    return {
        "voices": [
            {"id": "azure", "name": "Azure Default", "language": "zh-CN"},
        ]
    }


@router.post("/speak")
async def speak(
    text: str = "",
    token: str = "",
    db: AsyncSession = Depends(get_db)
):
    """Convert text to speech using SecondMe TTS."""
    print(f"[TTS ENDPOINT] Called with text='{text}', token='{token[:20]}...'")

    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    # Limit text length
    if len(text) > 500:
        text = text[:500]

    # Get user and valid token
    user = await get_user_from_token(db, token)
    access_token = await get_valid_access_token(user, db)

    # Call TTS API
    print(f"[TTS API] Calling with token: {access_token[:20]}... text: {text[:50]}")
    audio_data = await auth.text_to_speech(access_token, text)

    if not audio_data:
        print("[TTS API] TTS returned no data - user may need to set voice in SecondMe or re-authenticate")
        # Fallback: return empty audio or error
        raise HTTPException(status_code=500, detail="TTS generation failed - please re-login with voice permission and set your voice in SecondMe")

    return Response(content=audio_data, media_type="audio/mpeg")
