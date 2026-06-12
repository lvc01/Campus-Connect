#!/usr/bin/env bash
# stop.sh — stop the backend and/or frontend started by dev.sh.
#
# Reads PID files (backend/.dev.pid, frontend/.dev.pid), sends SIGTERM,
# waits up to 5s, then SIGKILL. Also frees ports 3000 and 8001 if anything
# is still bound to them. Safe to run when nothing is running.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PID_FILE="$ROOT/backend/.dev.pid"
FRONTEND_PID_FILE="$ROOT/frontend/.dev.pid"

stop_pid() {
  local label="$1"
  local pid_file="$2"
  if [ ! -f "$pid_file" ]; then
    echo "[stop.sh] $label: no PID file"
    return 0
  fi
  local pid
  pid=$(cat "$pid_file" 2>/dev/null || echo "")
  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    echo "[stop.sh] $label: no live process (pid=$pid)"
    rm -f "$pid_file"
    return 0
  fi
  echo "[stop.sh] stopping $label (PID $pid)..."
  kill -TERM "$pid" 2>/dev/null || true
  for _ in 1 2 3 4 5; do
    sleep 1
    if ! kill -0 "$pid" 2>/dev/null; then
      break
    fi
  done
  if kill -0 "$pid" 2>/dev/null; then
    echo "[stop.sh] $label did not exit gracefully; sending SIGKILL"
    kill -KILL "$pid" 2>/dev/null || true
  fi
  rm -f "$pid_file"
}

stop_pid "backend"  "$BACKEND_PID_FILE"
stop_pid "frontend" "$FRONTEND_PID_FILE"

# Fallback: anything still bound to the dev ports?
for port in "${BACKEND_PORT:-8001}" "${FRONTEND_PORT:-3000}"; do
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "[stop.sh] killing leftover processes on :$port (PIDs: $pids)"
    kill -9 $pids 2>/dev/null || true
  fi
done

echo "[stop.sh] done"
