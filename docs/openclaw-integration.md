# OpenClaw / LLM Agent 接入指南

> 把 FinOS 接到 OpenClaw（或任何能调 HTTP 的 LLM agent，如 Claude Skills / GPT Custom GPTs / Cursor Cmd-K Agent）。3 步完成，让 AI 听懂"中午吃了麦当劳花了 38 块"然后自动写一笔交易。

---

## 一、3 步接入

### Step 1: 准备工具描述文件

```bash
cd ~/path/to/FinOS  # 你 clone 的路径
cp server/runtime/openclaw_finance_tools.json.example \
   server/runtime/openclaw_finance_tools.json
```

编辑 `server/runtime/openclaw_finance_tools.json`：

```json
{
  "skillName": "finance_node",
  "baseUrl": "http://127.0.0.1:31889",
  "authorization": {
    "type": "bearer",
    "token": "<你 config.json 里的 accessToken>"
  },
  "tools": [...]
}
```

**远程访问**：如果 agent 跑在另一台机器，把 `baseUrl` 改成 Tailscale hostname：
```json
"baseUrl": "http://<your-mac>.tailxxxx.ts.net:31889"
```

### Step 2: 把 SKILL.md 喂给 Agent

把 [`skills/ai-bookkeeper/SKILL.md`](../skills/ai-bookkeeper/SKILL.md) 的**完整内容**贴进：

| 平台 | 怎么贴 |
|---|---|
| **Claude Project** | Project Knowledge → Add file → 上传 SKILL.md |
| **Claude Custom Instructions**（个人设置） | 整段贴进 "Personal preferences" |
| **GPT Custom GPT** | Configure → Instructions 贴进 |
| **Cursor Agent / Cmd-K** | `.cursor/rules/finance.mdc` 文件，贴进 |
| **OpenClaw** | 在 OpenClaw skill 配置里挂载 SKILL.md + tools.json |
| **API 直接用** | 作为 system prompt 的一部分 |

### Step 3: 把 tools 描述给 Agent

不同平台对 tools/functions 的格式要求不同。`openclaw_finance_tools.json` 里的格式是 **OpenClaw 原生 + 通用 OpenAPI 风格**，可手转 OpenAI / Anthropic functions 格式。

#### 转 OpenAI Functions

```python
import json
src = json.load(open("server/runtime/openclaw_finance_tools.json"))
openai_funcs = []
for tool in src["tools"]:
    openai_funcs.append({
        "type": "function",
        "function": {
            "name": tool["name"],
            "description": tool["description"],
            "parameters": tool.get("inputSchema", {"type":"object","properties":{}})
        }
    })
# 喂给 client.chat.completions.create(..., tools=openai_funcs)
```

#### 转 Anthropic Tools

```python
anthropic_tools = [
    {
        "name": tool["name"],
        "description": tool["description"],
        "input_schema": tool.get("inputSchema", {"type":"object","properties":{}}),
    }
    for tool in src["tools"]
]
# 喂给 client.messages.create(..., tools=anthropic_tools)
```

---

## 二、典型对话演示

### 场景：用户口述 → AI 自动记账

**用户**：「刚在小区便利店买了瓶水，2 块」

**AI 内部流程**：
1. 触发判定：「买了」+「2 块」→ 命中支出
2. 缓存里有 configuration → 直接用
3. 提取字段：
   - amount=2, kind=expense
   - title="便利店买水"（合理推断）
   - merchant="小区便利店"
   - 没说账户 → 用最常用的"微信支付"
   - keyword 匹配：「水」无明确分类 → 用 `{name: "未分类"}` 或 "日用"
4. 调 `finance_add_transaction({amount:2, kind:"expense", accountName:"微信支付", title:"便利店买水", source:"agent"})`
5. 回复：「✓ 已记 ¥2 便利店买水 → 微信支付」

### 场景：批量补记

**用户**：「今天忘记记账了，补一下：早上瑞幸 18.5，中午饿了么 35，晚上麦当劳 42」

