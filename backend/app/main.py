from contextlib import asynccontextmanager
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from socketio import ASGIApp

from app.config import settings
from app.database.mongodb import close_mongo_connection, init_mongo_connection, ping_database
from app.db import ensure_platform_indexes
from app.routers import (
    admin as admin_routes,
    analytics as analytics_routes,
    attention,
    auth as auth_routes,
    classes as class_routes,
    dashboard,
    emotion as emotion_routes,
    feedback,
    health,
    lessons as lesson_routes,
    live_classes,
    notifications,
    reports,
    sessions,
    users,
)
from app.websocket.events import setup_socketio


load_dotenv()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("emotion_backend")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
UPLOADS_DIR = BACKEND_ROOT / "uploads"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting MELD backend")
    init_mongo_connection()
    await ping_database()
    await ensure_platform_indexes()
    logger.info("Database connection established")

    yield

    await close_mongo_connection()
    logger.info("Backend shutdown complete")


app = FastAPI(
    title=settings.app_name,
    description="MELD - AI-powered learning platform API",
    version="2.0.0",
    lifespan=lifespan,
)

sio = setup_socketio(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(
        "HTTP exception method=%s path=%s status=%s detail=%s",
        request.method,
        request.url.path,
        exc.status_code,
        exc.detail,
    )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def unexpected_exception_handler(request: Request, exc: Exception):
    logger.exception("Unexpected exception method=%s path=%s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(health.router)
app.include_router(auth_routes.router)
app.include_router(users.router)
app.include_router(sessions.router)
app.include_router(emotion_routes.router)
app.include_router(emotion_routes.batch_router)
app.include_router(emotion_routes.batch_router, prefix="/api")
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(lesson_routes.router)
app.include_router(admin_routes.router)
app.include_router(class_routes.router)
app.include_router(notifications.router)
app.include_router(attention.router)
app.include_router(live_classes.router)
app.include_router(analytics_routes.router)
app.include_router(feedback.router)

application = ASGIApp(sio, other_asgi_app=app)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:application",
        host="0.0.0.0",
        port=int(os.getenv("PORT", settings.port)),
        reload=os.getenv("RELOAD", "1") == "1",
        log_level=settings.log_level.lower(),
    )
