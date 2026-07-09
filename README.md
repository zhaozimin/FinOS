# FinOS · 本地优先的双用途财务工作台

> 既能记日常生活账，也能跑个人创业者经营记账。**完全本地存储**，所有数据都在你的 SQLite 文件里 — 无云、无追踪。可选挂 Tailscale 多设备访问，可选给 AI 写工具配置让它代记账。

**开源仓库**：<https://github.com/zhaozimin/FinOS>

---

## ✨ 它能做什么

| 类别 | 功能 |
|---|---|
| **基础** | 多账户管理（资产 / 负债 / 信用卡额度）· 净资产 KPI · 收支流水 · Excel 导出 · 71 套主题 |
| **个人理财** | 月度预算 · 储蓄目标圆环 · 阈值警戒同心圆（绿/黄/红三档）· 现金流 30/60/90 天预测 · 月度订阅总览 · 多币种自动汇率 |
| **创业经营** | 客户 / 项目 / 对手方名册 · 项目预算双柱（实际 vs 预算）· 项目 P&L 抽屉 · 发票追踪（缺发票徽章 + 工作台）· 报税 5 sheet Excel 导出（按 taxCategory）· 税务 KPI |
| **数据流入** | 微信 / 支付宝 / 招行账单 CSV 导入 · 周期账目自动生成（订阅/工资/房租）· 余额调整审计（"黑洞资金"可追溯） |
| **效率** | ⌘K 全局搜索（5 类，方向键导航）· 仪表盘 9 widget 拖拽自定义（dnd-kit）· 可定制保存到本地 |
| **AI 接入** | 一份 OpenAPI-style 工具描述，配合 [SKILL.md](./skills/ai-bookkeeper/SKILL.md) 让任意 LLM agent 帮你记账 |

完整功能截图与使用手册：本地打开 [`docs/guides/features-guide.html`](./docs/guides/features-guide.html)。

---

## 🚀 5 分钟本地部署

> **懒人法（推荐）**：把仓库根目录的 [`AGENT_DEPLOY_PROMPT.md`](./AGENT_DEPLOY_PROMPT.md) 整段贴给 Claude Code / Cursor / OpenClaw 等编码 agent，它会替你完成 clone → 装依赖 → 生成 token → 起服务 → 开浏览器。想手动来就照下面走。

### 1. 系统要求

- **macOS / Linux**（Windows WSL 也行）
- **Python ≥ 3.9**（仅用 stdlib + `openpyxl`）
- **Node ≥ 20** + **npm**（仅在你想改前端 / 重新构建时需要）
- 50 MB 磁盘 + 一个 31889 端口

### 2. 克隆与配置

```bash
git clone https://github.com/zhaozimin/FinOS.git
cd FinOS

# 安装 Python 依赖
pip3 install openpyxl

# 复制配置模板（必须！）
cp server/runtime/config.json.example server/runtime/config.json

# 用编辑器打开 server/runtime/config.json，把 accessToken 改成强随机字符串
# 推荐生成：
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# 把输出粘贴到 accessToken 字段
```

### 3. 启动

```bash
cd server
python3 finance_node_server.py
```

看到 `Finance Node running on http://0.0.0.0:31889` 即成功。

### 4. 打开浏览器

```
http://127.0.0.1:31889/dashboard/?token=<你刚才设的 token>
```

第一次打开会自动把 `?token=` 写进 localStorage，之后访问直接用 `http://127.0.0.1:31889/dashboard/` 即可。

### 5. 开始用

进入「财务设置」：
1. 改账户名 / 删默认账户 → 加你自己的（微信支付 / 招行卡 / 信用卡 / 现金…）
2. 在每张账户上填「当前余额」（不是初始余额 — 直接填卡里现在多少钱）
3. 切到「资金流水」→「新增交易」，开始记账

---

## 🎛️ 启动 / 停止 / 状态

仓库自带的 shell 脚本（在 `server/` 下）：

```bash
cd server

# 前台启动（看日志、按 Ctrl-C 停）
python3 finance_node_server.py

# 后台 launchd 启动（macOS，开机自启）
bash install_launch_agent.sh

# 状态
bash status_finance_node.sh

# 停止
bash stop_finance_node.sh

# 卸载 launchd
bash uninstall_launch_agent.sh

# 一键查看连接信息
bash view_finance_node.sh
```

---

## 🔧 重新构建前端（仅在你改了 React 源码时需要）

```bash
cd server/web-dashboard
npm install        # 首次或加新依赖时
npm run build
rm -rf ../web && cp -R dist ../web
```

仓库 `server/web/` 已经预构建好，**普通用户开箱即跑，无需 npm**。

---

## 🌐 远程访问（可选 · 推荐 Tailscale）

把家里 / 公司里的 Mac 当后端，手机 / 笔记本随时访问。

### Tailscale 三步搞定

