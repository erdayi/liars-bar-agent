from datetime import datetime, timedelta
from typing import Optional
import httpx
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models.user import User

# Token payload
TokenData = dict


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.jwt_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def verify_token(token: str) -> Optional[TokenData]:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        return None


async def exchange_code_for_token(code: str) -> Optional[dict]:
    """Exchange authorization code for access token using new API."""
    import traceback
    import os
    try:
        # Disable proxy via environment
        old_http = os.environ.pop('http_proxy', None)
        old_https = os.environ.pop('https_proxy', None)
        old_HTTP = os.environ.pop('HTTP_PROXY', None)
        old_HTTPS = os.environ.pop('HTTPS_PROXY', None)

        async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
            response = await client.post(
                settings.secondme_token_endpoint,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.secondme_redirect_uri,
                    "client_id": settings.secondme_client_id,
                    "client_secret": settings.secondme_client_secret,
                },
            )
            print(f"Token exchange response status: {response.status_code}")
            print(f"Token exchange response body: {response.text}")
            if response.status_code == 200:
                result = response.json()
                # New API format: { code: 0, data: {...} }
                if result.get("code") == 0 and result.get("data"):
                    return result["data"]
                else:
                    print(f"Token exchange failed: {result}")
    except Exception as e:
        print(f"Token exchange error: {e}")
        traceback.print_exc()
    return None


async def get_secondme_user(access_token: str) -> Optional[dict]:
    """Fetch user info from SecondMe API using new endpoint."""
    import os
    try:
        # Disable proxy via environment
        old_http = os.environ.pop('http_proxy', None)
        old_https = os.environ.pop('https_proxy', None)

        async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
            response = await client.get(
                settings.secondme_user_info_url,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if response.status_code == 200:
                result = response.json()
                print(f"[SecondMe User Info] Full response: {result}")
                # New API format: { code: 0, data: {...} }
                if result.get("code") == 0 and result.get("data"):
                    print(f"[SecondMe User Info] Data keys: {list(result['data'].keys())}")
                    return result["data"]
    except Exception as e:
        print(f"User info fetch error: {e}")
    return None


async def get_or_create_user(
    db: AsyncSession,
    secondme_id: str,
    username: str,
    email: str,
    avatar: str = "fox",
    access_token: str = None,
    refresh_token: str = None
) -> User:
    """Get or create user from SecondMe data."""
    from datetime import datetime, timedelta
    result = await db.execute(select(User).where(User.secondme_id == secondme_id))
    user = result.scalar_one_or_none()

    if user:
        # Update user info
        user.username = username
        user.email = email
        user.avatar = avatar
        if access_token:
            user.access_token = access_token
        if refresh_token:
            user.refresh_token = refresh_token
            # Token expires in 2 hours
            user.token_expires_at = datetime.utcnow() + timedelta(hours=2)
    else:
        # Create new user
        user = User(
            secondme_id=secondme_id,
            username=username,
            email=email,
            avatar=avatar,
            points=100,  # Starting points
            access_token=access_token,
            refresh_token=refresh_token,
            token_expires_at=datetime.utcnow() + timedelta(hours=2) if access_token else None,
        )
        db.add(user)

    await db.commit()
    await db.refresh(user)
    return user


def get_authorization_url(state: str) -> str:
    """Generate SecondMe OAuth2 authorization URL."""
    params = {
        "client_id": settings.secondme_client_id,
        "redirect_uri": settings.secondme_redirect_uri,
        "response_type": "code",
        "scope": "user.info voice",
        "state": state,
    }
    return f"{settings.secondme_oauth_url}?" + "&".join(f"{k}={v}" for k, v in params.items())


async def refresh_access_token(refresh_token: str) -> Optional[dict]:
    """Refresh the access token using refresh token."""
    import os
    try:
        # Disable proxy
        os.environ.pop('http_proxy', None)
        os.environ.pop('https_proxy', None)
        os.environ.pop('HTTP_PROXY', None)
        os.environ.pop('HTTPS_PROXY', None)

        async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
            response = await client.post(
                settings.secondme_refresh_endpoint,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": settings.secondme_client_id,
                    "client_secret": settings.secondme_client_secret,
                },
            )
            if response.status_code == 200:
                result = response.json()
                if result.get("code") == 0 and result.get("data"):
                    return result["data"]
    except Exception as e:
        print(f"Token refresh error: {e}")
    return None


async def text_to_speech(access_token: str, text: str, emotion: str = "fluent") -> Optional[bytes]:
    """Call SecondMe TTS API to convert text to speech using user's custom voice.

    Uses the public API: POST /api/secondme/tts/generate
    Voice ID is automatically obtained from user's SecondMe profile.
    """
    import os
    try:
        # Disable proxy
        os.environ.pop('http_proxy', None)
        os.environ.pop('https_proxy', None)
        os.environ.pop('HTTP_PROXY', None)
        os.environ.pop('HTTPS_PROXY', None)

        # New public TTS API
        tts_url = f"{settings.secondme_api_base_url}/api/secondme/tts/generate"

        async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
            response = await client.post(
                tts_url,
                headers={"Authorization": f"Bearer {access_token}"},
                json={
                    "text": text,
                    "emotion": emotion
                },
            )
            print(f"TTS response status: {response.status_code}")
            print(f"TTS response text: {response.text[:500] if response.text else 'empty'}")

            if response.status_code == 200:
                result = response.json()
                print(f"TTS result code: {result.get('code')}")
                if result.get("code") == 0 and result.get("data"):
                    audio_url = result["data"].get("url")
                    print(f"TTS audio URL: {audio_url}")
                    if audio_url:
                        audio_response = await client.get(audio_url)
                        if audio_response.status_code == 200:
                            print(f"TTS audio downloaded successfully, size: {len(audio_response.content)} bytes")
                            return audio_response.content
                    # If no url but code is 0, check if there's an error message
                    if not audio_url:
                        print(f"TTS no audio URL in response: {result}")
                elif result.get("code") != 0:
                    print(f"TTS API error code: {result.get('code')}, message: {result.get('message')}")
            else:
                print(f"TTS error: {response.text}")
    except Exception as e:
        print(f"TTS error: {e}")
    return None


async def text_to_speech_url(access_token: str, text: str, emotion: str = "fluent") -> Optional[str]:
    """Get TTS audio URL directly (for streaming)."""
    import os
    try:
        os.environ.pop('http_proxy', None)
        os.environ.pop('https_proxy', None)
        os.environ.pop('HTTP_PROXY', None)
        os.environ.pop('HTTPS_PROXY', None)

        tts_url = f"{settings.secondme_api_base_url}/api/secondme/tts/generate"

        async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
            response = await client.post(
                tts_url,
                headers={"Authorization": f"Bearer {access_token}"},
                json={
                    "text": text,
                    "emotion": emotion
                },
            )

            if response.status_code == 200:
                result = response.json()
                if result.get("code") == 0 and result.get("data"):
                    return result["data"].get("url")
    except Exception as e:
        print(f"TTS URL error: {e}")
    return None
