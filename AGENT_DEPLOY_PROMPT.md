# 一键部署提示词 · 交给编码 Agent

> **怎么用**：把下面「======」之间的整段内容，复制粘贴给任意一个能读写文件、能跑终端命令的编码 Agent（Claude Code / Cursor / Cline / OpenClaw / Codex 等）。它会替你在本机把 FinOS 装好、跑起来，并把访问地址和登录密钥告诉你。
>
> 你不需要懂命令，只要把它交给 Agent，然后照它最后给你的网址打开浏览器即可。

---

```text
======================== FINOS 本机部署任务 ========================

你是一个编码 Agent。你的任务是在【当前这台电脑】上，把一个叫 FinOS 的
本地优先财务工作台部署起来，并跑通。请一步步执行，每步失败就先排错再继续，
不要跳过验证。全程用中文向我汇报进度。

## 关于 FinOS（背景，帮你理解，不用背）

- 一个本地记账 / 财务管理系统：Python 标准库写的 HTTP 后端 + SQLite 数据库
  + 预构建好的 React 网页前端（PWA）。
- 全部数据只存在本机的一个 SQLite 文件里，无云、无外部依赖、无追踪。
- 后端默认监听 127.0.0.1:31889，用一个 Bearer Token 做登录鉴权。

## 前置条件（先检查，缺了先装）

1. `git`：`git --version`
2. `python3` ≥ 3.9：`python3 --version`
3. `pip3` 可用：`pip3 --version`
（不需要 Node.js —— 仓库里已带预构建前端，开箱即跑。）

## 步骤

### 1. 克隆仓库
把仓库克隆到我的用户目录下一个明确位置（例如 `~/FinOS`），并进入：
```
git clone https://github.com/zhaozimin/FinOS.git ~/FinOS
cd ~/FinOS
```
如果 `~/FinOS` 已存在，改用 `~/FinOS-app` 之类不冲突的名字，并告诉我最终路径。

### 2. 安装唯一的 Python 依赖
```
pip3 install openpyxl
```
如果报权限/环境错误，改用二选一并告诉我用了哪种：
- `python3 -m pip install --user openpyxl`
- 或建虚拟环境：`python3 -m venv .venv && . .venv/bin/activate && pip install openpyxl`
（venv 方式后续所有 `python3` 命令都要在激活的环境里跑。）

### 3. 一键起服务（自动生成配置 + 随机登录密钥）
```
bash server/install_and_start_finance_node.sh
```
这个脚本会自动：创建 `server/runtime/config.json`、生成一个随机 accessToken、
在后台启动后端，并打印一段「连接信息」。

- 若这台机器没有 `screen`，脚本会自动用 `nohup` 后台启动，正常。
- 若提示端口 31889 被占用：先查 `lsof -tiTCP:31889`，在确认那不是别的重要
  程序后，可 `kill` 掉它，或改 `server/runtime/config.json` 里的 `port` 再重跑。

> 备选（想在前台看实时日志、按 Ctrl-C 停）：
> `cp server/runtime/config.json.example server/runtime/config.json`，
> 用 `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` 生成一串，
> 填进 config.json 的 `accessToken`，再 `cd server && python3 finance_node_server.py`。

### 4. 取回登录密钥和网址
```
cat server/runtime/connection-info.txt
```
从里面读出 `Token`（就是登录密钥）和本机地址（形如 `http://127.0.0.1:31889`）。

### 5. 验证后端确实活着（必须做）
用上一步的 Token 替换 <TOKEN>：
```
curl -H "Authorization: Bearer <TOKEN>" http://127.0.0.1:31889/v1/health
```
返回里应包含健康状态（ok / healthy 之类）。想更彻底就跑：
`bash server/test_finance_node.sh`（会写一笔测试交易再查回来，最后打印
"Finance Node test passed."）。

### 6. 交付给我
给我最终可直接打开的地址（把 <TOKEN> 换成真实值）：
```
http://127.0.0.1:31889/dashboard/?token=<TOKEN>
```
并单独把 **登录密钥（Token）** 明文告诉我一次，让我记下来。
首次用这个带 `?token=` 的网址打开后，密钥会自动存进浏览器，之后直接访问
`http://127.0.0.1:31889/dashboard/` 即可。

## 安全红线（务必遵守）

- 数据 100% 在本机，别把 `server/runtime/finance.sqlite3` 或 `config.json`
  上传到任何地方、也别提交进 git（仓库 `.gitignore` 已排除）。
- 别把 31889 端口裸暴露到公网。要多设备/远程访问，走 Tailscale 或
  Cloudflare Tunnel，见仓库 `docs/tailscale-setup.md`。
- Token 就是唯一的锁，别写进任何会外传的地方。

## 首次上手（部署完可顺带提醒我）

打开后进入「财务设置」：改/删默认账户 → 加我自己的账户（微信/银行卡/信用卡/现金）
→ 给每个账户填「当前余额」→ 到「资金流水」开始记账。想让 AI 帮我记账，
见仓库 `skills/ai-bookkeeper/SKILL.md` 和 `docs/ai-recording.md`。

==================================================================
```

---

## 部署完还能做什么

- **让 AI 帮你记账**：把 [`skills/ai-bookkeeper/SKILL.md`](./skills/ai-bookkeeper/SKILL.md) 贴进你的 AI 助手，它就能听懂「中午吃麦当劳花了 38」并自动记账。字段口径见 [`docs/ai-recording.md`](./docs/ai-recording.md)。
- **多设备访问**：见 [`docs/tailscale-setup.md`](./docs/tailscale-setup.md)。
- **完整功能手册**：本地打开 [`docs/guides/features-guide.html`](./docs/guides/features-guide.html)。
