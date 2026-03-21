#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

OLLAMA_URL="http://localhost:11434"
DEFAULT_MODEL="llama3.2:1b"
MAX_RETRIES=30
RETRY_INTERVAL=5

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

cleanup() {
    if [ $? -ne 0 ]; then
        log_error "Startup failed. Check logs with: docker compose logs"
    fi
}
trap cleanup EXIT

# --- Pre-flight checks ---
if ! command -v docker &>/dev/null; then
    log_error "docker is not installed or not in PATH."
    exit 1
fi

if ! docker info &>/dev/null; then
    log_error "Docker daemon is not running."
    exit 1
fi

# --- Start services ---
log_info "Starting all OpenCutAI services (db, redis, ollama, ai-backend, web)..."
cd "$PROJECT_ROOT"

docker compose up -d --build

# --- Wait for Ollama readiness ---
log_info "Waiting for Ollama to become ready..."
retries=0
while [ $retries -lt $MAX_RETRIES ]; do
    if curl -sf "${OLLAMA_URL}/api/tags" >/dev/null 2>&1; then
        log_info "Ollama is ready."
        break
    fi
    retries=$((retries + 1))
    if [ $retries -eq $MAX_RETRIES ]; then
        log_error "Ollama did not become ready after $((MAX_RETRIES * RETRY_INTERVAL)) seconds."
        exit 1
    fi
    log_warn "Ollama not ready yet (attempt ${retries}/${MAX_RETRIES}). Retrying in ${RETRY_INTERVAL}s..."
    sleep "$RETRY_INTERVAL"
done

# --- Pull default model ---
log_info "Pulling default model: ${DEFAULT_MODEL} (this may take a while on first run)..."
if docker compose exec ollama ollama pull "$DEFAULT_MODEL"; then
    log_info "Model ${DEFAULT_MODEL} is ready."
else
    log_warn "Failed to pull model ${DEFAULT_MODEL}. LLM features will be unavailable until a model is pulled."
fi

# --- Print service status ---
echo ""
log_info "===== OpenCutAI Service Status ====="
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""

log_info "Web App:      http://localhost:3100"
log_info "AI Backend:   http://localhost:8420"
log_info "Ollama API:   ${OLLAMA_URL}"
log_info "PostgreSQL:   localhost:5432"
log_info "Redis HTTP:   http://localhost:8079"
echo ""
log_info "All services started successfully."
