from pydantic import BaseModel
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Emotion Detection Backend"
    secret_key: str = "change-this-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    mongodb_uri: str = "mongodb://mongodb:27017"
    mongodb_db_name: str = "emotion_app"

    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
