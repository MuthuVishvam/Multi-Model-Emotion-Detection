FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY db ./db
COPY run.py ./run.py

EXPOSE 8000

CMD ["sh", "-c", "python run.py"]
