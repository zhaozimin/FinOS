#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_PATH="$ROOT_DIR/runtime/finance-node.pid"
CONFIG_PATH="$ROOT_DIR/runtime/config.json"
PORT="59418"
SCREEN_SESSION="finance_node"

if [[ -f "$CONFIG_PATH" ]]; then
  PORT="$(python3 - <<PY
import json
from pathlib import Path

config = json.loads(Path("$CONFIG_PATH").read_text(encoding="utf-8"))
print(config.get("port", 59418))
PY
)"
fi

if [[ ! -f "$PID_PATH" ]]; then
  echo "Finance Node is not running."
  exit 0
fi

PID="$(cat "$PID_PATH")"
if kill -0 "$PID" >/dev/null 2>&1 && lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | grep -qx "$PID"; then
  kill "$PID"
  echo "Stopped Finance Node ($PID)"
else
  echo "Finance Node process not found on port $PORT; removing stale PID file only."
fi

screen -S "$SCREEN_SESSION" -X quit >/dev/null 2>&1 || true
rm -f "$PID_PATH"
