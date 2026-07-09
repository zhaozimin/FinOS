# AI 记账数据格式 · 字段口径与示例

> 本文档面向**写工具描述、prompt、Skill** 的开发者。如果你在写 AI 记账 skill / 让 LLM agent 直接调 FinOS，先读这份。

---

## 总则

- **HTTP**：所有交易数据通过 `POST /v1/transactions` 写入。
- **认证**：`Authorization: Bearer <token>`（token 来自 `runtime/config.json` 的 `accessToken` 字段）。
- **Content-Type**：`application/json`。
- **金额一律用正数**，方向由 `kind` 决定（`expense` / `income` / `transfer`）。
- **时间用 ISO 8601**（如 `"2026-04-29T15:30:00+08:00"`）；缺省 = 服务器当前时间。

---

## 一、最小字段（必填）

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string | 交易标题。建议人类可读：`"瑞幸咖啡"` / `"4 月工资"` |
| `amount` | number | **正数**。`38.50` 表示 ¥38.5 |
| `kind` | string | 三选一：`"expense"` 支出 / `"income"` 收入 / `"transfer"` 转账 |

---

## 二、强烈推荐字段

| 字段 | 类型 | 适用 kind | 说明 |
|---|---|---|---|
| `accountName` | string | expense / income | 账户名（必须与「财务设置 → 账户」里某个账户的 `name` 一字不差） |
| `fromAccountName` | string | transfer | 转出账户 |
| `toAccountName` | string | transfer | 转入账户 |
| `merchant` | string | 任意 | 对方 / 商户名（如 `"瑞幸"` / `"饿了么"`），用于桑基图节点 |
| `category` | object | expense / income | `{id?, name}`，必须与某个分类的 name 匹配；id 可不填 |
| `occurredAt` | string | 任意 | ISO 时间戳；缺省 = 现在 |

---

## 三、按场景分类

### 场景 A：日常生活支出（最常见）

```json
{
  "title": "瑞幸咖啡",
  "amount": 18.5,
  "kind": "expense",
  "accountName": "微信支付",
  "merchant": "瑞幸",
  "category": { "name": "外卖饮食" },
  "tags": ["咖啡"],
  "source": "agent"
}
```

### 场景 B：发工资

```json
{
  "title": "4 月工资",
  "amount": 15000,
  "kind": "income",
  "accountName": "招商银行卡",
  "merchant": "雇主公司全称",
  "category": { "name": "工资收入" },
  "occurredAt": "2026-04-25T10:00:00+08:00",
  "source": "agent"
}
```

### 场景 C：转账（信用卡还款）

```json
{
  "title": "信用卡还款",
  "amount": 3820,
  "kind": "transfer",
  "fromAccountName": "招商银行卡",
  "toAccountName": "招商信用卡",
  "merchant": "招行还款",
  "source": "agent"
}
```

> 信用卡的 `classification = "liability"`，所以"账户余额上升"代表"还款冲减欠款"。
> **不需要**手动算正负，只要 transfer 的 from / to 填对即可。

### 场景 D：经营收入（业务回款 → 计税）

```json
{
  "title": "A 客户项目尾款",
  "amount": 50000,
  "kind": "income",
  "accountName": "经营账户",
  "merchant": "客户公司全称",
  "category": { "name": "服务收入" },
  "projectName": "A 客户项目",
  "counterpartyId": "counterparty-a-client",
  "invoiceIssued": true,
  "taxCategory": "business-income",
  "source": "agent"
}
```

### 场景 E：可抵扣经营支出

```json
{
  "title": "云服务器年付",
  "amount": 4800,
  "kind": "expense",
  "accountName": "经营账户",
  "merchant": "Linode / 阿里云",
  "category": { "name": "云资源" },
  "projectName": "公司运营",
  "taxCategory": "business-expense-deductible",
  "invoiceIssued": true,
  "tags": ["IT", "订阅"],
  "source": "agent"
}
```

### 场景 F：报销（先垫付，后回款）

```json
{
  "title": "出差打车",
  "amount": 156,
  "kind": "expense",
  "accountName": "微信支付",
  "merchant": "滴滴出行",
  "category": { "name": "公司交通" },
  "projectName": "B 客户出差",
  "reimbursementStatus": "draft",
  "tags": ["出差", "待报销"],
  "source": "agent"
}
```

`reimbursementStatus` 五选一：

- `"draft"` — 待提交报销
- `"submitted"` — 已提交，等待审批
- `"reimbursed"` — 已收到报销款
- `"rejected"` — 被驳回
- `"notApplicable"` — 不参与报销（默认）

### 场景 G：外币交易（多币种）

