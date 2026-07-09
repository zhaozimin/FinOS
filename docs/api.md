# FinOS HTTP API · 全表速查

> 后端 `finance_node_server.py` 暴露的所有 HTTP endpoint。所有非 `/dashboard/*` 的接口都需要 Bearer token。

**Base URL**: `http://127.0.0.1:31889`（本机）或 `http://<your-host>:31889`（远程）

**Auth**: `Authorization: Bearer <accessToken>`（来自 `runtime/config.json`）。
也支持 URL `?token=<...>`（专为 `<img src>` 直链附件设计；其他接口建议用 header）。

---

## 一、健康 / 配置

### `GET /v1/health`
返回服务状态、版本、最后写入时间。无需对手，但仍需要 token。

```bash
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:31889/v1/health
```
```json
{
  "nodeName": "我的财务节点",
  "status": "ok",
  "openClawConnected": true,
  "remoteAccess": "Tailscale",
  "version": "0.1.0",
  "lastIngestedAt": "2026-04-29T20:40:45+00:00"
}
```

### `GET /v1/configuration`
返回完整主数据：账户、分类、项目、对手方、税务、汇率配置。

**AI / 工具调用前必先调一次**，缓存 ~30 分钟。

```json
{
  "accounts": [{"id":"...","name":"微信支付","type":"digitalWallet","ownership":"personal","classification":"asset","currentBalance":1234.5,"currency":"CNY", ...}],
  "categories": [{"id":"...","name":"外卖饮食","keywords":["饭","咖啡","奶茶"],"monthlyBudget":500, ...}],
  "settings": {
    "defaultCurrency": "CNY",
    "projects": [...],
    "counterparties": [...],
    "taxConfig": {...},
    "exchangeRates": {"baseCurrency":"CNY","rates":{"CNY":1,"USD":7.20,...}}
  }
}
```

### `PUT /v1/configuration`
覆盖式保存主数据。**罕用** — 普通操作走 SettingsPage UI，AI 一般只读不写配置。

---

## 二、交易 CRUD

### `GET /v1/transactions`

| 查询参数 | 说明 |
|---|---|
| `view` | `combined` / `company` / `personal` |
| `month` | `YYYY-MM`，按月过滤 |
| `kind` | `income` / `expense` / `transfer` |
| `reimbursementStatus` | `draft` / `submitted` / `reimbursed` / `rejected` / `notApplicable` |
| `tag` | 单个标签 |
| `q` | 模糊匹配标题 / 商户 / 备注 / 分类 / 项目 |
| `categoryId` | 按分类 ID |
| `accountName` | 按账户名（精确） |
| `limit` | 返回上限，缺省全量 |

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:31889/v1/transactions?month=2026-04&kind=expense&limit=50"
```

返回 `Transaction[]`，结构见下方 POST 字段说明。

### `POST /v1/transactions`
新增一笔交易。**AI 写入的核心 endpoint**。

完整字段见 [`docs/ai-recording.md`](./ai-recording.md)。最小示例：
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"瑞幸咖啡","amount":18.5,"kind":"expense","accountName":"微信支付","source":"agent"}' \
  http://127.0.0.1:31889/v1/transactions
```

### `PUT /v1/transactions/{id}`
全量覆盖（缺失字段保留原值）。

### `DELETE /v1/transactions/{id}`
删除一笔交易（同时级联删除其附件物理文件）。

### `PATCH /v1/transactions/{id}/reimbursement`
仅更新报销状态。
```bash
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"submitted"}' \
  http://127.0.0.1:31889/v1/transactions/<id>/reimbursement
```

---

## 三、汇总与分析

### `GET /v1/summary/month?view=combined&month=2026-04`
单月收支净额 / 待报销 / 笔数。

```json
{
  "month":"2026-04","view":"combined",
  "income":23500,"expense":8730.5,"balance":14769.5,
  "pendingReimbursement":156,"transactionCount":47
}
```

### `GET /v1/dashboard/overview?view=combined`
看板大数据：KPI、月度趋势、桑基图、ROI、分类旭日图、账户清单、AI 建议。

### `GET /v1/budget/status?month=2026-04`
本月有月度预算的分类的实际花费 / 占比 / 剩余。

```json
{
  "month":"2026-04",
  "items":[{"categoryId":"...","name":"外卖饮食","budget":500,"spent":432,"remaining":68,"percentUsed":86.4,"color":"#FF8C42"}],
  "totalBudget":2500,"totalSpent":1842,"totalRemaining":658
}
```

---

## 四、附件（发票 / 收据图）

### `POST /v1/transactions/{id}/attachments`
上传一张附件，挂到指定交易。**JSON body 含 base64**（不用 multipart，简化 stdlib http.server 实现）：
```json
{ "filename":"receipt.jpg","mime":"image/jpeg","data":"<base64 encoded bytes>" }
```
单文件 ≤ 10 MB。返回 `AttachmentRef = {id, mime, sizeBytes, originalName, createdAt}`。

