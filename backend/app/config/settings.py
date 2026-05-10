import json

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Emotion Detection Backend"
    jwt_secret: str = Field("change_me", validation_alias=AliasChoices("JWT_SECRET", "SECRET_KEY"))
    algorithm: str = "HS256"
    access_token_expire_minutes: int = Field(
        60,
        validation_alias=AliasChoices("ACCESS_TOKEN_EXPIRE_MINUTES", "JWT_EXPIRE_MINUTES"),
    )

    mongo_uri: str = Field(
        "mongodb://localhost:27017",
        validation_alias=AliasChoices("MONGO_URI", "MONGODB_URI"),
    )
    db_name: str = Field("emotion_platform", validation_alias=AliasChoices("DB_NAME", "MONGODB_DB_NAME"))
    port: int = Field(8000, validation_alias=AliasChoices("PORT"))

    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    frontend_origin: str | None = Field(default=None, validation_alias=AliasChoices("FRONTEND_ORIGIN"))
    cors_origin_regex: str = (
        r"^https?://("
        r"localhost"
        r"|127\.0\.0\.1"
        r"|0\.0\.0\.0"
        r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
        r"|192\.168\.\d{1,3}\.\d{1,3}"
        r"|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}"
        r")(:\d+)?$"
    )
    log_level: str = "INFO"
    emotion_rate_limit_requests: int = 120
    emotion_rate_limit_window_seconds: int = 60
    max_voice_upload_bytes: int = 10_000_000
    allowed_audio_content_types: list[str] = [
        "audio/webm",
        "audio/wav",
        "audio/x-wav",
        "audio/wave",
        "audio/ogg",
        "audio/mpeg",
        "audio/mp4",
        "audio/x-m4a",
        "audio/aac",
    ]
    model_artifact_path: str = "../ml/artifacts/text_emotion_model.joblib"
    powerbi_tenant_id: str | None = Field(default=None, validation_alias=AliasChoices("POWERBI_TENANT_ID"))
    powerbi_client_id: str | None = Field(default=None, validation_alias=AliasChoices("POWERBI_CLIENT_ID"))
    powerbi_client_secret: str | None = Field(default=None, validation_alias=AliasChoices("POWERBI_CLIENT_SECRET"))
    powerbi_workspace_id: str | None = Field(default=None, validation_alias=AliasChoices("POWERBI_WORKSPACE_ID"))
    powerbi_report_id: str | None = Field(default=None, validation_alias=AliasChoices("POWERBI_REPORT_ID"))
    powerbi_dataset_id: str | None = Field(default=None, validation_alias=AliasChoices("POWERBI_DATASET_ID"))

    @field_validator("cors_origins", "allowed_audio_content_types", mode="before")
    @classmethod
    def _parse_list_settings(cls, value):
        if isinstance(value, str):
            normalized = value.strip()
            if normalized.startswith("[") and normalized.endswith("]"):
                try:
                    parsed = json.loads(normalized)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except json.JSONDecodeError:
                    pass
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @model_validator(mode="after")
    def _apply_frontend_origin(self):
        if isinstance(self.frontend_origin, str) and self.frontend_origin.strip():
            origin = self.frontend_origin.strip().rstrip("/")
            if origin and origin not in self.cors_origins:
                self.cors_origins = [*self.cors_origins, origin]
        return self


settings = Settings()
