from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, dashboard, emotion, health, lessons, sessions
from db.mongo import close_mongo_connection, init_mongo_connection, ping_database


logger = logging.getLogger("emotion_backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_mongo_connection()
    await ping_database()
    logger.info("MongoDB connection established")
    try:
        yield
    finally:
        await close_mongo_connection()
        logger.info("MongoDB connection closed")


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(emotion.router)
app.include_router(dashboard.router)
app.include_router(lessons.router)
