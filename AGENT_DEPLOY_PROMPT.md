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
- 后端默认监听 127.0.0.1:59418，用一个 Bearer Token 做登录鉴权。

## 前置条件（先检查，缺了先装）

1. `git`：`git --version`
2. `python3` ≥ 3.9：`python3 --version`
3. `pip3` 可用：`pip3 --version`
（不需要 Node.js —— 仓库里已带预构建前端，开箱即跑。）

## 步骤

### 1. 定位源码（你多半已经拿到了）
你很可能**已经有这套源码**了 —— 就在当前目录，或审核方已经把整个文件夹交给了你。先确认：
```
ls server/finance_node_server.py 2>/dev/null && echo "源码已就位" || echo "未找到，需克隆"
```
- **已就位** → `cd` 到含有 `server/` 的那一层目录，直接跳到第 2 步。
- **未找到** → 克隆到**当前目录**再进入（整套系统连数据都自包含在这一个文件夹里，
  我看得见、删得掉；不要装到家目录或其他我看不到的地方）：
```
git clone https://github.com/zhaozimin/FinOS.git ./FinOS && cd FinOS
```
> 若当前目录本身是 git 仓库，请往它的 `.gitignore` 追加一行 `FinOS/`，防止账本被误提交。

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
- 若提示端口 59418 被占用：先查 `lsof -tiTCP:59418`，在确认那不是别的重要
  程序后，可 `kill` 掉它，或改 `server/runtime/config.json` 里的 `port` 再重跑。

> 备选（想在前台看实时日志、按 Ctrl-C 停）：
> `cp server/runtime/config.json.example server/runtime/config.json`，
> 用 `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` 生成一串，
> 填进 config.json 的 `accessToken`，再 `cd server && python3 finance_node_server.py`。

### 4. 取回登录密钥和网址
```
cat server/runtime/connection-info.txt
```
从里面读出 `Token`（就是登录密钥）和本机地址（形如 `http://127.0.0.1:59418`）。

### 5. 验证后端确实活着（必须做）
用上一步的 Token 替换 <TOKEN>：
```
curl -H "Authorization: Bearer <TOKEN>" http://127.0.0.1:59418/v1/health
```
返回里应包含健康状态（ok / healthy 之类）。想更彻底就跑：
`bash server/test_finance_node.sh`（会写一笔测试交易再查回来，最后打印
"Finance Node test passed."）。

### 6. 交付给我（务必完整输出这两样）
部署成功后，请**明确无误**地把下面两样告诉我：

1. **登录密钥（Token）** —— 就是第 4 步 `connection-info.txt` 里那串 `accessToken`，
   原样贴给我。这是唯一的登录凭证。
2. **打开地址**（把 <TOKEN> 换成上面的真实密钥）：
```
http://127.0.0.1:59418/dashboard/?token=<TOKEN>
```

首次用这个带 `?token=` 的地址打开后，密钥会自动存进浏览器；之后直接访问
`http://127.0.0.1:59418/dashboard/` 即可。请把这串密钥妥善保存。

## 安全红线（务必遵守）

- 数据 100% 在本机，别把 `server/runtime/finance.sqlite3` 或 `config.json`
  上传到任何地方、也别提交进 git（仓库 `.gitignore` 已排除）。
- 别把 59418 端口裸暴露到公网。要多设备/远程访问，走 Tailscale 或
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
