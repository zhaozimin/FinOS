# pages/

> L2 | 父级: ../CLAUDE.md

成员清单

FlowPage.tsx: 全局资金流桑基图与抽屉钻取；三视图 tab 仅 dual 模式显示；整页一屏装下——根容器 = 视口−顶栏−留白的纵向 flex，桑基区 flex-1 吃掉剩余高度（不随数据量变化），标题与 KPI 行同屏可见，极小窗口 560px 保底转页面滚动。（首次引导已搁置，待整套使用教程后重做。）
OverviewPage.tsx: 财务状况看板，widget 化的 KPI 与图表集合；纯报表页，不承载配置入口（仪表盘定制在财务设置）。
LedgerPage.tsx: 流水账本，已删除流水保留原位置并以灰色、红线和操作者信息标注；报销 tab 是全历史欠账清单（不受时间区间限制），二级状态桶按流程划分——待报销(draft+submitted 未出结果)/已驳回/已报销/全部，恰好分区；行内「是否报销」双按钮标记 ⇄ 撤回，报销回款收入行提供核销抽屉入口。KPI 卡「待回款」是钱的维度（含已驳回），与状态桶正交。
SettingsPage.tsx: 财务设置中心，记账模式（personal/dual）总门控在页头滑块；已删除账户保留卡片并展示删除时余额与资产/净资产影响；「仪表盘」面板承载财务状况页的 widget 显隐/排序定制（DashboardCustomizer 入口）。
DesignSystemPage.tsx: 设计系统活文档；色彩令牌实时测量自当前主题，控件（含 Autocomplete/DatePicker/StatusPill）与图表（桑基/饼/柱/线）全部为真实组件。

法则: 审计可见性优先于视觉整洁；汇总只能使用未删除实体。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
