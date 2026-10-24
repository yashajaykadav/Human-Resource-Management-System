FROM python:3.11-slim

WORKDIR /app

# Install system dependencies needed for postgres client and compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Upgrade pip and install pinned requirements with robust network timeouts
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --default-timeout=1000 --retries=10 -r requirements.txt

COPY . .

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV BACKEND_PORT=8001

EXPOSE ${BACKEND_PORT}

# Shell-form CMD to dynamically evaluate $BACKEND_PORT
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${BACKEND_PORT} --reload"]