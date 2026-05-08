from pydantic_settings import BaseSettings

# Application settings loaded from environment variables or the .env file.
# Includes database connection, session configuration, and environment mode.
class Settings(BaseSettings):
    database_url: str
    frontend_database_url: str
    secret_key: str
    session_cookie_name: str = "session_id"
    session_expire_minutes: int = 30
    environment: str = "development"

    class Config:
        env_file = "../.env"
        extra = "ignore"


settings = Settings()