1. 在所有设备装 [Tailscale](https://tailscale.com/download)，登录同一账号（免费档够用）
2. 在跑 FinOS 的 Mac 上拿你的 Tailscale hostname：
   ```bash
   tailscale status | head -1
   # 输出形如：100.x.x.x  你的-mac.tailxxxx.ts.net  ...
   ```
3. 手机 / 别的电脑访问：
   ```
   http://你的-mac.tailxxxx.ts.net:31889/dashboard/?token=<刚才的 token>
   ```

把 hostname 写回 `server/runtime/config.json` 的 `tailscaleHostname` 字段，
仅用于「财务设置 → 状态指示」展示，不影响实际网络。

### 其他方案

- **Cloudflare Tunnel**：`cloudflared tunnel --url http://127.0.0.1:31889`，给一个公网 https 域名
- **frp / ngrok**：内网穿透同理
- **裸暴露公网**：**强烈不建议**。token 仅是 Bearer 字符串，没做速率限制 / IP 白名单

---

## 🤖 让 AI 帮你记账（OpenClaw / Claude / GPT 等）

FinOS 的所有功能都通过本地 HTTP API 暴露。任何能调 HTTP 的 LLM agent 都能记账。

### 快速接入（OpenClaw 风格）

1. 复制工具描述模板：
   ```bash
   cp server/runtime/openclaw_finance_tools.json.example \
      server/runtime/openclaw_finance_tools.json
   ```
2. 编辑这个文件，把 `baseUrl` 和 `token` 改成你自己的
3. 把这个 JSON 喂给你的 agent（OpenClaw 直接读、Claude Skill 用文件引用、GPT 用 functions schema 转换）

### 给 AI 的记账完整指南

- **数据字段速查**：[`docs/ai-recording.md`](./docs/ai-recording.md) — 每个字段的含义、必填/可选、示例 payload
- **API 全表**：[`docs/api.md`](./docs/api.md) — 所有 endpoint
- **AI Skill**：[`skills/ai-bookkeeper/SKILL.md`](./skills/ai-bookkeeper/SKILL.md) — 给 AI 看的完整 prompt：何时记账、如何提取字段、如何在多账户里选最合理的、模糊金额怎么处理

把 SKILL.md 整段贴进 Claude Project / GPT Custom Instructions / OpenClaw 的 prompt，AI 就能听懂"中午吃了麦当劳花了 38 块"然后自动调 `POST /v1/transactions`。

---

## 📁 目录结构

```
FinOS/
├── README.md                          # 你正在读
├── AGENT_DEPLOY_PROMPT.md             # 交给编码 agent 的一键本地部署提示词
├── LICENSE
├── .gitignore                         # 排除真实数据 / 构建产物
├── server/
│   ├── finance_node_server.py        # 后端核心（~3700 行）
│   ├── runtime/
│   │   ├── config.json.example       # 复制为 config.json 后改
│   │   ├── openclaw_finance_tools.json.example
│   │   └── attachments/              # 用户上传的发票图，git 忽略
│   ├── web/                          # 预构建的前端（开箱即跑）
│   ├── web-dashboard/                # React 19 + Vite 8 源码
│   └── *.sh                          # 启动 / 状态 / 停止 脚本
├── docs/
│   ├── api.md                        # 后端 HTTP API 完整说明
│   ├── ai-recording.md               # AI 记账字段口径与示例
│   ├── openclaw-integration.md       # OpenClaw 接入步骤
│   ├── tailscale-setup.md            # Tailscale 远程访问详解
│   └── guides/
│       └── features-guide.html       # 给最终用户看的图文功能手册
└── skills/
    └── ai-bookkeeper/
        └── SKILL.md                  # 给 AI 用的记账 skill（直接喂给 LLM）
```

---

## 🛠️ 故障排查

| 现象 | 对策 |
|---|---|
| 启动报 `Missing config.json` | 见错误信息里的提示 — `cp config.json.example config.json` |
| 启动报 `openpyxl is required` | `pip3 install openpyxl` |
| 浏览器打不开 dashboard | 先 `curl http://127.0.0.1:31889/v1/health` 确认后端起来 |
| 401 Unauthorized | URL 里加 `?token=<你的 token>`，或在 LocalStorage 删 `finance-node-token` 重新输 |
| 端口 31889 被占用 | 改 `runtime/config.json` 的 `port` 字段，或 `lsof -tiTCP:31889 \| xargs kill` |
| 想清空所有数据重来 | `bash server/reset_finance_node_data.sh`（会备份再清空） |
| 升级后功能没出现 | 浏览器硬刷新（Cmd+Shift+R）— Service Worker 缓存了旧 JS |

---

## 🔒 安全建议

1. **`accessToken` 一定要改**。模板里的占位符是公开的，等同没设密码。
2. **不要把 `runtime/config.json` 提交到任何公开 git 仓库**。`.gitignore` 已排除。
3. **不要裸暴露到公网**。Bearer token 没有速率限制，一旦泄露交易数据可被遍历。Tailscale / Cloudflare Tunnel 等私网代理是最低门槛。
4. **定期备份 `runtime/finance.sqlite3`**。脚本已在重大迁移时自动创建 `.before-*` 备份，但日常自己 `cp` 一下也无害。

---

## 📜 License

MIT — 见 [LICENSE](./LICENSE)。

---

## 🙏 致谢 / 演化

由 [Claude Code](https://claude.com/code) 协作开发。从一个生产数据库的 reskin 起步，按 4 个 Phase（基建 / 日常增强 / 创业者业务 / 全局视图）+ 3 个 Quick Win Week 共 ship 了 32 项功能。

详细演化时间线见 git log；想要扩展功能 / 提需求 / 报 bug → GitHub Issues。
