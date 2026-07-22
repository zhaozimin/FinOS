#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_PATH="$ROOT_DIR/runtime/finance-node.pid"
LOG_PATH="$ROOT_DIR/logs/finance-node.log"
SCREEN_SESSION="finance_node"

"$ROOT_DIR/prepare_finance_node_runtime.sh" >/dev/null

PORT="$(python3 - <<PY
import json
from pathlib import Path

config = json.loads(Path("$ROOT_DIR/runtime/config.json").read_text(encoding="utf-8"))
print(config.get("port", 59418))
PY
)"

if [[ -f "$PID_PATH" ]] && kill -0 "$(cat "$PID_PATH")" >/dev/null 2>&1 && lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | grep -qx "$(cat "$PID_PATH")"; then
  echo "Finance Node is already running with PID $(cat "$PID_PATH")"
else
  rm -f "$PID_PATH"
  OCCUPYING_PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [[ -n "$OCCUPYING_PID" ]]; then
    echo "Port $PORT is already occupied by PID $OCCUPYING_PID; not starting the service." >&2
    exit 1
  fi
  if command -v screen >/dev/null 2>&1; then
    ROOT_DIR="$ROOT_DIR" PID_PATH="$PID_PATH" LOG_PATH="$LOG_PATH" \
      screen -dmS "$SCREEN_SESSION" bash -lc 'cd "$ROOT_DIR" && echo $$ > "$PID_PATH" && exec python3 "$ROOT_DIR/finance_node_server.py" > "$LOG_PATH" 2>&1'
  else
    nohup python3 "$ROOT_DIR/finance_node_server.py" > "$LOG_PATH" 2>&1 &
    echo $! > "$PID_PATH"
  fi
  sleep 1

  if [[ ! -f "$PID_PATH" ]] || ! kill -0 "$(cat "$PID_PATH")" >/dev/null 2>&1 || ! lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | grep -qx "$(cat "$PID_PATH")"; then
    echo "Finance Node failed to start. Recent log output:"
    tail -n 40 "$LOG_PATH" || true
    exit 1
  fi
fi

echo ""
cat "$ROOT_DIR/runtime/connection-info.txt"
echo ""
echo "OpenClaw 工具清单已生成:"
echo "$ROOT_DIR/runtime/openclaw_finance_tools.json"
