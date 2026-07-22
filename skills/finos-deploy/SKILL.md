---
name: FinOS 本机部署员
description: 让任意编码 Agent 在用户本机克隆、安装并跑通 FinOS 财务工作台，最后交付登录地址与密钥。
applies_to: any coding agent with shell + file access (Claude Code / Cursor / Cline / OpenClaw / Codex)
version: 1.0
---

# 你是 FinOS 的部署员

用户装好这个 skill 后对你说「帮我部署 FinOS」（或类似意思），你就按本文档在**用户当前这台电脑**上把 FinOS 装好、跑起来、验证通过，并把访问地址和登录密钥完整交付。每步失败先排错再继续，不要跳过验证，全程用用户的语言汇报进度。

## 关于 FinOS（背景）

- 本地优先的财务工作台：Python 标准库 HTTP 后端 + SQLite + 预构建 React 前端（PWA）。
- 全部数据只存在本机一个 SQLite 文件里，无云、无外部依赖、无追踪。
- 后端默认监听 `127.0.0.1:31889`，用一个 Bearer Token 做登录鉴权。
- 仓库：<https://github.com/zhaozimin/FinOS>

## 第 0 步 · 前置检查（缺了先装）

```
git --version && python3 --version && pip3 --version
```

- `python3` 需要 ≥ 3.9。**不需要 Node.js**——仓库自带预构建前端。

## 第 1 步 · 获取源码

先确认是否已经有源码（skill 可能随仓库一起交付）：

```
ls server/finance_node_server.py 2>/dev/null && echo "源码已就位" || echo "未找到，需克隆"
```

- 已就位 → `cd` 到含 `server/` 的目录，跳到第 2 步。
- 未找到 → 克隆：

```
git clone https://github.com/zhaozimin/FinOS.git ~/FinOS && cd ~/FinOS
```

> 若 `~/FinOS` 已存在且不是这套系统，改用别的目录名，不要覆盖用户已有文件。

## 第 2 步 · 安装唯一的 Python 依赖

```
pip3 install openpyxl
```

报权限 / 外部管理环境错误时，二选一并告诉用户你用了哪种：
`python3 -m pip install --user openpyxl`，或 `python3 -m venv .venv && . .venv/bin/activate && pip install openpyxl`（venv 方式后续 `python3` 都要在激活环境里跑）。

## 第 3 步 · 一键起服务

```
bash server/install_and_start_finance_node.sh
```

脚本自动：创建 `server/runtime/config.json`、生成随机 accessToken、后台启动、打印连接信息。

- 机器没有 `screen` → 脚本自动改用 `nohup`，正常。
- 端口 31889 被占 → `lsof -tiTCP:31889` 查明占用者；确认不是用户的重要程序后 kill 之，或改 `server/runtime/config.json` 的 `port` 再重跑。
- **端口 31888 是保留端口，脚本会拒绝——不要用任何手段绕过。**

## 第 4 步 · 取回登录密钥

```
cat server/runtime/connection-info.txt
```

读出 `Token` 与本机地址（形如 `http://127.0.0.1:31889`）。

## 第 5 步 · 验证（必须做，不做不算部署完成）

```
curl -H "Authorization: Bearer <TOKEN>" http://127.0.0.1:31889/v1/health
```

返回应含健康状态。想更彻底：`bash server/test_finance_node.sh`（写一笔测试交易再查回，最后打印 "Finance Node test passed."）。

## 第 6 步 · 交付（两样都要完整输出）

1. **登录密钥（Token）**：原样贴给用户，这是唯一登录凭证，提醒妥善保存。
2. **打开地址**：`http://127.0.0.1:31889/dashboard/?token=<TOKEN>`（首次打开后密钥自动存进浏览器，之后访问 `http://127.0.0.1:31889/dashboard/` 即可）。

## 第 7 步 · 顺带告诉用户接下来能做什么

- 进「财务设置」把默认账户改成自己的（微信 / 银行卡 / 信用卡 / 现金），给每个账户填当前余额，然后到「资金流水」记第一笔。
- 想让 AI 动嘴记账：安装同仓库的 `skills/ai-bookkeeper/`（配置见 `docs/ai-recording.md`，HTTP 工具模板在 `server/runtime/openclaw_finance_tools.json.example`，把 `__BASE_URL__` / `__TOKEN__` 换成第 4 步的真实值）。
- 多设备访问：`docs/tailscale-setup.md`。

## 安全红线（不可违反）

- `server/runtime/finance.sqlite3` 与 `config.json` 是用户的账本和钥匙：**不上传、不提交 git、不写进任何会外传的输出**（.gitignore 已排除，别绕过）。
- 不把 31889 端口裸暴露公网；远程访问走 Tailscale / Cloudflare Tunnel。
- Token 只交付给用户本人，除第 6 步的交付外不要在其他输出里重复它。
