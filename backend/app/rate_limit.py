from __future__ import annotations

import asyncio
from collections import defaultdict, deque
from time import time

from fastapi import HTTPException, Request, status

from app.config import settings


class InMemoryRateLimiter:
    """
    Process-local sliding-window rate limiter.
    Good enough for demos/single instance; replace with Redis for multi-instance deployments.
    """

    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    @staticmethod
    def _client_ip(request: Request) -> str:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # Trust first proxy hop; for production, gate this behind trusted proxy settings.
            return forwarded_for.split(",")[0].strip()

        if request.client and request.client.host:
            return request.client.host
        return "unknown"

    async def enforce(self, request: Request, *, route_key: str) -> None:
        now = time()
        key = f"{route_key}:{self._client_ip(request)}"
        window_start = now - float(self.window_seconds)

        async with self._lock:
            queue = self._events[key]
            while queue and queue[0] < window_start:
                queue.popleft()

            if len(queue) >= self.max_requests:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded. Max {self.max_requests} requests/{self.window_seconds}s per IP.",
                )

            queue.append(now)


emotion_ingest_limiter = InMemoryRateLimiter(
    max_requests=max(1, settings.emotion_rate_limit_requests),
    window_seconds=max(1, settings.emotion_rate_limit_window_seconds),
)


async def enforce_emotion_ingest_rate_limit(request: Request) -> None:
    await emotion_ingest_limiter.enforce(request, route_key="emotion_ingest")
