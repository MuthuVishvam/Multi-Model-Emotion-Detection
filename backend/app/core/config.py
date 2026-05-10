from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    # App
    APP_NAME: str = "MELD Premium Platform"
    DEBUG: bool = os.getenv("DEBUG", "False") == "True"
    VERSION: str = "2.0.0"
    
    # Database
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    DB_NAME: str = os.getenv("DB_NAME", "meld_platform")
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    
    # Power BI
    POWERBI_TENANT_ID: str = os.getenv("POWERBI_TENANT_ID", "")
    POWERBI_CLIENT_ID: str = os.getenv("POWERBI_CLIENT_ID", "")
    POWERBI_CLIENT_SECRET: str = os.getenv("POWERBI_CLIENT_SECRET", "")
    POWERBI_GROUP_ID: str = os.getenv("POWERBI_GROUP_ID", "")
    POWERBI_WORKSPACE_ID: str = os.getenv("POWERBI_WORKSPACE_ID", "")
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000"
    ]
    
    # WebRTC
    STUN_SERVERS: List[str] = [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
    ]
    TURN_SERVER: str = os.getenv("TURN_SERVER", "")
    TURN_USERNAME: str = os.getenv("TURN_USERNAME", "")
    TURN_PASSWORD: str = os.getenv("TURN_PASSWORD", "")
    
    # ML Models
    FACE_EMOTION_MODEL_PATH: str = os.getenv("FACE_EMOTION_MODEL_PATH", "ml/artifacts/face_emotion_model.joblib")
    TEXT_EMOTION_MODEL_PATH: str = os.getenv("TEXT_EMOTION_MODEL_PATH", "ml/artifacts/text_emotion_model.joblib")
    
    # Storage
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")
    MAX_UPLOAD_SIZE: int = 500 * 1024 * 1024  # 500MB
    
    # Email
    SMTP_SERVER: str = os.getenv("SMTP_SERVER", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", 587))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    
    # Sentry
    SENTRY_DSN: str = os.getenv("SENTRY_DSN", "")
    
    # Port
    PORT: int = int(os.getenv("PORT", 8000))
    
    class Config:
        env_file = ".env"

settings = Settings()
