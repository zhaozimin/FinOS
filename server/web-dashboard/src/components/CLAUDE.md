# components/

> L2 | 父级: ../CLAUDE.md

成员清单

Layout.tsx: 应用骨架，侧边栏 + 主内容区的布局容器。
Sidebar.tsx: 导航侧边栏，时间区间选择（Autocomplete size="sm"）与页面入口；导航分两个体系——设计系统在分隔线上方，财务管理在下方。
ProductLogo.tsx: 系统内品牌标识（FinOS.）；登录页个人签名归 TokenGate，两者职责互斥。
TokenGate.tsx: 登录门，令牌校验与登录页品牌呈现（FinOS. 品牌；帮助链接指向 GitHub 开源仓库）。
ThemeProvider.tsx / ThemeSwitcher.tsx: 主题上下文注入与明暗/配色切换。
StatusIndicator.tsx: 服务连接状态指示。
TransactionEditSheet.tsx: 交易新增/编辑弹层，报销流程第一、二步（记垫付、收回款）的入口。
TransactionDrawer.tsx: 交易列表抽屉，饼图/看板钻取的通用容器。
ReimbursementPieCard.tsx: 报销进度扇形图，消费 lib/reimbursement 的状态语义。
ReimbursementPill.tsx: 报销状态行内原语（是否报销双按钮 ReimbursementActions/展示 Tag/核销入口），状态→图标/文案的唯一事实源；rejected 统一叫「已驳回」（非终态，可二次报销仍计入待回款）；遵守 StatusPill 对比度铁律。
ReimbursementSettleSheet.tsx: 回款核销对账抽屉，报销流程第三步——勾选一笔回款覆盖的垫付并批量核销/撤销。
AdjustmentHistoryDrawer.tsx: 余额调整历史抽屉。
AttachmentLightbox.tsx: 附件预览与删除灯箱。
GlobalSearchPalette.tsx: 全局搜索命令面板。
DashboardCustomizer.tsx: 看板 widget 显隐与排序定制。
BudgetProgressCard.tsx / SavingsGoalCard.tsx / CashflowForecastCard.tsx / SubscriptionsCard.tsx: 看板业务卡片（预算/储蓄目标/现金流预测/订阅）。
InvoiceWorkbench.tsx: 发票工作台，dual 模式的开票追踪。
ProjectPLDrawer.tsx: 项目损益抽屉。
TimeRangePicker.tsx / ViewSwitcher.tsx: 时间区间与视图切换控件。
charts/: EChart 壳、主题语义色与桑基/旭日/柱/线/环形阈值等图表实现。
ui/: 基础 UI 原子（Autocomplete/DatePicker/Modal/StatusPill/SegmentedSwitch 等），设计系统页的事实来源。

法则: 业务组件消费 lib 的领域判定，不得私造状态语义；弹层统一走 Modal（z-80），确认/通知一律用 ui/AlertDialog（z-95），全站禁用原生 confirm/alert；滚动锁只走 useBodyScrollLock，禁止裸操 body.style。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
