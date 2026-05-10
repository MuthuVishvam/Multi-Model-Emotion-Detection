import logging

logger = logging.getLogger(__name__)

async def error_handler_middleware(request, call_next):
    """Error handling middleware"""
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return {
            "error": "Internal server error",
            "detail": str(e) if True else None  # Change in production
        }
