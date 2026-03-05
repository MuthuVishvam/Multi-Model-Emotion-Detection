from contextlib import asynccontextmanager
import logging
from pathlib import Path
from time import perf_counter

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db.indexes import ensure_platform_indexes
from app.routes import admin_routes, analytics_routes, auth_routes, class_routes, emotion_routes, lesson_routes
from app.routers import attention, dashboard, feedback, health, notifications, reports, sessions, users
from db.mongo import close_mongo_connection, init_mongo_connection, ping_database


resolved_log_level = getattr(logging, settings.log_level.upper(), logging.INFO)
logging.basicConfig(
    level=resolved_log_level,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("emotion_backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_mongo_connection()
    await ping_database()
    await ensure_platform_indexes()
    logger.info("DB connected")
    try:
        yield
    finally:
        await close_mongo_connection()
        logger.info("DB disconnected")


app = FastAPI(title=settings.app_name, lifespan=lifespan)

uploads_dir = Path(__file__).resolve().parents[1] / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    start = perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled error during request method=%s path=%s", request.method, request.url.path)
        raise

    duration_ms = round((perf_counter() - start) * 1000.0, 2)
    logger.info(
        "request method=%s path=%s status=%s duration_ms=%.2f",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning("Validation error method=%s path=%s errors=%s", request.method, request.url.path, exc.errors())
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


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
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(lesson_routes.router)
app.include_router(admin_routes.router)
app.include_router(class_routes.router)
app.include_router(notifications.router)
app.include_router(attention.router)
app.include_router(analytics_routes.router)
app.include_router(feedback.router)
