# Tailscale 远程访问设置

> 让你在外面（通勤路上 / 出差酒店 / 别的城市）也能用手机或笔记本打开家里 Mac 跑的 FinOS dashboard。
> Tailscale 免费档（Personal）够个人用。

---

## 为什么用 Tailscale

| 方案 | 安全 | 速度 | 复杂度 |
|---|---|---|---|
| 直接公网暴露 31889 | ❌ 极差（token 一旦泄露等同裸奔） | ★★★ | 简单 |
| **Tailscale**（推荐） | ✅ E2E 加密、私网不公开 | ★★★ | 简单 |
| Cloudflare Tunnel | ✅ HTTPS + Cloudflare WAF | ★★ | 中等 |
| frp 自架 | 取决于你的 frps 配置 | ★★ | 中等 |
| ngrok 免费档 | ⚠️ URL 公开，易扫 | ★★ | 简单 |

---

## 三步配置

### Step 1: 装 Tailscale

在 **跑 FinOS 的 Mac** 上：
- 下载：https://tailscale.com/download
- 用 GitHub / Google / 邮箱登录（**所有设备登同一账号**）

在你的**手机** / 别的笔记本上：
- 同样下载 Tailscale 并用同一账号登录

确认所有设备都在线：
```bash
tailscale status
```
看到类似输出：
```
100.x.x.x   my-mac.tailxxxx.ts.net    macOS    -
100.y.y.y   my-iphone.tailxxxx.ts.net iOS     idle
```

### Step 2: 拿你的 Tailscale hostname

在跑 FinOS 的 Mac 上：
```bash
tailscale status | head -1 | awk '{print $2}'
```
输出形如：`my-mac.tailxxxx.ts.net`（每个用户的 `tailxxxx` 不同）。

把这个 hostname 写回 `server/runtime/config.json`：
```json
{
  "tailscaleHostname": "my-mac.tailxxxx.ts.net"
}
```
这只是给 dashboard 状态指示器展示用，**不影响实际网络**。

### Step 3: 远程访问

用任何登了同一 Tailscale 账号的设备：

```
http://my-mac.tailxxxx.ts.net:31889/dashboard/?token=<your-token>
```

第一次访问会把 `?token=` 自动写入浏览器 LocalStorage，后续直接：
```
http://my-mac.tailxxxx.ts.net:31889/dashboard/
```

---

## 高级：MagicDNS 短域名

启用 MagicDNS 后可用更短域名：

1. Tailscale Web Console → DNS → 启用 MagicDNS
2. 现在 `my-mac` 直接可解析（无需完整 `.tailxxxx.ts.net`）
3. 访问：`http://my-mac:31889/dashboard/`

---

## Mobile App 配置（可选）

如果 FinOS 后续推出 iOS/Android 原生 App，配置方式：

| 字段 | 填什么 |
|---|---|
| 服务器地址 | `http://my-mac.tailxxxx.ts.net:31889` |
| Token | 你 `config.json` 里的 `accessToken` |
| 节点名 | （任意，仅本地展示） |

---

## 防火墙 / 网络问题

Tailscale 走 WireGuard，在大多数网络都能直连。如果实在连不上：

1. 确认两边都在线：`tailscale status` 都显示 ✓
2. ping 一下：`ping my-mac.tailxxxx.ts.net`
3. 检查 Mac 防火墙是否拦了 31889：
   ```bash
   sudo pfctl -s rules | grep 31889
   ```
4. macOS 设置 → 网络 → 防火墙 → 允许 Python.app 接收连接

---

## 安全须知

- ⚠️ **Tailscale 不替代 token 验证**。即使在 Tailscale 网内，恶意应用拿到 token 也能调 FinOS。token 仍要妥善保管。
- ⚠️ **Tailscale node 共享**：如果你"share node"给别人，对方也能访问 31889。**别 share** 装了 FinOS 的 node。
- ✅ 可以用 Tailscale ACL 进一步限制：只允许某些 device 访问 Mac 的 31889 端口。

---

## 替代方案（不想用 Tailscale）

### Cloudflare Tunnel（免费、自动 HTTPS）

```bash
brew install cloudflared
cloudflared tunnel --url http://127.0.0.1:31889
```
拿到一个 `https://xxx-yyy.trycloudflare.com` URL（每次重启会变）。
Cloudflare Free 档够用，但 trycloudflare 的子域是临时的；持久子域需要 Tunnels 账户。

### Apple Continuity / iCloud (Mac + iPhone 同 Wi-Fi)

如果只在家用，连同一 Wi-Fi 就行：
```
http://192.168.x.x:31889/dashboard/?token=...
```
拿 IP：`ipconfig getifaddr en0`（Wi-Fi）或 `en1`（以太网）。
缺点：换网络（出门）就不能用。

---

## 故障排查 Cheat Sheet

| 现象 | 可能 |
|---|---|
| `tailscale status` 显示 offline | 应用没启 → 打开 menu bar Tailscale 图标重连 |
| 域名能 ping 但 dashboard 打不开 | FinOS 后端没跑 → `bash server/status_finance_node.sh` |
| iPhone 浏览器卡在白屏 | Service Worker 缓存问题 → Safari 设置清浏览数据 |
| 访问慢 | Tailscale 走 DERP relay 而非直连 → `tailscale netcheck` 看网络质量 |
| 401 | Token 不对 → URL 重新加 `?token=...` |
