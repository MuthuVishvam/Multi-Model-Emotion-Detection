from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Emotion Detection Backend"
    jwt_secret: str = Field("change_me", validation_alias=AliasChoices("JWT_SECRET", "SECRET_KEY"))
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    mongo_uri: str = Field(
        "mongodb://localhost:27017",
        validation_alias=AliasChoices("MONGO_URI", "MONGODB_URI"),
    )
    db_name: str = Field("emotion_platform", validation_alias=AliasChoices("DB_NAME", "MONGODB_DB_NAME"))

    cors_origins: list[str] = ["http://localhost:5173"]
    model_artifact_path: str = "../ml/artifacts/text_emotion_model.joblib"


settings = Settings()
