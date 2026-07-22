# api/

> L2 | 父级: ../CLAUDE.md

成员清单

client.ts: Finance Node REST 客户端，负责交易查询、配置写入、`includeDeleted` 查询参数及报销核销（settleReimbursement → POST /v1/reimbursements/settle）。

法则: 页面不得直接拼接 HTTP 请求；删除状态必须通过统一契约读取。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
