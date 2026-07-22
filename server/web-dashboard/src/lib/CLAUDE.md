# lib/

> L2 | 父级: ../CLAUDE.md

成员清单

financeAnalytics.ts: 纯财务分析与图表模型转换；在不改变原始流水的前提下，过滤会破坏 ECharts 无环约束的资金流连线。
reimbursement.ts: 报销领域模型；状态元数据与 isReimbursable/isPendingReimbursement/isReimbursementIncome 判定，供饼图卡、流水页、核销抽屉共享同一套语义。
format.ts: 金额、日期与文案的展示格式化工具。
themes.ts: 仪表盘主题预设与配色定义。
timeRange.ts: 时间粒度、区间键与流水筛选规则。
useApi.ts: 页面异步 API 请求状态 hook。
useBodyScrollLock.ts: 弹层打开期间的页面滚动锁定 hook；只锁 overflow，不做 padding 补偿——滚动条占位由全局 scrollbar-gutter: stable 承担，二者叠加会导致抖动+白边（历史教训）。

法则: 此目录只做纯转换与 UI 基础能力；不得在这里写入账本或绕过 API 客户端。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
