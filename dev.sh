#!/usr/bin/env bash
# dev.sh — start backend (uvicorn) and frontend (next dev) together.
#
# Usage:
#   ./dev.sh                       # both services
#   ./dev.sh --backend-only        # just the API
#   ./dev.sh --frontend-only       # just the web app
#   ./dev.sh --no-color            # disable ANSI prefixes
#
# Env:
#   BACKEND_PORT=8001   (default)
#   FRONTEND_PORT=3000  (default)
#   LOG_DIR=/tmp        (default)
#
# Logs are also tee'd to $LOG_DIR/cc-backend.log and $LOG_DIR/cc-frontend.log.
# PID files live at backend/.dev.pid and frontend/.dev.pid (use ./stop.sh to clean up).
# Ctrl-C stops both.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8001}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
LOG_DIR="${LOG_DIR:-/tmp}"

USE_COLOR=1
START_BACKEND=1
START_FRONTEND=1

for arg in "$@"; do
  case "$arg" in
    --no-color)      USE_COLOR=0 ;;
    --backend-only)  START_FRONTEND=0 ;;
    --frontend-only) START_BACKEND=0 ;;
    -h|--help)
      sed -n '2,/^set /p' "$0" | sed -E 's/^# ?//' | head -n 20
      exit 0 ;;
  esac
done

# Disable colors when stdout isn't a TTY (e.g. piped to a file)
if [ "$USE_COLOR" = "1" ] && [ ! -t 1 ]; then
  USE_COLOR=0
fi

if [ "$USE_COLOR" = "1" ]; then
  B_COLOR=$'\033[36m'   # cyan
  F_COLOR=$'\033[35m'   # magenta
  RESET=$'\033[0m'
else
  B_COLOR=""
  F_COLOR=""
  RESET=""
fi

# Write frontend env if missing so api-client knows the backend port.
# Existing .env.local is never overwritten.
ENV_LOCAL="$ROOT/frontend/.env.local"
if [ ! -f "$ENV_LOCAL" ]; then
  cat > "$ENV_LOCAL" <<EOF
NEXT_PUBLIC_API_URL=http://localhost:${BACKEND_PORT}/api/v1
EOF
  echo "[dev.sh] wrote $ENV_LOCAL"
fi

BACKEND_PID_FILE="$ROOT/backend/.dev.pid"
FRONTEND_PID_FILE="$ROOT/frontend/.dev.pid"
rm -f "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE"

declare -a CLEANUP_PIDS

cleanup() {
  # Guard against the trap firing multiple times
  if [ "${CLEANUP_DONE:-0}" = "1" ]; then
    return
  fi
  CLEANUP_DONE=1

  echo
  echo "[dev.sh] shutting down..."
  for pid in "${CLEANUP_PIDS[@]:-}"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  sleep 1
  for pid in "${CLEANUP_PIDS[@]:-}"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done
  rm -f "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE"
}
trap cleanup INT TERM EXIT

BACKEND_LOG="$LOG_DIR/cc-backend.log"
FRONTEND_LOG="$LOG_DIR/cc-frontend.log"

if [ "$START_BACKEND" = "1" ]; then
  : > "$BACKEND_LOG"
  # subshell `exec`s uvicorn so $! below captures uvicorn's PID directly.
  (
    cd "$ROOT/backend"
    # shellcheck disable=SC1091
    source .venv/bin/activate
    exec uvicorn app.main:app --reload --port "$BACKEND_PORT"
  ) > >(tee -a "$BACKEND_LOG" | sed "s/^/${B_COLOR}[backend]${RESET} /") 2>&1 &
  BACKEND_PID=$!
  CLEANUP_PIDS+=("$BACKEND_PID")
  echo "$BACKEND_PID" > "$BACKEND_PID_FILE"
fi

if [ "$START_FRONTEND" = "1" ]; then
  : > "$FRONTEND_LOG"
  (
    cd "$ROOT/frontend"
    exec env PORT="$FRONTEND_PORT" npm run dev
  ) > >(tee -a "$FRONTEND_LOG" | sed "s/^/${F_COLOR}[frontend]${RESET} /") 2>&1 &
  FRONTEND_PID=$!
  CLEANUP_PIDS+=("$FRONTEND_PID")
  echo "$FRONTEND_PID" > "$FRONTEND_PID_FILE"
fi

cat <<EOF
════════════════════════════════════════════════════════
  Campus Connect — dev stack
  Backend:  http://localhost:${BACKEND_PORT}   logs: ${BACKEND_LOG}
  Frontend: http://localhost:${FRONTEND_PORT}  logs: ${FRONTEND_LOG}
  PID files: ${BACKEND_PID_FILE}, ${FRONTEND_PID_FILE}
  Ctrl-C to stop both. Run ./stop.sh to kill stragglers.
════════════════════════════════════════════════════════
EOF

wait
