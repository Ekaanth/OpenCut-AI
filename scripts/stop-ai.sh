#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

if ! command -v docker &>/dev/null; then
    log_error "docker is not installed or not in PATH."
    exit 1
fi

log_info "Stopping all OpenCutAI services..."
cd "$PROJECT_ROOT"

docker compose down

log_info "All services stopped."
