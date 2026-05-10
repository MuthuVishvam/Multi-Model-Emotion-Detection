from fastapi import Request
from collections import defaultdict
from datetime import datetime, timedelta
import asyncio

# Rate limiting store
requests_store = defaultdict(list)

async def rate_limiter_middleware(request: Request, max_requests: int = 100, window: int = 60):
    """Rate limiting middleware"""
    client_ip = request.client.host if request.client else "unknown"
    now = datetime.now()
    
    # Clean old requests
    requests_store[client_ip] = [
        req_time for req_time in requests_store[client_ip]
        if (now - req_time).seconds < window
    ]
    
    # Check limit
    if len(requests_store[client_ip]) >= max_requests:
        return {"error": "Rate limit exceeded"}
    
    # Add current request
    requests_store[client_ip].append(now)
    
    return request