```json
{
  "title": "ChatGPT Plus 订阅",
  "amount": 20,
  "currency": "USD",
  "kind": "expense",
  "accountName": "招商外币卡",
  "merchant": "OpenAI",
  "category": { "name": "会员订阅" },
  "source": "agent"
}
```

后端会自动按 `runtime/config.json` 里的 `exchangeRates.rates['USD']` 折算到本位币（CNY），写入 `amount_in_base_currency` 快照。
**所有聚合（净资产、KPI、报税）都用快照值**，避免历史汇率漂移影响。

---

## 四、字段全表

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | UUID。缺省 = 服务器生成。重复 POST 同 id 会 400 |
| `title` | string | **必填** |
| `amount` | number | **必填**（正数） |
| `kind` | enum | **必填**：`expense` / `income` / `transfer` |
| `occurredAt` | ISO string | 缺省 = now |
| `accountName` | string | expense/income 的主账户（也用于 from / to 推导） |
| `fromAccountName` | string \| null | transfer 必填（转出） |
| `toAccountName` | string \| null | transfer 必填（转入） |
| `merchant` | string | 商户 / 对方名 |
| `category` | `{id?, name}` | 分类对象。建议 name 匹配现有分类，否则自动创建 |
| `projectName` | string \| null | 项目名（必须与 settings.projects[].name 一致） |
| `counterpartyId` | string \| null | 对手方 ID（先 GET /v1/configuration 拿） |
| `tags` | string[] | 自由标签 |
| `note` | string | 备注 |
| `reimbursementStatus` | enum | 见场景 F |
| `invoiceIssued` | boolean | 是否应开 / 已开发票 |
| `invoiceAttachmentId` | string \| null | 发票附件 ID（先 POST /v1/transactions/{id}/attachments 上传） |
| `taxCategory` | enum | `personal` / `business-income` / `business-expense-deductible` / `business-expense-nondeductible` / `transfer`（缺省 personal） |
| `currency` | string | ISO 4217（如 `USD`、`HKD`）。缺省 = 账户币种 |
| `amountInBaseCurrency` | number | 折算到本位币的快照。缺省 = 后端按当前汇率算 |
| `source` | string | 数据来源标记。**AI 写入请填 `"agent"` 或具体 agent 名**（如 `"openclaw"`、`"claude-skill"`），方便后续在 LedgerPage 按来源筛 |
| `sourceName` | string | 桑基图第 1 层节点用 |

---

## 五、写入前最佳实践

1. **先调 `GET /v1/configuration`**，拿到用户的真实账户 / 分类 / 项目 / 对手方列表。**不要凭空生成账户名** — 用户的"微信支付" vs "WeChat Pay" 可能不一致。
2. **金额从用户原话提取**：
   - "差不多 100 块" → 100
   - "三十八块五" → 38.5
   - "150 块左右" → 150
3. **kind 推断**：
   - 关键词"花了 / 买 / 付 / 打" → expense
   - 关键词"收到 / 工资 / 发了" → income
   - 关键词"转 / 还信用卡 / 充值" → transfer
4. **category 可以模糊**：填 `{name: "外卖饮食"}` 即可，后端按 name 找对应 id。
5. **批量记账**：循环调 POST，没有 batch endpoint。建议每条 200ms 间隔避免压力。

---

## 六、写入后验证

```bash
curl -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:31889/v1/summary/month?month=2026-04" | jq
```

返回：
```json
{
  "month": "2026-04",
  "view": "combined",
  "income": 23500,
  "expense": 8730.5,
  "balance": 14769.5,
  "pendingReimbursement": 156,
  "transactionCount": 47
}
```

---

## 七、常见坑

| 坑 | 解决 |
|---|---|
| accountName 找不到 | 报错 400 — 先 GET /v1/configuration 看准确名字 |
| category 没填，写入后归到"未分类" | 先 GET /v1/configuration 取分类列表，按 name 模糊匹配 |
| transfer 没填 from/to | 默认会变成 expense，金额方向错误 |
| occurredAt 写成 `"2026/4/29"` | 部分浏览器接受，建议 ISO 格式 `"2026-04-29T..."` 最稳 |
| 重复同 title+amount+date 多次写入 | 后端**不去重**。AI 应自己维护"已写入"状态 |

---

## 八、如何让 AI "懂" 这些

最佳做法：把 [`skills/ai-bookkeeper/SKILL.md`](../skills/ai-bookkeeper/SKILL.md) 整段贴进你的 Claude Project / GPT Custom Instructions / OpenClaw 的 prompt。SKILL.md 已经包含了：

- 何时触发记账
- 如何从用户对话里提取字段
- 如何选账户 / 分类
- 如何处理模糊金额、日期、转账方向
- 错误重试与多笔记账协议
