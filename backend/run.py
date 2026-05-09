import os

import uvicorn


if __name__ == "__main__":
    os.makedirs("logs", exist_ok=True)

    port = int(os.getenv("PORT", "8000"))
    reload_enabled = os.getenv("RELOAD", "1") == "1"

    print("=" * 60)
    print("Starting Emotion-Based Learning Platform API Server")
    print("=" * 60)
    print(f"Server: http://localhost:{port}")
    print(f"API Docs: http://localhost:{port}/docs")
    print(f"Socket.IO: http://localhost:{port}/socket.io")
    print("=" * 60)

    uvicorn.run(
        "app.main:application",
        host="0.0.0.0",
        port=port,
        reload=reload_enabled,
    )
