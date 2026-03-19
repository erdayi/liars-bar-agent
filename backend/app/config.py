from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).parent.parent / ".env"),
        extra="ignore"
    )

    # Database
    database_url: str = "postgresql+asyncpg://liarsbar:liarsbar@localhost:5432/liarsbar"

    # SecondMe OAuth2
    secondme_client_id: str = ""
    secondme_client_secret: str = ""
    secondme_redirect_uri: str = "http://localhost:5173/auth/callback"

    # SecondMe API (new endpoints)
    secondme_api_base_url: str = "https://app.mindos.com/gate/lab"
    secondme_oauth_url: str = "https://go.second.me/oauth/"
    secondme_token_endpoint: str = "https://app.mindos.com/gate/lab/api/oauth/token/code"
    secondme_refresh_endpoint: str = "https://app.mindos.com/gate/lab/api/oauth/token/refresh"
    secondme_user_info_url: str = "https://app.mindos.com/gate/lab/api/secondme/user/info"

    # JWT
    jwt_secret_key: str = "dev-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # App
    allowed_origins: str = "http://localhost:5173"
    debug: bool = True


settings = Settings()
