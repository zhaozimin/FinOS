#!/usr/bin/env bash
set -euo pipefail
umask 077  # 纵深防御：本脚本落盘的 config/token/日志等一律 0600/0700，不退回 0644

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/runtime"
LOG_DIR="$ROOT_DIR/logs"
CONFIG_PATH="$RUNTIME_DIR/config.json"
DB_PATH="$RUNTIME_DIR/finance.sqlite3"
INFO_PATH="$RUNTIME_DIR/connection-info.txt"
TOOLS_OUTPUT_PATH="$RUNTIME_DIR/openclaw_finance_tools.json"
# 固定默认端口 59418（谐音"我就是要发"，讨个好彩头）。可用 FINANCE_NODE_PORT 覆盖。
PORT="${FINANCE_NODE_PORT:-59418}"
# 默认只绑回环，绝不把财务 API 暴露到局域网。需多设备/远程访问显式设 FINANCE_NODE_HOST，
# 或走 Tailscale/Cloudflare Tunnel（见 docs/tailscale-setup.md）。
HOST="${FINANCE_NODE_HOST:-127.0.0.1}"
NODE_NAME="${FINANCE_NODE_NAME:-Finance Node}"

mkdir -p "$RUNTIME_DIR" "$LOG_DIR"
chmod 700 "$RUNTIME_DIR" 2>/dev/null || true  # runtime 存 token 与整库，仅属主可访问

TAILSCALE_HOSTNAME=""
TAILSCALE_IP=""
REMOTE_ACCESS="局域网"
TAILSCALE_BIN=""

for candidate in \
  "$(command -v tailscale 2>/dev/null || true)" \
  "/Applications/Tailscale.app/Contents/MacOS/Tailscale" \
  "/Applications/Tailscale.app/Contents/MacOS/tailscale" \
  "/opt/homebrew/bin/tailscale" \
  "/usr/local/bin/tailscale"
do
  if [[ -n "$candidate" ]] && [[ -x "$candidate" ]]; then
    TAILSCALE_BIN="$candidate"
    break
  fi
done

if [[ -n "$TAILSCALE_BIN" ]]; then
  TAILSCALE_IP="$("$TAILSCALE_BIN" ip -4 2>/dev/null | head -n 1 || true)"
  TAILSCALE_HOSTNAME="$({ "$TAILSCALE_BIN" status --json 2>/dev/null || true; } | python3 -c 'import json,sys
try:
    data = json.load(sys.stdin)
    self_info = data.get("Self", {})
    print((self_info.get("DNSName") or "").rstrip("."))
except Exception:
    print("")
' || true)"
  if [[ -n "$TAILSCALE_IP" || -n "$TAILSCALE_HOSTNAME" ]]; then
    REMOTE_ACCESS="Tailscale"
  fi
fi

if [[ ! -f "$CONFIG_PATH" ]]; then
  ACCESS_TOKEN="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(24))
PY
)"

  cat > "$CONFIG_PATH" <<JSON
{
  "nodeName": "$NODE_NAME",
  "host": "$HOST",
  "port": $PORT,
  "accessToken": "$ACCESS_TOKEN",
  "remoteAccess": "$REMOTE_ACCESS",
  "tailscaleIP": "$TAILSCALE_IP",
  "tailscaleHostname": "$TAILSCALE_HOSTNAME",
  "lastIngestedAt": null
}
JSON
else
  python3 - <<PY
import json
from pathlib import Path

config_path = Path("$CONFIG_PATH")
config = json.loads(config_path.read_text(encoding="utf-8"))
config["nodeName"] = "$NODE_NAME"
config["host"] = "$HOST"
config["port"] = int("$PORT")
config["remoteAccess"] = "$REMOTE_ACCESS"
config["tailscaleIP"] = "$TAILSCALE_IP"
config["tailscaleHostname"] = "$TAILSCALE_HOSTNAME"
config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY
fi

python3 - <<PY
import json
from pathlib import Path

root = Path("$ROOT_DIR")
runtime = Path("$RUNTIME_DIR")
config = json.loads(Path("$CONFIG_PATH").read_text(encoding="utf-8"))
port = config["port"]
token = config["accessToken"]
tailscale_host = config.get("tailscaleHostname") or config.get("tailscaleIP") or ""

if tailscale_host:
    public_url = f"http://{tailscale_host}:{port}"
else:
    public_url = f"http://127.0.0.1:{port}"

info = f"""Finance Node 连接信息

节点名称: {config['nodeName']}
数据库: {Path("$DB_PATH")}
本机地址: http://127.0.0.1:{port}
远程地址: {public_url}
账单网页: {public_url}/dashboard
Token: {token}
健康检查:
curl -H "Authorization: Bearer {token}" {public_url}/v1/health

iPhone App 建议填写:
- 节点名称: {config['nodeName']}
- Finance Server 地址: {public_url}
- Token: {token}

手机浏览器建议打开:
- 账单网页: {public_url}/dashboard
- 首次打开后输入上面的 Token
"""
Path("$INFO_PATH").write_text(info, encoding="utf-8")

# openclaw 工具清单是可选集成物，缺模板也绝不阻断后端启动。
# 按候选路径查找：私有布局(openclaw/) 优先，公开仓库布局(runtime example) 兜底。
candidates = [
    root / "openclaw" / "finance_http_tools.template.json",
    runtime / "openclaw_finance_tools.json.example",
]
template_path = next((p for p in candidates if p.exists()), None)
if template_path is not None:
    template = template_path.read_text(encoding="utf-8")
    template = template.replace("__BASE_URL__", public_url).replace("__TOKEN__", token)
    (runtime / "openclaw_finance_tools.json").write_text(template, encoding="utf-8")
PY

# 收紧敏感文件权限：token 明文存于 config/connection-info/openclaw 工具清单，仅属主可读。
# 覆盖首建与复用两条路径（write_text 会保留已存在文件的旧权限，故此处统一显式 chmod）。
chmod 600 "$CONFIG_PATH" "$INFO_PATH" 2>/dev/null || true
[[ -f "$TOOLS_OUTPUT_PATH" ]] && chmod 600 "$TOOLS_OUTPUT_PATH" 2>/dev/null || true

echo ""
cat "$INFO_PATH"
echo ""
echo "OpenClaw 工具清单已生成:"
echo "$TOOLS_OUTPUT_PATH"
