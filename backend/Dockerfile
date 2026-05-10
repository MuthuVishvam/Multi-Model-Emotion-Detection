FROM python:3.11.9-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    RELOAD=0 \
    WEB_CONCURRENCY=1

WORKDIR /app

COPY requirements.txt ./
RUN python -m pip install --upgrade pip setuptools wheel \
    && pip install --only-binary=:all: -r requirements.txt

COPY app ./app
COPY db ./db
COPY run.py ./run.py

EXPOSE 8000

CMD ["uvicorn", "app.main:application", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers", "--forwarded-allow-ips", "*"]
