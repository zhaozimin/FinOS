# web-dashboard/
> L2 | 父级: ../CLAUDE.md

成员清单
src/: React 页面、API 客户端与类型契约；LedgerPage 呈现流水删除状态，SettingsPage 呈现账户删除状态，分析层会过滤无法被无环桑基图表达的循环连线。
package.json: 前端构建与开发命令；build 将产物输出为 dist/。
vite.config.ts: 本地开发代理与静态构建规则。

法则: 删除状态必须来自 API，不以 localStorage 伪造；所有类型变更先与后端契约同步。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
