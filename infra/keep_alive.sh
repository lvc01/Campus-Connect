#!/usr/bin/env bash
#
# Keep-alive ping — defeats Render's 15-minute idle sleep by hitting the
# cheap /api/v1/health/ping endpoint every 5 minutes.
#
# Use freely from cron-job.org or any free monitor. We DO NOT install a
# background loop on the Render instance (it would consume the free hour
# budget). Schedule this externally.

set -euo pipefail

API_BASE="${API_BASE:-https://campus-connect-api.onrender.com}"
PING_URL="${API_BASE%/}/api/v1/health/ping"

echo "[$(date -Iseconds)] GET $PING_URL"
http_code="$(curl -sSk -o /tmp/campus-connect-ping.out -w '%{http_code}' --max-time 25 "$PING_URL" || echo 000)"
echo "  status: $http_code"

if [ "$http_code" != "200" ]; then
  cat /tmp/campus-connect-ping.out || true
  exit 1
fi