**AI 内部流程**：
1. 拆成 3 笔，逐条调 `finance_add_transaction`
2. 全部完成后一次回复：
   ```
   ✓ 补记 3 笔（共 ¥95.5 → 微信支付 / 外卖饮食）
     · 早 ¥18.5 瑞幸
     · 中 ¥35 饿了么
     · 晚 ¥42 麦当劳
   ```

### 场景：查询

**用户**：「我这个月外卖花了多少？」

→ AI 调 `finance_budget_status`，找到"外卖饮食"
→ 回复：「4 月外卖饮食 ¥432 / ¥500（86%，剩 ¥68）」

### 场景：发收据图片 → AI 记账并附图

**用户**：（甩来一张付款截图）「刚交的物业费 1200」

**AI 内部流程**：
1. 正常提取字段 → 调 `finance_add_transaction` → 拿到交易 `id`
2. 运行时把这张图存成了本地文件（网关通常会提示 `[image saved at: /path/xxx.jpg]`）→ 读该文件、Base64 编码
3. 调 `finance_upload_attachment({ id, filename, mime:"image/jpeg", data:<base64> })`
4. 回复：「✓ 已记 ¥1200 物业费 → 招商银行卡，已附收据」

> 细节见 SKILL.md 第十一节。**要点**：模型不能凭"看到的图"还原字节，必须读运行时给出的本地文件（或 Base64 / URL）再上传。

---

## 三、安全建议

1. **token 仅放在 `openclaw_finance_tools.json`**，**不要嵌入 SKILL.md**（SKILL.md 可能被分享、截图、贴 issue）
2. **`openclaw_finance_tools.json` 已被 `.gitignore`**，不会被提交
3. **远程 Agent**（如 cloud-hosted ChatGPT）调本机 FinOS：必须经过 Tailscale 等私网代理，**不要直接公网暴露 31889 端口**
4. AI 写入的 source 应填 `"agent"` / 具体 agent 名，方便 LedgerPage 用 source filter 复核

---

## 四、调试

### 测试连通性

让 AI 先调一次 health：
```python
agent_request = "测试一下我的 FinOS 是否连得上？"
# AI 应该调 finance_get_configuration 或类似工具，返回 200 即通
```

### 看 AI 实际写了什么

在 LedgerPage 用 `?source=agent` 或在搜索框输 `agent` 查所有 AI 写入的交易，肉眼复核字段是否对。

### Common Pitfalls

| 现象 | 原因 |
|---|---|
| AI 总是写到"默认账户" | 没调 configuration → 不知道用户真实账户名。强调 SKILL.md 第九节"第一次激活时" |
| AI 把转账当支出（金额翻倍错） | kind 判定错。强调 SKILL.md 第三节信用卡 / 转账场景 |
| AI 说"已为你记账"但没真调工具 | 工具描述没注册到 agent。检查 functions / tools schema |
| 401 Unauthorized | token 不对 或 baseUrl 写错（http vs https） |
| 发了收据图但没附上 / `data` 为空 | 模型试图"描述图片"而非上传字节。必须读运行时给出的本地文件（或 Base64 / URL）再 Base64 编码，见 SKILL.md 第十一节 |

---

## 五、扩展：让 AI 主动汇报

进阶玩法 — 把 FinOS 接到 daily / weekly 自动化：

```
每周一早 9 点，让 Agent：
1. finance_summary_month(month="本月")
2. finance_budget_status(month="本月")
3. 发一条总结到你的 Slack / 微信：
   "本月已花 ¥X，外卖预算用了 86%，建议..."
```

实现方式：
- macOS：launchd plist + curl 触发 OpenClaw webhook
- 任何 cron 工具 + 简单 Python 脚本

---

## 六、参考

- 完整字段口径：[`docs/ai-recording.md`](./ai-recording.md)
- 后端 API 全表：[`docs/api.md`](./api.md)
- AI 记账 skill：[`skills/ai-bookkeeper/SKILL.md`](../skills/ai-bookkeeper/SKILL.md)
- 工具描述模板：[`server/runtime/openclaw_finance_tools.json.example`](../server/runtime/openclaw_finance_tools.json.example)
