FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/db ./db
COPY backend/run.py ./run.py

EXPOSE 8000

CMD ["sh", "-c", "python run.py"]
