/**
 * [INPUT]: 依赖 configuration/transactions/budget API、store/dashboardLayout 的 widget 布局、
 *   各看板卡片组件与 lib/financeAnalytics 汇总。
 * [OUTPUT]: 对外提供 OverviewPage —— 财务状况看板，widget 化的 KPI 与图表集合。
 * [POS]: 纯报表页——不承载任何配置入口；widget 显隐/排序在「财务设置 → 仪表盘」中调整。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { EChartsOption } from "echarts";
import { Activity, BellRing, Landmark, TrendingUp } from "lucide-react";
import { Card, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { CategoryTabs } from "../components/ui/Tabs";
import { ThresholdRingChart } from "../components/charts/ThresholdRingChart";
import { EChart } from "../components/charts/EChart";
import { BudgetProgressCard } from "../components/BudgetProgressCard";
import { SavingsGoalCard, buildSavingsGoalSummaries } from "../components/SavingsGoalCard";
import { CashflowForecastCard } from "../components/CashflowForecastCard";
import { SubscriptionsCard } from "../components/SubscriptionsCard";
import { InvoiceWorkbench } from "../components/InvoiceWorkbench";
import { ReimbursementPieCard } from "../components/ReimbursementPieCard";
import { isReimbursable } from "../lib/reimbursement";
import { TransactionDrawer } from "../components/TransactionDrawer";
import { TransactionEditSheet } from "../components/TransactionEditSheet";
import { api } from "../api/client";
import { useApi } from "../lib/useApi";
import { formatCurrency } from "../lib/format";
import { useTimeRangeStore } from "../store/timeRange";
import { useThemeStore } from "../store/theme";
import { useDashboardLayoutStore, type DashboardWidgetId } from "../store/dashboardLayout";
import { getPalette, getSeriesPalette } from "../components/charts/theme";
import {
  accountBalance,
  accountOwnershipMap,
  filterTransactions,
  summarizeTax,
  summarizeTransactions,
} from "../lib/financeAnalytics";
import type { Account, Transaction } from "../types";

type AreaMode = "income" | "net";

interface DrawerState {
  title: string;
  description?: string;
  transactions: Transaction[];
}

const AREA_OPTIONS: Array<{ value: AreaMode; label: string }> = [
  { value: "income", label: "收入" },
  { value: "net", label: "净额" },
];

export function OverviewPage() {
  const dimension = useTimeRangeStore((s) => s.dimension);
  const bucket = useTimeRangeStore((s) => s.bucket);
  const [areaMode, setAreaMode] = useState<AreaMode>("income");
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const widgetLayout = useDashboardLayoutStore((s) => s.widgets);
  const resolved = useThemeStore((s) => s.resolved);
  const paletteId = useThemeStore((s) => s.palette);
  const palette = getPalette(resolved === "dark", paletteId);
  const series = useMemo(
    () => getSeriesPalette(resolved === "dark", paletteId),
    [resolved, paletteId],
  );
  const accentColors = useMemo(
    () => ({
      income: series[0] ?? palette.brandBlue,
      cost: series[4] ?? palette.brandOrange,
      revenue: series[2] ?? palette.success,
      life: series[4] ?? palette.brandOrange,
      work: series[0] ?? palette.brandBlue,
    }),
    [series, palette],
  );

  const { data: configuration, loading: configLoading, error: configError, refresh: refreshConfig } = useApi(
    () => api.configuration(),
    [],
  );
  const { data: transactionData, loading: txLoading, error: txError, refresh: refreshTx } = useApi(
    () => api.listTransactions({ limit: 3000 }),
    [],
  );
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const { data: budgetStatus, refresh: refreshBudget } = useApi(
    () => api.budgetStatus({ month: currentMonth }),
    [currentMonth],
  );
  const { data: recurringRules } = useApi(() => api.listRecurring(), []);

  const accounts = configuration?.accounts || [];
  const projects = configuration?.settings?.projects || [];
  const exchangeRates = configuration?.settings?.exchangeRates?.rates;
  const transactions = transactionData || [];
  const filtered = useMemo(
    () => filterTransactions(transactions, accounts, "combined", dimension, bucket),
    [accounts, bucket, dimension, transactions],
  );
  const savingsGoals = useMemo(
    () => buildSavingsGoalSummaries(projects, accounts, transactions),
    [projects, accounts, transactions],
  );
  const projectBudgetMap = useMemo(() => {
    const map = new Map<string, { expectedCost: number; expectedRevenue: number }>();
    for (const p of projects) {
      map.set(p.name, {
        expectedCost: p.expectedCost || 0,
        expectedRevenue: p.expectedRevenue || 0,
      });
    }
    return map;
  }, [projects]);
  const taxConfig = configuration?.settings?.taxConfig;
  const taxStats = useMemo(() => summarizeTax(transactions, taxConfig), [transactions, taxConfig]);
  const summary = useMemo(() => summarizeTransactions(filtered), [filtered]);
  const incomeTrend = useMemo(() => buildIncomeTrend(filtered), [filtered]);
  const projectBars = useMemo(() => buildProjectCostRevenue(filtered), [filtered]);
  const workLife = useMemo(() => buildWorkLifeExpense(filtered, accounts), [accounts, filtered]);
  const thresholdAccounts = useMemo(
    () =>
      accounts
        .filter((account) => (account.threshold || 0) > 0)
        .map((account) => ({
          name: account.name,
          current: account.currentBalance || 0,
          threshold: account.threshold || 0,
          color: account.tintHex,
          lowZone: account.thresholdZones?.low,
          midZone: account.thresholdZones?.mid,
        })),
    [accounts],
  );

  const loading = (configLoading && !configuration) || (txLoading && !transactionData);
  const error = configError || txError;

  const openDrawer = useCallback((nextDrawer: DrawerState) => {
    setDrawer(nextDrawer);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawer(null);
  }, []);

  const openEditor = useCallback((tx: Transaction) => {
    setEditTarget(tx);
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditTarget(null);
  }, []);

  const onSaved = useCallback((saved: Transaction) => {
    setEditorOpen(false);
    setEditTarget(null);
    setDrawer((current) =>
      current
        ? {
            ...current,
            transactions: current.transactions.map((tx) => (tx.id === saved.id ? saved : tx)),
          }
        : current,
    );
    refreshConfig();
    refreshTx();
    refreshBudget();
  }, [refreshConfig, refreshTx, refreshBudget]);

  const onDeleted = useCallback((id: string) => {
    setEditorOpen(false);
    setEditTarget(null);
    setDrawer((current) =>
      current
        ? {
            ...current,
            transactions: current.transactions.filter((tx) => tx.id !== id),
          }
        : current,
    );
    refreshConfig();
    refreshTx();
    refreshBudget();
  }, [refreshConfig, refreshTx, refreshBudget]);

  if (loading) return <div className="h-[760px] rounded-lg bg-muted animate-pulse" />;
  if (error) {
    return (
      <Card>
        <h2 className="text-display-sm mb-2">无法加载财务状况</h2>
        <p className="text-body-sm text-muted-foreground mb-4">{error.message}</p>
        <Button
          onClick={() => {
            refreshConfig();
            refreshTx();
          }}
        >
          重试
        </Button>
      </Card>
    );
  }

  const widgetRenderers: Record<DashboardWidgetId, () => ReactNode> = {
    "status-cards": () => (
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <StatusCard icon={<Landmark size={18} />} label="净资产" value={formatCurrency(accountBalance(accounts, undefined, exchangeRates))} />
        <StatusCard icon={<TrendingUp size={18} />} label="区间收入" value={formatCurrency(summary.income)} tone="good" />
        <StatusCard icon={<Activity size={18} />} label="区间支出" value={formatCurrency(summary.expense)} tone="warn" />
        <StatusCard icon={<BellRing size={18} />} label="区间净额" value={formatCurrency(summary.net)} tone={summary.net >= 0 ? "good" : "warn"} />
      </section>
    ),
    "invoice-workbench": () => (
      <Card padding="none">
        <div className="border-b border-border px-5 py-4">
          <CardTitle description="按需打开。汇总所有勾选了「已开 / 应开发票」的交易，按状态分组（应开未上传 / 已绑定 / 全部）。">
            发票工作台
          </CardTitle>
        </div>
        <div className="px-5 py-5">
          <InvoiceWorkbench
            transactions={transactions}
            onSelectTransaction={(tx) => openEditor(tx)}
          />
        </div>
      </Card>
    ),
    "reimbursement-pie": () => (
      <Card padding="none">
        <div className="border-b border-border px-5 py-4">
          <CardTitle description="所有标记了报销状态的支出（不随统计区间过滤），点击扇区查看对应流水。">
            报销总览
          </CardTitle>
        </div>
        {transactions.some(isReimbursable) ? (
          <div className="px-5 py-5">
            <ReimbursementPieCard
              transactions={transactions}
              onSelect={(_status, label, items) =>
                openDrawer({
                  title: `报销 · ${label}`,
                  description: `${items.length} 笔，合计 ${formatCurrency(items.reduce((sum, tx) => sum + tx.amount, 0))}。点击任意一笔可修改报销状态。`,
                  transactions: items,
                })
              }
            />
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">
            还没有报销相关的支出 — 记账时说明"可以报销"，或在「编辑流水」里把报销状态设为「待报销」。
          </div>
        )}
      </Card>
    ),
    "tax-kpi": () =>
      taxStats.transactionCount > 0 || taxStats.businessIncome > 0 || taxStats.deductible > 0 ? (
        <Card padding="none">
          <div className="border-b border-border px-5 py-4">
            <CardTitle description={`${taxStats.label} · 基于交易上的「税务分类」字段汇总，仅供参考。详细配置在「财务设置 → 税务设置」。`}>
              税务概览（{taxStats.label}）
            </CardTitle>
          </div>
          <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-4">
            <StatusCard icon={<TrendingUp size={18} />} label="业务收入" value={formatCurrency(taxStats.businessIncome)} tone="good" />
            <StatusCard icon={<Activity size={18} />} label="可抵扣支出" value={formatCurrency(taxStats.deductible)} tone="warn" />
            <StatusCard icon={<Landmark size={18} />} label="净利润" value={formatCurrency(taxStats.profit)} tone={taxStats.profit >= 0 ? "good" : "warn"} />
            <StatusCard icon={<BellRing size={18} />} label="预估个税" value={formatCurrency(taxStats.personalTaxEstimate)} tone="warn" />
          </div>
          <div className="border-t border-border px-5 py-3 text-[12px] text-muted-foreground">
            预估增值税 {formatCurrency(taxStats.vatEstimate)} · 预估社保/公积金 {formatCurrency(taxStats.sebEstimate)} · 不可抵扣支出 {formatCurrency(taxStats.nondeductible)}
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="border-b border-border px-5 py-4">
            <CardTitle description={`${taxStats.label} 暂无标记为业务收入 / 可抵扣的交易。在编辑流水时设置「税务分类」字段，这里就会出现汇总。`}>
              税务概览（{taxStats.label}）
            </CardTitle>
          </div>
          <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">
            还没有税务相关的交易 — 在「编辑流水」底部选择税务分类。
          </div>
        </Card>
      ),
    "budget-progress": () =>
      budgetStatus && budgetStatus.items.length > 0 ? (
        <Card padding="none">
          <div className="border-b border-border px-5 py-4">
            <CardTitle description={`本月（${budgetStatus.month}）有预算的支出分类，点击查看相关流水。`}>
              预算进度
            </CardTitle>
          </div>
          <div className="px-5 py-5">
            <BudgetProgressCard
              items={budgetStatus.items}
              totalBudget={budgetStatus.totalBudget}
              totalSpent={budgetStatus.totalSpent}
              totalRemaining={budgetStatus.totalRemaining}
              month={budgetStatus.month}
              onItemClick={(item) =>
                openDrawer({
                  title: `${item.name} · ${budgetStatus.month} 流水`,
                  description: `预算 ${formatCurrency(item.budget)}，已花 ${formatCurrency(item.spent)}（${item.percentUsed.toFixed(1)}%）。`,
                  transactions: filtered.filter(
                    (tx) =>
                      tx.kind === "expense" &&
                      tx.category?.id === item.categoryId &&
                      tx.occurredAt.slice(0, 7) === budgetStatus.month,
                  ),
                })
              }
            />
          </div>
        </Card>
      ) : null,
    "savings-goals": () =>
      savingsGoals.length > 0 ? (
        <Card padding="none">
          <div className="border-b border-border px-5 py-4">
            <CardTitle description="给项目设置目标金额与日期，进度根据账户余额或项目收入累加。">
              储蓄目标
            </CardTitle>
          </div>
          <div className="px-5 py-5">
            <SavingsGoalCard
              summaries={savingsGoals}
              onClick={(project) =>
                openDrawer({
                  title: `${project.name} · 项目流水`,
                  description: project.goal?.description || `目标 ${formatCurrency(project.goal?.targetAmount || 0)}`,
                  transactions: transactions.filter((tx) => tx.projectName === project.name),
                })
              }
            />
          </div>
        </Card>
      ) : null,
    "cashflow-forecast": () =>
      recurringRules && recurringRules.some((r) => r.enabled) ? (
        <Card padding="none">
          <div className="border-b border-border px-5 py-4">
            <CardTitle description="基于周期账目规则推算未来 30/60/90 天的累计净额。">
              现金流预测
            </CardTitle>
          </div>
          <div className="px-5 py-5">
            <CashflowForecastCard rules={recurringRules} />
          </div>
        </Card>
      ) : null,
    "subscriptions": () =>
      recurringRules && recurringRules.some((r) => r.enabled) ? (
        <Card padding="none">
          <div className="border-b border-border px-5 py-4">
            <CardTitle description="按金额倒序列出所有月度支出规则，便于审视开支结构。">
              月度订阅
            </CardTitle>
          </div>
          <div className="px-5 py-5">
            <SubscriptionsCard rules={recurringRules} />
          </div>
        </Card>
      ) : null,
    "income-area": () => (
      <Card padding="none">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <CardTitle description="完整宽度展示区间收入，点击曲线节点查看对应月份流水。">
            收入曲线
          </CardTitle>
          <CategoryTabs value={areaMode} onChange={setAreaMode} options={AREA_OPTIONS} />
        </div>
        <div className="px-5 py-5">
          <IncomeAreaChart
            data={incomeTrend}
            mode={areaMode}
            palette={palette}
            color={accentColors.income}
            onSelect={(label, items) =>
              openDrawer({
                title: `${label} ${areaMode === "income" ? "收入流水" : "收支流水"}`,
                description: "来自 Area Chart - Interactive 的节点选择。",
                transactions: items,
              })
            }
          />
        </div>
      </Card>
    ),
    "project-bars": () => (
      <Card padding="none">
        <div className="border-b border-border px-5 py-4">
          <CardTitle description="实心 = 实际发生；描边虚心 = 项目预算 / 期望（在「项目管理」面板设置）。">
            项目成本与回款
          </CardTitle>
        </div>
        <div className="px-5 py-5">
          <ProjectBarChart
            data={projectBars}
            budgetMap={projectBudgetMap}
            palette={palette}
            costColor={accentColors.cost}
            revenueColor={accentColors.revenue}
            onSelect={(project, items) =>
              openDrawer({
                title: `${project} 项目流水`,
                description: "当前项目的成本与回款明细。",
                transactions: items,
              })
            }
          />
        </div>
      </Card>
    ),
    "work-life-stacked": () => (
      <Card padding="none">
        <div className="border-b border-border px-5 py-4">
          <CardTitle description="浅色为生活支出，深色为工作支出，点击柱体查看当月流水。">
            支出比例
          </CardTitle>
        </div>
        <div className="px-5 py-5">
          <WorkLifeStackedChart
            data={workLife}
            palette={palette}
            lifeColor={accentColors.life}
            workColor={accentColors.work}
            onSelect={(label, ownership, items) =>
              openDrawer({
                title: `${label} ${ownership === "personal" ? "生活支出" : "工作支出"}`,
                description: "来自堆叠支出图的流水明细。",
                transactions: items,
              })
            }
          />
        </div>
      </Card>
    ),
    "account-rings": () => (
      <Card padding="none">
        <div className="border-b border-border px-5 py-4">
          <CardTitle description="展示账户当前余额与额度阈值，点击圆环或右侧账户查看相关流水。">
            账户进度
          </CardTitle>
        </div>
        <div className="px-5 py-5">
          <ThresholdRingChart
            accounts={thresholdAccounts}
            height={360}
            onAccountClick={(account) =>
              openDrawer({
                title: `${account.name} 账户流水`,
                description: `当前余额 ${formatCurrency(account.current)}，额度阈值 ${formatCurrency(account.threshold)}。`,
                transactions: transactionsForAccount(filtered, account.name),
              })
            }
          />
        </div>
      </Card>
    ),
  };

  return (
    <div className="space-y-5">
      {widgetLayout.map((w) => {
        if (!w.visible) return null;
        const renderer = widgetRenderers[w.id];
        if (!renderer) return null;
        const node = renderer();
        if (!node) return null;
        return <div key={w.id}>{node}</div>;
      })}

      <TransactionDrawer
        open={Boolean(drawer)}
        title={drawer?.title || ""}
        description={drawer?.description}
        transactions={drawer?.transactions || []}
        onClose={closeDrawer}
        onEdit={openEditor}
      />

      <TransactionEditSheet
        open={editorOpen}
        initial={editTarget}
        onClose={closeEditor}
        onSaved={onSaved}
        onDeleted={onDeleted}
      />
    </div>
  );
}

function StatusCard({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn";
}) {
  const color = {
    neutral: "text-foreground",
    good: "text-success",
    warn: "text-primary",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-card/90 p-4">
      <div className="mb-3 flex items-center gap-3 text-muted-foreground">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-muted">{icon}</span>
        <span className="text-caption">{label}</span>
      </div>
      <div className={`text-display-sm tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function IncomeAreaChart({
  data,
  mode,
  palette,
  color,
  onSelect,
}: {
  data: ReturnType<typeof buildIncomeTrend>;
  mode: AreaMode;
  palette: ReturnType<typeof getPalette>;
  color: string;
  onSelect: (label: string, transactions: Transaction[]) => void;
}) {
  if (!data.labels.length) return <div className="empty-state">当前区间暂无收入数据。</div>;

  const option: EChartsOption = {
    tooltip: { trigger: "axis" },
    grid: { top: 28, right: 24, bottom: 36, left: 60 },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: data.labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: palette.hairline } },
      axisLabel: { color: palette.muted },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: palette.muted, formatter: formatAxisCurrency },
      splitLine: { lineStyle: { color: palette.hairline } },
    },
    series: [
      {
        name: mode === "income" ? "区间收入" : "区间净额",
        type: "line",
        smooth: true,
        symbolSize: 8,
        data: mode === "income" ? data.income : data.net,
        lineStyle: { width: 2.5, color },
        itemStyle: { color },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${color}80` },
              { offset: 1, color: `${color}10` },
            ],
          },
        },
      },
    ],
  };

  return (
    <EChart
      option={option}
      style={{ height: 360 }}
      onChartClick={(params) => {
        const index = Number(params.dataIndex);
        const label = data.labels[index];
        if (!label) return;
        onSelect(label, mode === "income" ? data.incomeTransactions.get(label) || [] : data.allTransactions.get(label) || []);
      }}
    />
  );
}

function ProjectBarChart({
  data,
  budgetMap,
  palette,
  costColor,
  revenueColor,
  onSelect,
}: {
  data: ReturnType<typeof buildProjectCostRevenue>;
  budgetMap: Map<string, { expectedCost: number; expectedRevenue: number }>;
  palette: ReturnType<typeof getPalette>;
  costColor: string;
  revenueColor: string;
  onSelect: (project: string, transactions: Transaction[]) => void;
}) {
  if (!data.projects.length) return <div className="empty-state">当前区间暂无项目成本与回款数据。</div>;

  const expectedCost = data.projects.map((name) => Number((budgetMap.get(name)?.expectedCost || 0).toFixed(2)));
  const expectedRevenue = data.projects.map((name) => Number((budgetMap.get(name)?.expectedRevenue || 0).toFixed(2)));
  const hasAnyBudget = expectedCost.some((v) => v > 0) || expectedRevenue.some((v) => v > 0);

  const option: EChartsOption = {
    grid: { top: 36, bottom: 52, left: 58, right: 28 },
    legend: {
      top: 0,
      right: 0,
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: palette.muted, fontSize: 12 },
      data: hasAnyBudget
        ? ["实际成本", "预算成本", "实际回款", "期望回款"]
        : ["实际成本", "实际回款"],
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const arr = params as Array<{ name: string; seriesName: string; value: number; dataIndex: number }>;
        if (!arr || !arr.length) return "";
        const idx = arr[0].dataIndex;
        const name = arr[0].name;
        const actualCost = data.cost[idx] || 0;
        const actualRev = data.revenue[idx] || 0;
        const budCost = expectedCost[idx] || 0;
        const budRev = expectedRevenue[idx] || 0;
        const costPercent = budCost > 0 ? `${((actualCost / budCost) * 100).toFixed(1)}%` : "—";
        const revPercent = budRev > 0 ? `${((actualRev / budRev) * 100).toFixed(1)}%` : "—";
        return `<div style="font-weight:600;margin-bottom:4px">${name}</div>
          成本：¥${actualCost.toLocaleString()} / 预算 ¥${budCost.toLocaleString()} · ${costPercent}<br/>
          回款：¥${actualRev.toLocaleString()} / 期望 ¥${budRev.toLocaleString()} · ${revPercent}`;
      },
    },
    xAxis: {
      type: "category",
      data: data.projects,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: palette.hairline } },
      axisLabel: { color: palette.muted, interval: 0, overflow: "truncate", width: 124 },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: palette.muted, formatter: formatAxisCurrency },
      splitLine: { lineStyle: { color: palette.hairline } },
    },
    series: hasAnyBudget
      ? [
          {
            name: "实际成本",
            type: "bar",
            barGap: 0,
            barWidth: 16,
            data: data.cost,
            itemStyle: { color: costColor, borderRadius: [4, 4, 0, 0] },
          },
          {
            name: "预算成本",
            type: "bar",
            barWidth: 16,
            data: expectedCost,
            itemStyle: {
              color: "transparent",
              borderColor: costColor,
              borderWidth: 1.5,
              borderType: "dashed",
              borderRadius: [4, 4, 0, 0],
            },
          },
          {
            name: "实际回款",
            type: "bar",
            barGap: 0.4,
            barWidth: 16,
            data: data.revenue,
            itemStyle: { color: revenueColor, borderRadius: [4, 4, 0, 0] },
          },
          {
            name: "期望回款",
            type: "bar",
            barWidth: 16,
            data: expectedRevenue,
            itemStyle: {
              color: "transparent",
              borderColor: revenueColor,
              borderWidth: 1.5,
              borderType: "dashed",
              borderRadius: [4, 4, 0, 0],
            },
          },
        ]
      : [
          {
            name: "实际成本",
            type: "bar",
            barWidth: 22,
            data: data.cost,
            itemStyle: { color: costColor, borderRadius: [5, 5, 0, 0] },
          },
          {
            name: "实际回款",
            type: "bar",
            barWidth: 22,
            data: data.revenue,
            itemStyle: { color: revenueColor, borderRadius: [5, 5, 0, 0] },
          },
        ],
  };

  return (
    <EChart
      option={option}
      style={{ height: 390 }}
      onChartClick={(params) => {
        const index = Number(params.dataIndex);
        const project = data.projects[index];
        if (project) onSelect(project, data.transactions.get(project) || []);
      }}
    />
  );
}

function WorkLifeStackedChart({
  data,
  palette,
  lifeColor,
  workColor,
  onSelect,
}: {
  data: ReturnType<typeof buildWorkLifeExpense>;
  palette: ReturnType<typeof getPalette>;
  lifeColor: string;
  workColor: string;
  onSelect: (label: string, ownership: "company" | "personal", transactions: Transaction[]) => void;
}) {
  if (!data.months.length) return <div className="empty-state">当前区间暂无支出趋势。</div>;

  const option: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: {
      bottom: 0,
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: palette.muted, fontSize: 12 },
      data: ["生活支出", "工作支出"],
    },
    grid: { left: 54, right: 20, top: 20, bottom: 54 },
    xAxis: {
      type: "category",
      data: data.months,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: palette.hairline } },
      axisLabel: { color: palette.muted },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: palette.muted, formatter: formatAxisCurrency },
      splitLine: { lineStyle: { color: palette.hairline } },
    },
    series: [
      {
        name: "生活支出",
        type: "bar",
        stack: "expense",
        data: data.life.map((value, index) => ({
          value,
          itemStyle: {
            borderRadius: data.work[index] > 0 ? [0, 0, 0, 0] : [5, 5, 0, 0],
          },
        })),
        itemStyle: { color: lifeColor },
      },
      {
        name: "工作支出",
        type: "bar",
        stack: "expense",
        data: data.work,
        itemStyle: { color: workColor, borderRadius: [5, 5, 0, 0] },
      },
    ],
  };

  return (
    <EChart
      option={option}
      style={{ height: 340 }}
      onChartClick={(params) => {
        const index = Number(params.dataIndex);
        const label = data.months[index];
        if (!label) return;
        const ownership = params.seriesName === "生活支出" ? "personal" : "company";
        const key = `${label}__${ownership}`;
        onSelect(label, ownership, data.transactions.get(key) || []);
      }}
    />
  );
}

function buildIncomeTrend(transactions: Transaction[]) {
  const buckets = new Map<
    string,
    { income: number; expense: number; incomeTransactions: Transaction[]; allTransactions: Transaction[] }
  >();
  for (const tx of transactions) {
    const label = monthLabel(tx);
    if (!label) continue;
    const current = buckets.get(label) || {
      income: 0,
      expense: 0,
      incomeTransactions: [],
      allTransactions: [],
    };
    if (tx.kind === "income") {
      current.income += tx.amount;
      current.incomeTransactions.push(tx);
    }
    if (tx.kind === "expense") current.expense += tx.amount;
    current.allTransactions.push(tx);
    buckets.set(label, current);
  }

  const labels = Array.from(buckets.keys()).sort().slice(-14);
  return {
    labels,
    income: labels.map((label) => Number((buckets.get(label)?.income || 0).toFixed(2))),
    net: labels.map((label) => {
      const item = buckets.get(label);
      return Number(((item?.income || 0) - (item?.expense || 0)).toFixed(2));
    }),
    incomeTransactions: new Map(labels.map((label) => [label, buckets.get(label)?.incomeTransactions || []])),
    allTransactions: new Map(labels.map((label) => [label, buckets.get(label)?.allTransactions || []])),
  };
}

function buildProjectCostRevenue(transactions: Transaction[]) {
  const groups = new Map<string, { cost: number; revenue: number; transactions: Transaction[] }>();
  for (const tx of transactions) {
    const project = tx.projectName?.trim();
    if (!project) continue;
    const current = groups.get(project) || { cost: 0, revenue: 0, transactions: [] };
    if (tx.kind === "expense") current.cost += tx.amount;
    if (tx.kind === "income") current.revenue += tx.amount;
    current.transactions.push(tx);
    groups.set(project, current);
  }

  const entries = Array.from(groups.entries())
    .filter(([, item]) => item.cost > 0 || item.revenue > 0)
    .sort((a, b) => b[1].cost + b[1].revenue - (a[1].cost + a[1].revenue))
    .slice(0, 14);

  return {
    projects: entries.map(([name]) => name),
    cost: entries.map(([, item]) => Number(item.cost.toFixed(2))),
    revenue: entries.map(([, item]) => Number(item.revenue.toFixed(2))),
    transactions: new Map(entries.map(([name, item]) => [name, item.transactions])),
  };
}

function buildWorkLifeExpense(transactions: Transaction[], accounts: Account[]) {
  const ownership = accountOwnershipMap(accounts);
  const monthKeys = Array.from(
    new Set(transactions.filter((tx) => tx.kind === "expense").map((tx) => monthLabel(tx)).filter(Boolean)),
  )
    .sort()
    .slice(-12);
  const transactionMap = new Map<string, Transaction[]>();

  const work = monthKeys.map((label) => {
    const items = transactions.filter(
      (tx) =>
        tx.kind === "expense" &&
        monthLabel(tx) === label &&
        ownership[tx.fromAccountName || tx.accountName] === "company",
    );
    transactionMap.set(`${label}__company`, items);
    return Number(items.reduce((sum, tx) => sum + tx.amount, 0).toFixed(2));
  });

  const life = monthKeys.map((label) => {
    const items = transactions.filter(
      (tx) =>
        tx.kind === "expense" &&
        monthLabel(tx) === label &&
        ownership[tx.fromAccountName || tx.accountName] === "personal",
    );
    transactionMap.set(`${label}__personal`, items);
    return Number(items.reduce((sum, tx) => sum + tx.amount, 0).toFixed(2));
  });

  return { months: monthKeys, work, life, transactions: transactionMap };
}

function transactionsForAccount(transactions: Transaction[], accountName: string) {
  return transactions.filter((tx) =>
    [tx.accountName, tx.fromAccountName, tx.toAccountName].some((name) => name === accountName),
  );
}

function monthLabel(tx: Transaction) {
  return tx.occurredAt?.slice(0, 7).replace("-", "/") || "";
}

function formatAxisCurrency(value: number) {
  const abs = Math.abs(value);
  if (abs >= 10000) return `¥${(value / 10000).toFixed(1)}w`;
  if (abs >= 1000) return `¥${(value / 1000).toFixed(1)}k`;
  return `¥${Math.round(value)}`;
}
