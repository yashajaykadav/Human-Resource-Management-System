#!/usr/bin/env bash
set -e

# ==============================================================
# Apryde AI HRMS - Docker Management Script
# ==============================================================

COMMAND=${1:-up}

case $COMMAND in
  up)
    echo "Starting Apryde AI HRMS stack..."
    docker compose up --build -d
    FE_PORT=${FRONTEND_PORT:-3001}
    BE_PORT=${BACKEND_PORT:-8001}
    echo "=========================================================="
    echo "Apryde AI HRMS is running!"
    echo "Frontend Dashboard: http://localhost:$FE_PORT"
    echo "Backend API Docs:   http://localhost:$BE_PORT/api/v1/docs"
    echo "=========================================================="
    ;;
  logs)
    docker compose logs -f
    ;;
  down)
    echo "Stopping Apryde AI HRMS stack..."
    docker compose down
    ;;
  seed)
    echo "Running database initial setup and seed..."
    docker compose exec backend python -m app.initial_setup
    ;;
  test)
    echo "Running automated containerized test suite..."
    docker compose run --rm backend pytest -v
    ;;
  ollama)
    echo "Starting with local Ollama profile..."
    docker compose --profile ollama up -d
    ;;
  clean)
    echo "Cleaning containers and volumes..."
    docker compose down -v
    ;;
  *)
    echo "Usage: ./scripts/run.sh {up|down|logs|seed|test|ollama|clean}"
    exit 1
    ;;
esac