### `GET /v1/attachments/{id}`
返回文件流（带 Content-Type）。
**支持 `?token=<...>` URL 参数**，方便 `<img src>` 直接渲染图片。

### `DELETE /v1/attachments/{id}`
删除（DB 行 + 物理文件）。

---

## 五、周期账目（订阅 / 工资 / 房租）

### `GET /v1/recurring`
列出所有规则。

### `POST /v1/recurring`
创建规则。
```json
{
  "name": "Netflix 月度订阅",
  "frequency": "monthly",
  "intervalN": 1,
  "startDate": "2026-05-01",
  "nextDueAt": "2026-05-01",
  "enabled": true,
  "template": {
    "title": "Netflix",
    "amount": 78,
    "kind": "expense",
    "accountName": "招商信用卡",
    "category": { "name": "会员订阅" }
  }
}
```
创建成功后**立刻 catchup**：若 `nextDueAt <= today`，自动按规则生成第一条交易。

### `PUT /v1/recurring/{id}` / `DELETE /v1/recurring/{id}`
更新 / 删除规则。

**catchup 触发时机**：
- 服务启动时（`force=True`）
- 每个认证 GET 请求触发（debounce 30 秒）

---

## 六、Excel 导出

### `GET /v1/export/xlsx?view=combined&from=YYYY-MM-DD&to=YYYY-MM-DD`
下载 5 sheet 工作簿：明细 / 月度 / 分类 / 账户 / 说明。
返回 `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`。

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:31889/v1/export/xlsx?view=combined&from=2026-01-01" \
  -o finance.xlsx
```

### `GET /v1/export/tax-report?year=2026&quarter=2`
下载 5 sheet 报税工作簿：业务收入 / 可抵扣 / 不可抵扣 / 汇总（含预估增值税 + 个税 + 社保） / 说明。
`quarter` 可省 = 全年。

---

## 七、账单导入

### `POST /v1/import/preview`
不写入，只预览解析结果 + 自动匹配建议。
```json
{
  "template": "wechat",
  "content": "<base64 encoded CSV bytes>"
}
```
模板：`wechat` / `alipay` / `cmb` / `generic`。
返回：
```json
{
  "transactions": [{...}],
  "warnings": ["未识别到时间列，默认用导入时间。"],
  "detected_columns": {...},
  "headers": [...],
  "template": "wechat"
}
```

### `POST /v1/import/commit`
批量写入用户确认后的交易。
```json
{ "transactions": [{...}, {...}] }
```
返回：
```json
{ "imported": 47, "failed": 0, "errors": [] }
```

---

## 八、汇率

### `POST /v1/rates/refresh`
手动从 `open.er-api.com` 拉取最新汇率，合并入 `settings.exchangeRates.rates`（保留用户手动加的小币种）。

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:31889/v1/rates/refresh
```
返回更新后的 `exchangeRates` 对象，含 `lastFetchSource` 和 `updatedAt`。

启动时若 `settings.exchangeRates.autoFetch=true`，自动拉一次。

---

## 九、错误响应

所有非 2xx 响应都是 JSON：
```json
{ "error": "Transaction not found" }
```

| HTTP | 含义 |
|---|---|
| 400 | 参数缺失 / 格式错（看 error 字段） |
| 401 | token 无效 |
| 404 | 资源不存在 |
| 413 | 上传文件超 10 MB |
| 500 | 后端异常（看 server log） |
| 503 | 缺依赖（如 openpyxl 没装） |

---

## 十、速率与并发

- 后端用 `ThreadingHTTPServer`，每请求一个线程
- **没有速率限制 / 没有 IP 白名单**：靠 token 隔离
- 写入并发：SQLite WAL 模式（默认），单写多读 OK
- AI 批量记账建议每条间隔 ≥ 200 ms，避免一次性灌入扰乱 lastIngestedAt

---

## 十一、手 Curl 速查表

```bash
TOKEN="<你的 token>"
BASE="http://127.0.0.1:31889"

# 健康
curl -sH "Authorization: Bearer $TOKEN" $BASE/v1/health

# 当月汇总
curl -sH "Authorization: Bearer $TOKEN" "$BASE/v1/summary/month?month=$(date +%Y-%m)"

# 加一笔
curl -sX POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"测试","amount":1,"kind":"expense","accountName":"微信支付","source":"manual"}' \
  $BASE/v1/transactions

# 导出本月 Excel
curl -sH "Authorization: Bearer $TOKEN" \
  "$BASE/v1/export/xlsx?from=$(date +%Y-%m-01)" -o this-month.xlsx

# 拉汇率
curl -sX POST -H "Authorization: Bearer $TOKEN" $BASE/v1/rates/refresh
```
