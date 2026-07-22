/**
 * [INPUT]: 依赖配置 API、主数据类型和设置面板组件。
 * [OUTPUT]: 对外提供 SettingsPage，并在账户卡中保留已删除状态及资金影响。
 * [POS]: web-dashboard 的主数据配置中心；已删除账户可见但不再作为活跃账户编辑。
 *   记账模式（settings.ledgerMode）为总门控：personal 隐藏归属选择器 + 客户合作方 + 税务面板，
 *   类别管理按收/支分 tab 并以行 + 编辑弹窗呈现（转账等系统类别不入列表）。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BarChart3, Calculator, CircleDollarSign, CreditCard, Database, FileSpreadsheet, FileUp, FolderKanban, Globe2, History, LayoutDashboard, Pencil, Percent, Plus, Receipt, Repeat, Save, Tags, Trash2, TrendingUp, Upload, UserSquare } from "lucide-react";
import clsx from "clsx";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { TextInput } from "../components/ui/TextInput";
import { Autocomplete } from "../components/ui/Autocomplete";
import { Modal } from "../components/ui/Modal";
import { AlertDialog } from "../components/ui/AlertDialog";
import { StatusPill } from "../components/ui/StatusPill";
import { DatePicker } from "../components/ui/DatePicker";
import { SegmentedSwitch } from "../components/ui/SegmentedSwitch";
import { CategoryTabs } from "../components/ui/Tabs";
import { ProjectPLDrawer } from "../components/ProjectPLDrawer";
import { AdjustmentHistoryDrawer } from "../components/AdjustmentHistoryDrawer";
import { TransactionEditSheet } from "../components/TransactionEditSheet";
import { DashboardCustomizer } from "../components/DashboardCustomizer";
import { api } from "../api/client";
import { useApi } from "../lib/useApi";
import { formatCurrency } from "../lib/format";
import type { Account, AccountClassification, AccountOwnership, CategoryRef, Configuration, Counterparty, CounterpartyKind, ExchangeRates, FinanceSource, LedgerMode, Project, ProjectGoal, RecurringFrequency, RecurringRule, Transaction, TransactionKind } from "../types";

type SettingsPanel = "currency" | "accounts" | "projects" | "sources" | "categories" | "counterparties" | "recurring" | "import" | "tax" | "dashboard";

const FREQUENCY_OPTIONS: Array<{ value: RecurringFrequency; label: string }> = [
  { value: "daily", label: "每天" },
  { value: "weekly", label: "每周" },
  { value: "monthly", label: "每月" },
  { value: "yearly", label: "每年" },
];

const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  daily: "每天",
  weekly: "每周",
  monthly: "每月",
  yearly: "每年",
};

const TRANSACTION_KIND_OPTIONS: Array<{ value: TransactionKind; label: string }> = [
  { value: "expense", label: "支出" },
  { value: "income", label: "收入" },
  { value: "transfer", label: "转账" },
];

const COUNTERPARTY_KIND_OPTIONS: Array<{ value: CounterpartyKind; label: string }> = [
  { value: "client", label: "客户" },
  { value: "vendor", label: "供应商" },
  { value: "employer", label: "雇主 / 用人方" },
  { value: "other", label: "其他" },
];

const COUNTERPARTY_KIND_TONE: Record<CounterpartyKind, "primary" | "neutral" | "success" | "brand-blue"> = {
  client: "success",
  vendor: "brand-blue",
  employer: "primary",
  other: "neutral",
};

const OWNERSHIP_OPTIONS: Array<{ value: AccountOwnership; label: string }> = [
  { value: "company", label: "工作账户" },
  { value: "personal", label: "生活账户" },
  { value: "unspecified", label: "未指定" },
];

const LEDGER_MODE_OPTIONS: Array<{ value: LedgerMode; label: string }> = [
  { value: "personal", label: "个人记账" },
  { value: "dual", label: "个人 + 经营" },
];

const CLASSIFICATION_OPTIONS: Array<{ value: AccountClassification; label: string }> = [
  { value: "asset", label: "资产" },
  { value: "liability", label: "负债（信用卡 / 贷款）" },
];

const CURRENCY_OPTIONS = [
  { value: "CNY", label: "人民币 CNY" },
  { value: "USD", label: "美元 USD" },
  { value: "HKD", label: "港币 HKD" },
  { value: "EUR", label: "欧元 EUR" },
  { value: "JPY", label: "日元 JPY" },
];

const UNIT_OPTIONS = [
  { value: "yuan", label: "元" },
  { value: "wan", label: "万元" },
];

const SETTINGS_PANEL_OPTIONS: Array<{ value: SettingsPanel; label: string }> = [
  { value: "currency", label: "货币与单位" },
  { value: "accounts", label: "账户管理" },
  { value: "projects", label: "项目管理" },
  { value: "sources", label: "资金来源管理" },
  { value: "categories", label: "类别管理设置" },
  { value: "counterparties", label: "客户与合作方" },
  { value: "recurring", label: "周期账目" },
  { value: "import", label: "账单导入" },
  { value: "tax", label: "税务设置" },
  { value: "dashboard", label: "仪表盘" },
];

export function SettingsPage() {
  const { data, loading, error, refresh } = useApi(() => api.configuration(), []);
  const [draft, setDraft] = useState<Configuration | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<SettingsPanel>("currency");

  useEffect(() => {
    const target = sessionStorage.getItem("settings-target-panel");
    if (target) {
      setActivePanel(target as SettingsPanel);
      sessionStorage.removeItem("settings-target-panel");
    }
  }, []);

  useEffect(() => {
    if (data) setDraft(cloneConfig(data));
  }, [data]);

  const dirty = useMemo(() => {
    if (!data || !draft) return false;
    return JSON.stringify(data) !== JSON.stringify(draft);
  }, [data, draft]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setToast(null);
    try {
      const saved = await api.putConfiguration(draft);
      setDraft(cloneConfig(saved));
      setToast("设置已保存");
      refresh();
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err ? String((err as Error).message) : "保存失败";
      setToast(message);
    } finally {
      setBusy(false);
      window.setTimeout(() => setToast(null), 2600);
    }
  };

  if (loading && !draft) return <div className="h-[760px] rounded-lg bg-muted animate-pulse" />;
  if (error) {
    return (
      <Card>
        <h2 className="text-display-sm mb-2">无法加载财务设置</h2>
        <p className="text-body-sm text-muted-foreground mb-4">{error.message}</p>
        <Button onClick={refresh}>重试</Button>
      </Card>
    );
  }
  if (!draft) return null;

  const totalBalance = draft.accounts.filter((account) => !account.deletedAt).reduce(
    (sum, account) => sum + (account.currentBalance ?? account.openingBalance ?? 0),
    0,
  );

  const updateSettings = (patch: Partial<Configuration["settings"]>) =>
    setDraft({ ...draft, settings: { ...draft.settings, ...patch } });

  // 记账模式门控：dual 才显示归属选择器、客户合作方、税务面板。
  // 防御性地把"存在 company 归属账户"也判为 dual，避免老库漏字段时藏掉经营维度。
  const isDual = draft.settings.ledgerMode === "dual" || draft.accounts.some((account) => account.ownership === "company");
  const panelOptions = SETTINGS_PANEL_OPTIONS.filter(
    (option) => isDual || (option.value !== "counterparties" && option.value !== "tax"),
  );
  // 深链或切模式后 activePanel 可能指向已隐藏面板 → 回落到货币面板，杜绝空白。
  const effectivePanel: SettingsPanel = panelOptions.some((option) => option.value === activePanel)
    ? activePanel
    : "currency";

  return (
    <div className="space-y-5">
      <Card padding="none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h1 className="text-display-sm">财务设置</h1>
            <p className="text-body-sm text-muted-foreground">
              管理账户、项目、资金来源与支出类别，这些内容会写入 Finance Node。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SegmentedSwitch
              value={isDual ? "dual" : "personal"}
              options={LEDGER_MODE_OPTIONS}
              onChange={(mode) => updateSettings({ ledgerMode: mode })}
              ariaLabel="记账模式"
            />
            <StatusPill tone={dirty ? "warning" : "success"}>
              {dirty ? "有未保存改动" : "已保存"}
            </StatusPill>
            <Button variant="outline" disabled={!dirty || busy || !data} onClick={() => data && setDraft(cloneConfig(data))}>
              恢复默认
            </Button>
            <Button leading={<Save size={14} />} disabled={!dirty} loading={busy} onClick={save}>
              保存设置
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-4">
          <TopStat label="当前统计区间" value="由左侧日历控制" icon={<Database size={17} />} />
          <TopStat label="默认币种总额" value={formatCurrency(totalBalance)} icon={<CreditCard size={17} />} />
          <TopStat label="账户 / 项目 / 类别" value={`${draft.accounts.length}/${draft.settings.projects.length}/${draft.categories.length}`} icon={<FolderKanban size={17} />} />
          <TopStat label="保存状态" value={draft.settings.updatedAt ? new Date(draft.settings.updatedAt).toLocaleString("zh-CN") : "尚未同步"} icon={<Save size={17} />} />
        </div>
        <div className="border-t border-border px-5 py-4">
          <CategoryTabs
            value={effectivePanel}
            onChange={setActivePanel}
            options={panelOptions}
            variant="pills"
            ariaLabel="设置分组"
          />
        </div>
      </Card>

      {effectivePanel === "currency" && (
        <Card padding="none">
          <SectionHeader
            title="货币与单位设置"
            description="当前币种与基本单位会影响设置页和后续看板展示口径。汇率用于把外币账户折算到本位币。"
          />
          <SectionGrid>
            <ItemCard
              header={
                <>
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <CircleDollarSign size={20} />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Badge tone="primary">
                      {CURRENCY_OPTIONS.find((opt) => opt.value === draft.settings.defaultCurrency)?.label || draft.settings.defaultCurrency}
                    </Badge>
                    <span className="font-mono text-[11px] uppercase text-muted-foreground">
                      {draft.settings.defaultCurrency}
                    </span>
                  </div>
                </>
              }
            >
              <Autocomplete
                label="默认币种"
                value={draft.settings.defaultCurrency}
                onChange={(value) => updateSettings({ defaultCurrency: value })}
                options={CURRENCY_OPTIONS}
              />
            </ItemCard>
            <ItemCard
              header={
                <>
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Calculator size={20} />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Badge tone="neutral">
                      {UNIT_OPTIONS.find((opt) => opt.value === draft.settings.baseUnit)?.label || draft.settings.baseUnit}
                    </Badge>
                    <span className="font-mono text-[11px] uppercase text-muted-foreground">
                      {draft.settings.baseUnit}
                    </span>
                  </div>
                </>
              }
            >
              <Autocomplete
                label="基本单位"
                value={draft.settings.baseUnit}
                onChange={(value) => updateSettings({ baseUnit: value })}
                options={UNIT_OPTIONS}
              />
            </ItemCard>
            <ItemCard
              header={
                <>
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Globe2 size={20} />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Badge tone="primary">
                      汇率 · {draft.settings.exchangeRates?.baseCurrency || "CNY"}
                    </Badge>
                    <span className="font-mono text-[11px] uppercase text-muted-foreground">
                      {Object.keys(draft.settings.exchangeRates?.rates || {}).length} 个币种
                    </span>
                  </div>
                </>
              }
            >
              <ExchangeRatesEditor
                value={draft.settings.exchangeRates}
                onChange={(rates) => updateSettings({ exchangeRates: rates })}
              />
            </ItemCard>
          </SectionGrid>
        </Card>
      )}

      {effectivePanel === "accounts" && (
        <AccountsSection
          accounts={draft.accounts}
          exchangeRates={draft.settings.exchangeRates}
          showOwnership={isDual}
          onChange={(accounts) => setDraft({ ...draft, accounts })}
        />
      )}

      {effectivePanel === "projects" && (
        <ProjectsSection
          projects={draft.settings.projects}
          accounts={draft.accounts}
          onChange={(projects) => updateSettings({ projects })}
        />
      )}

      {effectivePanel === "sources" && (
        <SourcesSection
          sources={draft.settings.financeSources || []}
          accounts={draft.accounts}
          onChange={(financeSources) => updateSettings({ financeSources })}
        />
      )}

      {effectivePanel === "categories" && (
        <CategoriesSection
          categories={draft.categories}
          accounts={draft.accounts}
          projects={draft.settings.projects}
          onChange={(categories) => setDraft({ ...draft, categories })}
        />
      )}

      {isDual && effectivePanel === "counterparties" && (
        <CounterpartiesSection
          counterparties={draft.settings.counterparties || []}
          accounts={draft.accounts}
          onChange={(counterparties) => updateSettings({ counterparties })}
        />
      )}

      {effectivePanel === "recurring" && (
        <RecurringSection
          accounts={draft.accounts}
          categories={draft.categories}
        />
      )}

      {effectivePanel === "import" && (
        <ImportSection
          accounts={draft.accounts}
          categories={draft.categories}
          onImported={() => {
            setToast("账单已导入，可在流水页查看。");
            window.setTimeout(() => setToast(null), 2600);
          }}
        />
      )}

      {isDual && effectivePanel === "tax" && (
        <TaxConfigSection
          taxConfig={draft.settings.taxConfig || { vatRate: 0.03, personalThreshold: 60000, personalRate: 0.20, sebRate: 0.10, currency: "CNY" }}
          onChange={(taxConfig) => updateSettings({ taxConfig })}
        />
      )}

      {effectivePanel === "dashboard" && <DashboardSection />}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-md bg-foreground px-4 py-3 text-[13px] text-background shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function DashboardSection() {
  const [customizerOpen, setCustomizerOpen] = useState(false);
  return (
    <Card padding="none">
      <SectionHeader
        title="仪表盘布局"
        description="控制「财务状况」页各模块的显隐与排序；配置保存在本机浏览器，不写入 Finance Node。"
        action={
          <Button
            variant="outline"
            size="sm"
            leading={<LayoutDashboard size={13} />}
            onClick={() => setCustomizerOpen(true)}
          >
            自定义仪表盘
          </Button>
        }
      />
      <div className="px-5 py-4 text-body-sm text-muted-foreground">
        隐藏的模块不参与渲染；重新开启后立即恢复。财务状况页本身保持纯报表，不放配置入口。
      </div>
      <DashboardCustomizer open={customizerOpen} onClose={() => setCustomizerOpen(false)} />
    </Card>
  );
}

function AccountsSection({
  accounts,
  exchangeRates,
  showOwnership,
  onChange,
}: {
  accounts: Account[];
  exchangeRates?: ExchangeRates;
  showOwnership: boolean;
  onChange: (next: Account[]) => void;
}) {
  const baseCurrency = exchangeRates?.baseCurrency || "CNY";
  const rates = exchangeRates?.rates || { CNY: 1 };
  const [historyAccount, setHistoryAccount] = useState<Account | null>(null);
  const update = (index: number, patch: Partial<Account>) => {
    const next = [...accounts];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };
  const add = () =>
    onChange([
      ...accounts,
      {
        id: `account-${Date.now()}`,
        name: "新账户",
        type: "other",
        currency: "CNY",
        openingBalance: 0,
        currentBalance: 0,
        threshold: 0,
        tintHex: "#7f91d6",
        keywords: [],
        uiAccountType: "其他",
        // personal 模式不暴露归属，新账户直接落 personal，避免后端 infer 误判
        ownership: showOwnership ? "unspecified" : "personal",
        classification: "asset",
        creditLimit: 0,
      },
    ]);
  return (
    <Card padding="none">
      <SectionHeader
        title="账户管理"
        description="账户归属会影响工作/生活资金流。当前余额由你直接填写，记账与实际不符的差额视为黑洞资金。"
        action={<Button variant="outline" size="sm" leading={<Plus size={13} />} onClick={add}>新增账户</Button>}
      />
      <SectionGrid>
        {accounts.map((account, index) => (
          <ItemCard
            key={account.id}
            className={account.deletedAt ? "border-destructive/40 bg-destructive/5 opacity-65" : undefined}
            header={
              <>
                <ColorSwatchPicker
                  value={account.tintHex || "#7f91d6"}
                  onChange={(hex) => update(index, { tintHex: hex })}
                  label="账户主题色"
                />
                <div className="flex min-w-0 flex-col gap-1.5">
                  {showOwnership && (
                    <Badge tone={account.ownership === "company" ? "brand-blue" : account.ownership === "personal" ? "success" : "neutral"}>
                      {OWNERSHIP_OPTIONS.find((item) => item.value === account.ownership)?.label || "未指定"}
                    </Badge>
                  )}
                  <span className="font-mono text-[11px] uppercase text-muted-foreground">
                    {(account.tintHex || "#7f91d6").toUpperCase()}
                  </span>
                </div>
              </>
            }
            actions={
              <button
                type="button"
                onClick={() => setHistoryAccount(account)}
                title="查看余额调整历史"
                aria-label="查看余额调整历史"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              >
                <History size={14} />
              </button>
            }
            onDelete={() => onChange(accounts.map((item, i) => i === index ? {
              ...item,
              deletedAt: new Date().toISOString(),
              deletedBy: "dashboard",
              deletionReason: "用户在设置页删除",
              deletionImpact: {
                balance: item.currentBalance ?? item.openingBalance ?? 0,
                assetDelta: item.classification === "liability" ? 0 : -(item.currentBalance ?? item.openingBalance ?? 0),
                liabilityDelta: item.classification === "liability" ? -(item.currentBalance ?? item.openingBalance ?? 0) : 0,
                netWorthDelta: item.classification === "liability" ? (item.currentBalance ?? item.openingBalance ?? 0) : -(item.currentBalance ?? item.openingBalance ?? 0),
              },
            } : item))}
            deleteLabel="删除此账户"
          >
            {account.deletedAt && (
              <>
                <span className="pointer-events-none absolute inset-x-3 top-1/2 h-0.5 -rotate-6 bg-destructive/70" />
                <div className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-[12px] text-destructive">
                <div className="font-semibold line-through decoration-2">已删除账户 · {account.deletedBy || "Agent"}</div>
                <div className="mt-1 text-muted-foreground">删除时余额 {formatCurrency(account.deletionImpact?.balance ?? account.currentBalance ?? account.openingBalance ?? 0)} · 当前资产 {formatSigned(account.deletionImpact?.assetDelta ?? 0)} · 净资产 {formatSigned(account.deletionImpact?.netWorthDelta ?? 0)}</div>
                </div>
              </>
            )}
            <TextInput label="账户名称" value={account.name} onChange={(event) => update(index, { name: event.target.value })} />
            {showOwnership ? (
              <div className="grid grid-cols-2 gap-3">
                <Autocomplete label="归属类型" value={account.ownership || "unspecified"} onChange={(value) => update(index, { ownership: value as AccountOwnership })} options={OWNERSHIP_OPTIONS} />
                <Autocomplete label="性质" value={account.classification || "asset"} onChange={(value) => update(index, { classification: value as AccountClassification })} options={CLASSIFICATION_OPTIONS} />
              </div>
            ) : (
              <Autocomplete label="性质" value={account.classification || "asset"} onChange={(value) => update(index, { classification: value as AccountClassification })} options={CLASSIFICATION_OPTIONS} />
            )}
            {account.classification === "liability" && (
              <TextInput
                label={account.type === "creditCard" ? "信用额度" : "总借款额"}
                type="number"
                value={String(account.creditLimit || 0)}
                onChange={(event) => update(index, { creditLimit: Number(event.target.value) || 0 })}
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="阈值" type="number" value={String(account.threshold || 0)} onChange={(event) => update(index, { threshold: Number(event.target.value) || 0 })} />
              <TextInput
                label={account.classification === "liability" ? "当前已欠" : "当前余额"}
                type="number"
                value={String(account.currentBalance ?? account.openingBalance ?? 0)}
                onChange={(event) => update(index, { currentBalance: Number(event.target.value) || 0 })}
              />
            </div>
            {(account.threshold || 0) > 0 && (
              <details className="rounded-md border border-border/60 bg-background/30 px-3 py-2" open={Boolean(account.thresholdZones?.low || account.thresholdZones?.mid)}>
                <summary className="cursor-pointer text-[12.5px] font-medium text-foreground select-none">
                  阈值警戒区间（可选 · 默认 60% / 85%）
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <TextInput
                    label={`绿→黄 (低警戒)`}
                    type="number"
                    value={String(account.thresholdZones?.low || "")}
                    onChange={(event) =>
                      update(index, {
                        thresholdZones: {
                          ...(account.thresholdZones || {}),
                          low: Number(event.target.value) || 0,
                        },
                      })
                    }
                    placeholder={`默认 ${Math.round((account.threshold || 0) * 0.6)}`}
                  />
                  <TextInput
                    label={`黄→红 (中警戒)`}
                    type="number"
                    value={String(account.thresholdZones?.mid || "")}
                    onChange={(event) =>
                      update(index, {
                        thresholdZones: {
                          ...(account.thresholdZones || {}),
                          mid: Number(event.target.value) || 0,
                        },
                      })
                    }
                    placeholder={`默认 ${Math.round((account.threshold || 0) * 0.85)}`}
                  />
                </div>
              </details>
            )}
            {account.classification === "liability" && (account.creditLimit || 0) > 0 && (
              <LiabilitySummary
                used={account.currentBalance ?? account.openingBalance ?? 0}
                limit={account.creditLimit || 0}
              />
            )}
            {(account.currency || "CNY") !== baseCurrency && (
              <div className="rounded-md border border-border bg-background/30 px-3 py-2 text-[12px]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">原币</span>
                  <span className="font-mono text-foreground tabular-nums">
                    {(account.currentBalance ?? account.openingBalance ?? 0).toLocaleString("zh-CN", { minimumFractionDigits: 2 })} {account.currency}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">≈ {baseCurrency}</span>
                  <span className="font-mono text-foreground tabular-nums">
                    {formatCurrency((account.currentBalance ?? account.openingBalance ?? 0) * (rates[(account.currency || "CNY").toUpperCase()] || 1))}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  汇率 {rates[(account.currency || "CNY").toUpperCase()] || "—"}（在「货币与单位」面板编辑）
                </div>
              </div>
            )}
          </ItemCard>
        ))}
      </SectionGrid>
      <AdjustmentHistoryDrawer
        open={Boolean(historyAccount)}
        account={historyAccount}
        onClose={() => setHistoryAccount(null)}
      />
    </Card>
  );
}

function ProjectsSection({
  projects,
  accounts,
  onChange,
}: {
  projects: Project[];
  accounts: Account[];
  onChange: (next: Project[]) => void;
}) {
  const [plProject, setPlProject] = useState<Project | null>(null);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const accountOptions = [{ value: "", label: "不指定" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))];
  const update = (index: number, patch: Partial<Project>) => {
    const next = [...projects];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };
  const updateGoal = (index: number, patch: Partial<ProjectGoal>) => {
    const project = projects[index];
    const currentGoal = project.goal || { targetAmount: 0 };
    update(index, { goal: { ...currentGoal, ...patch } });
  };
  const add = () =>
    onChange([...projects, { id: `project-${Date.now()}`, name: "新项目", direction: "支出", group: "新项目", note: "", trackingEnabled: false }]);
  return (
    <Card padding="none">
      <SectionHeader
        title="项目管理"
        description="项目用于追踪你正在进行的事情，同时记录它的成本、带来的收入与储蓄目标。"
        action={<Button variant="outline" size="sm" leading={<Plus size={13} />} onClick={add}>新增项目</Button>}
      />
      <SectionGrid>
        {projects.map((project, index) => (
          <ItemCard
            key={project.id}
            actions={
              <button
                type="button"
                onClick={() => setPlProject(project)}
                title="查看项目 P&L 报表"
                aria-label="查看项目 P&L 报表"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              >
                <BarChart3 size={14} />
              </button>
            }
            header={
              <>
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FolderKanban size={20} />
                </span>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Badge tone={project.trackingEnabled ? "success" : "neutral"}>
                    {project.trackingEnabled ? "追踪中" : "未追踪"}
                  </Badge>
                  {project.goal && (project.goal.targetAmount || 0) > 0 && (
                    <span className="font-mono text-[11px] uppercase text-muted-foreground">
                      目标：{formatCurrency(project.goal.targetAmount)}
                    </span>
                  )}
                </div>
              </>
            }
            onDelete={() => onChange(projects.filter((_, i) => i !== index))}
            deleteLabel="删除此项目"
          >
            <TextInput label="项目名称" value={project.name} onChange={(event) => update(index, { name: event.target.value })} />
            <TextInput label="说明" value={project.note || ""} onChange={(event) => update(index, { note: event.target.value })} />
            <Autocomplete
              label="资金追踪"
              value={project.trackingEnabled ? "yes" : "no"}
              onChange={(value) => update(index, { trackingEnabled: value === "yes" })}
              options={[{ value: "yes", label: "开启" }, { value: "no", label: "关闭" }]}
            />
            <details className="rounded-md border border-border/60 bg-background/30 px-3 py-2" open={(project.expectedCost || 0) > 0 || (project.expectedRevenue || 0) > 0}>
              <summary className="cursor-pointer text-[12.5px] font-medium text-foreground select-none">
                项目预算 / 期望（可选）
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <TextInput
                    label="预算成本"
                    type="number"
                    value={String(project.expectedCost || 0)}
                    onChange={(event) => update(index, { expectedCost: Number(event.target.value) || 0 })}
                  />
                  <TextInput
                    label="期望收入"
                    type="number"
                    value={String(project.expectedRevenue || 0)}
                    onChange={(event) => update(index, { expectedRevenue: Number(event.target.value) || 0 })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DatePicker
                    label="起始日期"
                    value={project.startDate || ""}
                    max={project.endDate || undefined}
                    onChange={(value) => update(index, { startDate: value || null })}
                  />
                  <DatePicker
                    label="结束日期"
                    value={project.endDate || ""}
                    min={project.startDate || undefined}
                    onChange={(value) => update(index, { endDate: value || null })}
                  />
                </div>
              </div>
            </details>
            <details className="rounded-md border border-border/60 bg-background/30 px-3 py-2" open={!!project.goal && (project.goal.targetAmount || 0) > 0}>
              <summary className="cursor-pointer text-[12.5px] font-medium text-foreground select-none">
                储蓄目标（可选）
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-3">
                <TextInput
                  label="目标金额（0 表示不设目标）"
                  type="number"
                  value={String(project.goal?.targetAmount || 0)}
                  onChange={(event) => updateGoal(index, { targetAmount: Number(event.target.value) || 0 })}
                />
                <DatePicker
                  label="目标日期"
                  value={project.goal?.targetDate || ""}
                  onChange={(value) => updateGoal(index, { targetDate: value || null })}
                />
                <Autocomplete
                  label="资金来自账户"
                  value={project.goal?.sourceAccountId || ""}
                  onChange={(value) => updateGoal(index, { sourceAccountId: value })}
                  options={accountOptions}
                  placeholder="选择账户…"
                  searchPlaceholder="搜索账户…"
                />
                <TextInput
                  label="描述"
                  value={project.goal?.description || ""}
                  onChange={(event) => updateGoal(index, { description: event.target.value })}
                  placeholder="例：买台新电脑、装修首付"
                />
              </div>
            </details>
          </ItemCard>
        ))}
      </SectionGrid>
      <ProjectPLDrawer
        open={Boolean(plProject)}
        project={plProject}
        onClose={() => setPlProject(null)}
        onEditTransaction={(tx) => {
          setEditTarget(tx);
          setEditorOpen(true);
          setPlProject(null);
        }}
      />
      <TransactionEditSheet
        open={editorOpen}
        initial={editTarget}
        onClose={() => {
          setEditorOpen(false);
          setEditTarget(null);
        }}
        onSaved={() => {
          setEditorOpen(false);
          setEditTarget(null);
        }}
        onDeleted={() => {
          setEditorOpen(false);
          setEditTarget(null);
        }}
      />
    </Card>
  );
}

function SourcesSection({
  sources,
  accounts,
  onChange,
}: {
  sources: FinanceSource[];
  accounts: Account[];
  onChange: (next: FinanceSource[]) => void;
}) {
  const accountOptions = [{ value: "", label: "不指定" }, ...accounts.map((account) => ({ value: account.id, label: account.name }))];
  const update = (index: number, patch: Partial<FinanceSource>) => {
    const next = [...sources];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };
  const add = () =>
    onChange([...sources, { id: `source-${Date.now()}`, name: "新资金来源", defaultAccountId: "", note: "", tintHex: "#87b99b" }]);
  return (
    <Card padding="none">
      <SectionHeader
        title="资金来源管理"
        description="资金来源对应桑基图第 1 层，用来记录开源项目或收入渠道。"
        action={<Button variant="outline" size="sm" leading={<Plus size={13} />} onClick={add}>新增来源</Button>}
      />
      <SectionGrid>
        {sources.map((source, index) => (
          <ItemCard
            key={source.id}
            header={
              <>
                <ColorSwatchPicker
                  value={source.tintHex || "#87b99b"}
                  onChange={(hex) => update(index, { tintHex: hex })}
                  icon={<TrendingUp size={20} />}
                  label="资金来源主题色"
                />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Badge tone="success">资金来源</Badge>
                  <span className="font-mono text-[11px] uppercase text-muted-foreground">
                    {(source.tintHex || "#87b99b").toUpperCase()}
                  </span>
                </div>
              </>
            }
            onDelete={() => onChange(sources.filter((_, i) => i !== index))}
            deleteLabel="删除此资金来源"
          >
            <TextInput label="来源名称" value={source.name} onChange={(event) => update(index, { name: event.target.value })} />
            <Autocomplete label="默认入账账户" value={source.defaultAccountId || ""} onChange={(value) => update(index, { defaultAccountId: value })} options={accountOptions} placeholder="选择账户…" searchPlaceholder="搜索账户…" />
            <TextInput label="备注" value={source.note || ""} onChange={(event) => update(index, { note: event.target.value })} />
          </ItemCard>
        ))}
      </SectionGrid>
    </Card>
  );
}

// 转账是服务于 kind=transfer 的系统类别，不作为用户可编辑的收支分类展示（数据仍保留）。
const SYSTEM_CATEGORY_IDS = new Set(["category-transfer"]);

function CategoriesSection({
  categories,
  accounts,
  projects,
  onChange,
}: {
  categories: CategoryRef[];
  accounts: Account[];
  projects: Project[];
  onChange: (next: CategoryRef[]) => void;
}) {
  const accountOptions = [{ value: "", label: "不指定" }, ...accounts.map((account) => ({ value: account.id, label: account.name }))];
  const projectOptions = [{ value: "", label: "未绑定项目" }, ...projects.map((project) => ({ value: project.id, label: project.name }))];
  const accountNameById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name] as const)),
    [accounts],
  );
  const [directionTab, setDirectionTab] = useState<"支出" | "收入">("支出");
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const update = (index: number, patch: Partial<CategoryRef>) => {
    const next = [...categories];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };
  const remove = (index: number) => {
    setEditIndex(null);
    onChange(categories.filter((_, i) => i !== index));
  };
  const add = () => {
    const newIndex = categories.length;
    onChange([
      ...categories,
      { id: `category-${Date.now()}`, name: directionTab === "收入" ? "新收入类别" : "新支出类别", direction: directionTab, group: "", keywords: [], tintHex: "#d97757" },
    ]);
    setEditIndex(newIndex);
  };

  // 保留真实索引，供 update / remove 定位；同时按方向 tab + 排除系统类别做展示过滤
  const rows = categories
    .map((category, index) => ({ category, index }))
    .filter(({ category }) => !SYSTEM_CATEGORY_IDS.has(category.id || "") && (category.direction || "支出") === directionTab);
  const expenseCount = categories.filter((c) => !SYSTEM_CATEGORY_IDS.has(c.id || "") && (c.direction || "支出") === "支出").length;
  const incomeCount = categories.filter((c) => !SYSTEM_CATEGORY_IDS.has(c.id || "") && c.direction === "收入").length;

  const editing = editIndex != null ? categories[editIndex] : null;

  return (
    <Card padding="none">
      <SectionHeader
        title="类别管理"
        description="收入与支出分开管理。点开任意类别可编辑默认账户、月度预算与识别关键词。"
        action={
          <Button variant="outline" size="sm" leading={<Plus size={13} />} onClick={add}>
            新增{directionTab}类别
          </Button>
        }
      />
      <div className="border-b border-border px-5 py-3">
        <CategoryTabs
          value={directionTab}
          onChange={setDirectionTab}
          options={[
            { value: "支出", label: `支出 (${expenseCount})` },
            { value: "收入", label: `收入 (${incomeCount})` },
          ]}
          variant="pills"
          ariaLabel="类别方向"
        />
      </div>
      <div className="space-y-1.5 p-4">
        {rows.length === 0 && (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
            还没有{directionTab}类别，点右上角「新增{directionTab}类别」创建。
          </div>
        )}
        {rows.map(({ category, index }) => {
          const accountName = category.defaultAccountId ? accountNameById.get(category.defaultAccountId) : undefined;
          const budget = category.monthlyBudget || 0;
          return (
            <div key={category.id || index} className="flex items-center gap-1.5 rounded-lg border border-border bg-card">
              <button
                type="button"
                onClick={() => setEditIndex(index)}
                className="flex flex-1 items-center gap-3 rounded-l-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
              >
                <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: category.tintHex || "#d97757" }} />
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{category.name}</span>
                {accountName && (
                  <span className="hidden shrink-0 items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground sm:inline-flex">
                    → {accountName}
                  </span>
                )}
                {budget > 0 && (
                  <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    预算 {formatCurrency(budget)}
                  </span>
                )}
                <Pencil size={13} className="shrink-0 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`删除类别 ${category.name}`}
                title="删除此类别"
                className="mr-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <Modal
        open={editing != null}
        onClose={() => setEditIndex(null)}
        size="sm"
        title={
          <span className="flex items-center gap-2">
            <Tags size={16} /> 编辑类别
          </span>
        }
        footer={
          <div className="flex justify-end">
            <Button onClick={() => setEditIndex(null)}>完成</Button>
          </div>
        }
      >
        {editing && editIndex != null && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <ColorSwatchPicker
                value={editing.tintHex || "#d97757"}
                onChange={(hex) => update(editIndex, { tintHex: hex })}
                icon={<Tags size={20} />}
                label="类别主题色"
              />
              <div className="flex-1">
                <TextInput label="类别名称" value={editing.name} onChange={(event) => update(editIndex, { name: event.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Autocomplete label="方向" value={editing.direction || "支出"} onChange={(value) => update(editIndex, { direction: value as "收入" | "支出" })} options={[{ value: "支出", label: "支出" }, { value: "收入", label: "收入" }]} />
              <Autocomplete label="默认账户" value={editing.defaultAccountId || ""} onChange={(value) => update(editIndex, { defaultAccountId: value })} options={accountOptions} placeholder="选择账户…" searchPlaceholder="搜索账户…" />
            </div>
            {(editing.direction || "支出") === "支出" && (
              <TextInput
                label="月度预算（0 表示不设预算）"
                type="number"
                value={String(editing.monthlyBudget || 0)}
                onChange={(event) => update(editIndex, { monthlyBudget: Number(event.target.value) || 0 })}
                placeholder="留空 / 0 不参与预算追踪"
              />
            )}
            <TextInput
              label="关键词（帮助 AI 与账单导入自动归类）"
              value={(editing.keywords || []).join(", ")}
              onChange={(event) => update(editIndex, { keywords: event.target.value.split(/[,，、]/).map((item) => item.trim()).filter(Boolean) })}
            />
            <details className="rounded-md border border-border px-3 py-2 text-[13px]">
              <summary className="cursor-pointer select-none text-muted-foreground">高级 · 项目归属</summary>
              <div className="pt-3">
                <Autocomplete label="项目归属" value={editing.projectId || ""} onChange={(value) => update(editIndex, { projectId: value })} options={projectOptions} placeholder="选择项目…" searchPlaceholder="搜索项目…" />
              </div>
            </details>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function CounterpartiesSection({
  counterparties,
  accounts,
  onChange,
}: {
  counterparties: Counterparty[];
  accounts: Account[];
  onChange: (next: Counterparty[]) => void;
}) {
  const { data: transactionData } = useApi(() => api.listTransactions({ limit: 3000 }), []);
  const transactions = transactionData || [];
  const recentByCp = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const tx of transactions) {
      if (!tx.counterpartyId) continue;
      const t = new Date(tx.occurredAt).getTime();
      if (Number.isFinite(t) && t < cutoff) continue;
      const cur = map.get(tx.counterpartyId) || { count: 0, total: 0 };
      cur.count += 1;
      const sign = tx.kind === "income" ? 1 : tx.kind === "expense" ? -1 : 0;
      cur.total += sign * tx.amount;
      map.set(tx.counterpartyId, cur);
    }
    return map;
  }, [transactions]);
  const accountOptions = [{ value: "", label: "不指定" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))];
  const update = (index: number, patch: Partial<Counterparty>) => {
    const next = [...counterparties];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };
  const add = () =>
    onChange([
      ...counterparties,
      {
        id: `counterparty-${Date.now()}`,
        name: "新对手方",
        kind: "client",
        tintHex: "#7F91D6",
        defaultAccountId: "",
        note: "",
        contactInfo: "",
      },
    ]);
  return (
    <Card padding="none">
      <SectionHeader
        title="客户与合作方"
        description="登记长期合作的客户、供应商或雇主，登记后可以挂到流水的对手方字段，方便归账与回款查询。"
        action={<Button variant="outline" size="sm" leading={<Plus size={13} />} onClick={add}>新增对手方</Button>}
      />
      <SectionGrid>
        {counterparties.map((cp, index) => (
          <ItemCard
            key={cp.id}
            header={
              <>
                <ColorSwatchPicker
                  value={cp.tintHex || "#7F91D6"}
                  onChange={(hex) => update(index, { tintHex: hex })}
                  icon={<UserSquare size={20} />}
                  label="对手方主题色"
                />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Badge tone={COUNTERPARTY_KIND_TONE[cp.kind] || "neutral"}>
                    {COUNTERPARTY_KIND_OPTIONS.find((opt) => opt.value === cp.kind)?.label || "客户"}
                  </Badge>
                  <span className="font-mono text-[11px] uppercase text-muted-foreground">
                    {(cp.tintHex || "#7F91D6").toUpperCase()}
                  </span>
                </div>
              </>
            }
            onDelete={() => onChange(counterparties.filter((_, i) => i !== index))}
            deleteLabel="删除此对手方"
          >
            <TextInput label="名称" value={cp.name} onChange={(event) => update(index, { name: event.target.value })} />
            <Autocomplete
              label="类型"
              value={cp.kind}
              onChange={(value) => update(index, { kind: value as CounterpartyKind })}
              options={COUNTERPARTY_KIND_OPTIONS}
            />
            <Autocomplete
              label="默认结算账户"
              value={cp.defaultAccountId || ""}
              onChange={(value) => update(index, { defaultAccountId: value })}
              options={accountOptions}
              placeholder="选择账户…"
              searchPlaceholder="搜索账户…"
            />
            <TextInput
              label="联系方式"
              value={cp.contactInfo || ""}
              onChange={(event) => update(index, { contactInfo: event.target.value })}
              placeholder="电话 / 邮箱 / 微信"
            />
            <TextInput label="备注" value={cp.note || ""} onChange={(event) => update(index, { note: event.target.value })} />
            {(() => {
              const stats = recentByCp.get(cp.id);
              if (!stats || stats.count === 0) {
                return (
                  <div className="rounded-md border border-dashed border-border bg-background/30 px-3 py-2 text-[11.5px] text-muted-foreground">
                    近 30 天没有相关流水
                  </div>
                );
              }
              return (
                <div className="rounded-md border border-border bg-background/40 px-3 py-2 text-[12px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-muted-foreground">近 30 天</span>
                    <span className="font-mono text-foreground tabular-nums">{stats.count} 笔</span>
                  </div>
                  <div className="mt-0.5 flex items-baseline justify-between gap-2">
                    <span className="text-muted-foreground">合计</span>
                    <span className={`font-mono tabular-nums ${stats.total >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"}`}>
                      {stats.total >= 0 ? "+" : "−"}{formatCurrency(Math.abs(stats.total))}
                    </span>
                  </div>
                </div>
              );
            })()}
          </ItemCard>
        ))}
      </SectionGrid>
    </Card>
  );
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : "−"}${formatCurrency(Math.abs(value))}`;
}

function TopStat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background/45 p-4">
      <div className="mb-2 flex items-center justify-between text-muted-foreground">
        <span className="text-caption">{label}</span>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted">{icon}</span>
      </div>
      <div className="text-display-sm tabular-nums">{value}</div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div>
        <h2 className="text-title-lg">{title}</h2>
        <p className="text-body-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function SectionGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 p-5 xl:grid-cols-3">{children}</div>;
}

function ItemCard({
  header,
  onDelete,
  deleteLabel,
  actions,
  className,
  children,
}: {
  header: ReactNode;
  onDelete?: () => void;
  deleteLabel?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`group/itemcard relative rounded-lg border border-border bg-background/40 p-4 transition-colors hover:border-border/80 ${className || ""}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">{header}</div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              title={deleteLabel}
              aria-label={deleteLabel}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground opacity-0 transition-all hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover/itemcard:opacity-100"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">{children}</div>
    </div>
  );
}

function LiabilitySummary({ used, limit }: { used: number; limit: number }) {
  const safeLimit = Math.max(limit, 0);
  const safeUsed = Math.max(used, 0);
  const remaining = Math.max(safeLimit - safeUsed, 0);
  const percent = safeLimit > 0 ? Math.min(100, (safeUsed / safeLimit) * 100) : 0;
  const overLimit = safeUsed > safeLimit;
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/8 p-3">
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-muted-foreground">已用 / 总额</span>
        <span className="font-semibold tabular-nums text-foreground">
          {formatCurrency(safeUsed)} / {formatCurrency(safeLimit)}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-amber-500/15">
        <div
          className={`h-full rounded-full ${overLimit ? "bg-destructive" : "bg-amber-500"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-2 flex items-baseline justify-between text-[12px]">
        <span className="text-muted-foreground">{overLimit ? "已超限" : "剩余可用"}</span>
        <span className={`font-semibold tabular-nums ${overLimit ? "text-destructive" : "text-emerald-700"}`}>
          {formatCurrency(remaining)}
        </span>
      </div>
    </div>
  );
}

function ColorSwatchPicker({
  value,
  onChange,
  icon,
  label = "主题色",
}: {
  value: string;
  onChange: (hex: string) => void;
  icon?: ReactNode;
  label?: string;
}) {
  return (
    <label
      className="relative inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-white shadow-sm ring-1 ring-inset ring-black/5 transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring/40"
      style={{ background: value }}
      title="点击更改主题色"
    >
      {icon || <CreditCard size={20} />}
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={label}
      />
    </label>
  );
}

function cloneConfig(config: Configuration): Configuration {
  return JSON.parse(JSON.stringify(config)) as Configuration;
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function ExchangeRatesEditor({
  value,
  onChange,
}: {
  value?: ExchangeRates;
  onChange: (next: ExchangeRates) => void;
}) {
  const baseCurrency = value?.baseCurrency || "CNY";
  const rates = value?.rates || { CNY: 1 };
  const [newCode, setNewCode] = useState("");
  const [newRate, setNewRate] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  const updateRate = (code: string, rate: number) => {
    onChange({
      ...value,
      baseCurrency,
      rates: { ...rates, [code]: rate, [baseCurrency]: 1 },
    });
  };
  const removeRate = (code: string) => {
    if (code === baseCurrency) return;
    const next = { ...rates };
    delete next[code];
    onChange({ ...value, baseCurrency, rates: next });
  };
  const add = () => {
    const code = newCode.trim().toUpperCase();
    const rate = Number(newRate);
    if (!code || !Number.isFinite(rate) || rate <= 0) return;
    updateRate(code, rate);
    setNewCode("");
    setNewRate("");
  };
  const setAutoFetch = (enabled: boolean) => {
    onChange({ ...value, baseCurrency, rates, autoFetch: enabled });
  };
  const refreshNow = async () => {
    setRefreshMsg(null);
    setRefreshing(true);
    try {
      const fresh = await api.refreshExchangeRates();
      onChange(fresh);
      setRefreshMsg(`已拉取 · ${new Date(fresh.updatedAt || Date.now()).toLocaleString("zh-CN")}`);
    } catch (err) {
      setRefreshMsg(`拉取失败：${(err as Error).message || "未知错误"}`);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-[11.5px] text-muted-foreground">
        本位币：<span className="font-semibold text-foreground">{baseCurrency}</span>。其他币种填"1 单位外币 = X {baseCurrency}"。
      </div>
      <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/30 px-3 py-2 text-[12px]">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(value?.autoFetch)}
            onChange={(e) => setAutoFetch(e.target.checked)}
          />
          <span>启动时自动从 open.er-api.com 拉取（默认关闭）</span>
        </label>
        <Button size="sm" variant="outline" onClick={refreshNow} loading={refreshing}>
          立即拉取
        </Button>
      </div>
      {refreshMsg && (
        <div
          className={`rounded-md border px-3 py-1.5 text-[11.5px] ${
            refreshMsg.startsWith("拉取失败")
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {refreshMsg}
        </div>
      )}
      {value?.updatedAt && (
        <div className="text-[11px] text-muted-foreground">
          上次更新：{new Date(value.updatedAt).toLocaleString("zh-CN")}
          {value.lastFetchSource && ` · 来源 ${value.lastFetchSource}`}
        </div>
      )}
      <div className="space-y-1.5">
        {Object.entries(rates)
          .sort((a, b) => (a[0] === baseCurrency ? -1 : b[0] === baseCurrency ? 1 : a[0].localeCompare(b[0])))
          .map(([code, rate]) => (
            <div key={code} className="flex items-center gap-2 rounded-md border border-border bg-background/30 px-2 py-1.5">
              <span className="w-12 font-mono text-[12.5px] font-semibold text-foreground">{code}</span>
              <input
                type="number"
                step="0.0001"
                value={String(rate)}
                onChange={(event) => updateRate(code, Number(event.target.value) || 0)}
                disabled={code === baseCurrency}
                className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-[12.5px] tabular-nums disabled:opacity-60"
              />
              <span className="text-[11px] text-muted-foreground">→ {baseCurrency}</span>
              {code !== baseCurrency && (
                <button
                  type="button"
                  onClick={() => removeRate(code)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="删除"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={newCode}
          onChange={(event) => setNewCode(event.target.value.toUpperCase())}
          placeholder="代码（如 GBP）"
          className="h-7 w-20 rounded-md border border-border bg-background px-2 text-[12.5px] uppercase"
        />
        <input
          type="number"
          step="0.0001"
          value={newRate}
          onChange={(event) => setNewRate(event.target.value)}
          placeholder="汇率"
          className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-[12.5px]"
        />
        <Button size="sm" variant="outline" onClick={add}>添加</Button>
      </div>
    </div>
  );
}

function TaxConfigSection({
  taxConfig,
  onChange,
}: {
  taxConfig: NonNullable<Configuration["settings"]["taxConfig"]>;
  onChange: (next: Configuration["settings"]["taxConfig"]) => void;
}) {
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState<number | "">("");

  const update = (patch: Partial<NonNullable<Configuration["settings"]["taxConfig"]>>) => {
    onChange({ ...taxConfig, ...patch });
  };

  const downloadReport = async () => {
    setDownloadBusy(true);
    try {
      const { blob, filename } = await api.downloadTaxReport({
        year,
        quarter: quarter ? Number(quarter) : undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadBusy(false);
    }
  };

  return (
    <Card padding="none">
      <SectionHeader
        title="税务设置 / 报税导出"
        description="编辑全局税率参数，用于交易上 taxCategory 字段的预估计算与导出。所有数据仅供参考，请以专业税务意见为准。"
      />
      <SectionGrid>
        <ItemCard
          header={
            <>
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Percent size={20} />
              </span>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Badge tone="primary">税率</Badge>
                <span className="font-mono text-[11px] uppercase text-muted-foreground">
                  增值税 {(taxConfig.vatRate * 100).toFixed(2)}%
                </span>
              </div>
            </>
          }
        >
          <TextInput
            label={`增值税率（当前 ${(taxConfig.vatRate * 100).toFixed(2)}%）`}
            type="number"
            step="0.001"
            value={String(taxConfig.vatRate)}
            onChange={(event) => update({ vatRate: Number(event.target.value) || 0 })}
          />
          <TextInput
            label={`个税起征点（年）`}
            type="number"
            value={String(taxConfig.personalThreshold)}
            onChange={(event) => update({ personalThreshold: Number(event.target.value) || 0 })}
          />
          <TextInput
            label={`个税率（当前 ${(taxConfig.personalRate * 100).toFixed(2)}%）`}
            type="number"
            step="0.001"
            value={String(taxConfig.personalRate)}
            onChange={(event) => update({ personalRate: Number(event.target.value) || 0 })}
          />
          <TextInput
            label={`社保 + 公积金合计费率（当前 ${(taxConfig.sebRate * 100).toFixed(2)}%）`}
            type="number"
            step="0.001"
            value={String(taxConfig.sebRate)}
            onChange={(event) => update({ sebRate: Number(event.target.value) || 0 })}
          />
        </ItemCard>

        <ItemCard
          header={
            <>
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <FileSpreadsheet size={20} />
              </span>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Badge tone="brand-blue">导出</Badge>
                <span className="font-mono text-[11px] uppercase text-muted-foreground">
                  5 sheet · xlsx
                </span>
              </div>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="年度"
              type="number"
              value={String(year)}
              onChange={(event) => setYear(Number(event.target.value) || new Date().getFullYear())}
            />
            <Autocomplete
              label="季度（可选）"
              value={String(quarter)}
              onChange={(value) => setQuarter(value ? Number(value) : "")}
              options={[
                { value: "", label: "全年" },
                { value: "1", label: "Q1" },
                { value: "2", label: "Q2" },
                { value: "3", label: "Q3" },
                { value: "4", label: "Q4" },
              ]}
            />
          </div>
          <div className="text-[12px] text-muted-foreground">
            导出 5 个 sheet：业务收入 / 可抵扣 / 不可抵扣 / 汇总 / 说明。所有税务字段在「编辑流水」时设置。
          </div>
          <Button leading={<Receipt size={14} />} onClick={downloadReport} loading={downloadBusy}>
            下载报税表
          </Button>
        </ItemCard>
      </SectionGrid>
    </Card>
  );
}

type ImportTemplate = "wechat" | "alipay" | "generic";
type ImportStep = "upload" | "preview" | "done";

const IMPORT_TEMPLATES: Array<{ value: ImportTemplate; label: string; description: string; help?: string }> = [
  {
    value: "wechat",
    label: "微信支付账单",
    description: "微信账单 CSV，自动跳过顶部说明行。",
    help: "导出路径：微信 → 支付 → 服务 → 钱包 → 账单 → 右上角 → 申请账单（用做记账）→ 邮件接收。",
  },
  {
    value: "alipay",
    label: "支付宝账单",
    description: "支付宝账单 CSV，自动识别表头。",
    help: "导出路径：支付宝 → 我的 → 账单 → 右上角 → 开具交易流水证明 → 邮件接收。",
  },
  {
    value: "generic",
    label: "通用 CSV",
    description: "任意银行 / 平台 CSV，按列名智能匹配。",
    help: "至少需要含「日期」「金额」「交易对方」三列，列名见鼠标 hover 各模板提示。",
  },
];

function ImportSection({
  accounts,
  categories,
  onImported,
}: {
  accounts: Account[];
  categories: CategoryRef[];
  onImported?: () => void;
}) {
  const [template, setTemplate] = useState<ImportTemplate>("generic");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<ImportStep>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [preview, setPreview] = useState<Array<Partial<Transaction> & { __selected: boolean }>>([]);
  const [result, setResult] = useState<{ imported: number; failed: number; errors: Array<{ index: number; error: string }> } | null>(null);

  const accountOptions = [{ value: "", label: "选择账户" }, ...accounts.map((a) => ({ value: a.name, label: a.name }))];
  const categoryOptions = [
    { value: "", label: "未分类" },
    ...categories.map((c) => ({ value: c.id || c.name, label: c.name })),
  ];

  const reset = () => {
    setFile(null);
    setStep("upload");
    setBusy(false);
    setError(null);
    setWarnings([]);
    setPreview([]);
    setResult(null);
  };

  const onPreview = async () => {
    if (!file) {
      setError("请先选择一个文件。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await api.importPreview(template, file);
      setWarnings(data.warnings || []);
      setPreview((data.transactions || []).map((tx) => ({ ...tx, __selected: true })));
      setStep("preview");
    } catch (err) {
      setError((err as Error).message || "解析失败");
    } finally {
      setBusy(false);
    }
  };

  const onCommit = async () => {
    const selected = preview.filter((tx) => tx.__selected).map(({ __selected: _, ...rest }) => rest);
    if (!selected.length) {
      setError("没有选中任何交易。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await api.importCommit(selected);
      setResult(data);
      setStep("done");
      onImported?.();
    } catch (err) {
      setError((err as Error).message || "导入失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="none">
      <SectionHeader
        title="账单导入"
        description="从微信 / 支付宝 / 任意银行 CSV 导入账单。系统会按列名识别 + 用 keywords 自动匹配分类与账户。"
        action={
          step !== "upload" ? (
            <Button variant="outline" size="sm" onClick={reset}>重新开始</Button>
          ) : undefined
        }
      />

      {error && (
        <div className="mx-5 mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
          {error}
        </div>
      )}

      {step === "upload" && (
        <div className="space-y-5 px-5 py-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {IMPORT_TEMPLATES.map((tpl) => (
              <button
                key={tpl.value}
                type="button"
                onClick={() => setTemplate(tpl.value)}
                title={tpl.help}
                className={clsx(
                  "rounded-lg border p-4 text-left transition-colors",
                  template === tpl.value ? "border-primary bg-primary/5" : "border-border hover:border-border/80",
                )}
              >
                <div className="mb-1 text-[14px] font-semibold text-foreground">{tpl.label}</div>
                <div className="text-[12.5px] text-muted-foreground">{tpl.description}</div>
                {template === tpl.value && tpl.help && (
                  <div className="mt-2 rounded border border-border/60 bg-background/50 px-2 py-1 text-[11.5px] text-muted-foreground">
                    💡 {tpl.help}
                  </div>
                )}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-background/30 px-6 py-10 transition-colors hover:bg-background/50">
            <FileUp size={20} className="text-muted-foreground" />
            <span className="text-[13.5px] text-muted-foreground">
              {file ? `已选：${file.name}（${(file.size / 1024).toFixed(1)} KB）` : "点击或拖拽 CSV / TSV 文件到此处"}
            </span>
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              onChange={(event) => {
                const f = event.target.files?.[0];
                if (f) setFile(f);
              }}
              className="hidden"
            />
          </label>
          <div className="flex justify-end">
            <Button leading={<Upload size={14} />} onClick={onPreview} disabled={!file || busy} loading={busy}>
              解析预览
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4 px-5 py-5">
          {warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-300">
              {warnings.map((w, i) => <div key={i}>{w}</div>)}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
            <div className="flex items-center gap-3 text-muted-foreground">
              <span>共解析 {preview.length} 条 · 已选 {preview.filter((p) => p.__selected).length} 条</span>
              <button
                type="button"
                onClick={() => setPreview(preview.map((p) => ({ ...p, __selected: !preview.every((x) => x.__selected) })))}
                className="text-primary hover:underline"
              >
                {preview.every((p) => p.__selected) ? "全不选" : "全选"}
              </button>
            </div>
            <Button leading={<Upload size={14} />} onClick={onCommit} loading={busy}>
              确认导入
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[1100px] table-fixed border-collapse text-left text-[13px]">
              <colgroup>
                <col className="w-[44px]" />
                <col className="w-[150px]" />
                <col className="w-[80px]" />
                <col className="w-[120px]" />
                <col className="w-[220px]" />
                <col className="w-[180px]" />
                <col className="w-[180px]" />
              </colgroup>
              <thead className="bg-muted/30 text-caption-uppercase">
                <tr>
                  <th className="px-3 py-2"></th>
                  <th className="px-3 py-2 font-semibold">时间</th>
                  <th className="px-3 py-2 font-semibold">类型</th>
                  <th className="px-3 py-2 text-right font-semibold">金额</th>
                  <th className="px-3 py-2 font-semibold">摘要</th>
                  <th className="px-3 py-2 font-semibold">分类</th>
                  <th className="px-3 py-2 font-semibold">账户</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((tx, index) => {
                  const cat = (tx.category as { id?: string; name?: string } | undefined) || undefined;
                  return (
                    <tr key={index} className="border-t border-border/60 hover:bg-muted/20">
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={tx.__selected}
                          onChange={(e) => {
                            const next = [...preview];
                            next[index] = { ...next[index], __selected: e.target.checked };
                            setPreview(next);
                          }}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-[12px] text-muted-foreground">
                        {(tx.occurredAt || "").slice(0, 10)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={tx.kind === "income" ? "success" : tx.kind === "transfer" ? "brand-blue" : "destructive"}>
                          {tx.kind === "income" ? "收入" : tx.kind === "transfer" ? "转账" : "支出"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-serif tabular-nums">¥{(tx.amount || 0).toFixed(2)}</td>
                      <td className="truncate px-3 py-2">{tx.title || "未命名"}</td>
                      <td className="px-3 py-2">
                        <Autocomplete
                          size="sm"
                          ariaLabel="分类"
                          value={cat?.id || cat?.name || ""}
                          onChange={(value) => {
                            const target = categories.find((c) => (c.id || c.name) === value);
                            const next = [...preview];
                            next[index] = {
                              ...next[index],
                              category: target
                                ? { id: target.id, name: target.name, tintHex: target.tintHex }
                                : { name: "未分类" },
                            };
                            setPreview(next);
                          }}
                          options={categoryOptions}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Autocomplete
                          size="sm"
                          ariaLabel="账户"
                          value={tx.accountName || ""}
                          onChange={(value) => {
                            const next = [...preview];
                            next[index] = { ...next[index], accountName: value };
                            setPreview(next);
                          }}
                          options={accountOptions}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="space-y-4 px-5 py-8 text-center">
          <div className="text-display-sm">导入完成</div>
          <div className="text-[14px] text-muted-foreground">
            成功 <span className="font-semibold text-emerald-700 dark:text-emerald-300">{result.imported}</span> 条
            {result.failed > 0 && (
              <>，失败 <span className="font-semibold text-destructive">{result.failed}</span> 条</>
            )}
          </div>
          {result.errors.length > 0 && (
            <div className="mx-auto max-w-2xl rounded-md border border-destructive/30 bg-destructive/5 p-3 text-left text-[12px] text-destructive">
              {result.errors.slice(0, 5).map((e) => (
                <div key={e.index}>第 {e.index + 1} 行：{e.error}</div>
              ))}
              {result.errors.length > 5 && <div className="mt-1">...还有 {result.errors.length - 5} 条错误</div>}
            </div>
          )}
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={reset}>再导入一份</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function RecurringSection({ accounts, categories }: { accounts: Account[]; categories: CategoryRef[] }) {
  const { data, loading, refresh } = useApi(() => api.listRecurring(), []);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RecurringRule | null>(null);
  const rules = data || [];
  const accountOptions = [{ value: "", label: "—" }, ...accounts.map((a) => ({ value: a.name, label: a.name }))];
  const categoryOptions = [
    { value: "", label: "—" },
    ...categories.map((c) => ({ value: c.id || c.name, label: c.name })),
  ];

  const updateRule = async (rule: RecurringRule, patch: Partial<RecurringRule>) => {
    setBusy(true);
    try {
      await api.updateRecurring(rule.id, { ...rule, ...patch });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const updateTemplate = async (rule: RecurringRule, templatePatch: Partial<Transaction>) => {
    setBusy(true);
    try {
      await api.updateRecurring(rule.id, { ...rule, template: { ...rule.template, ...templatePatch } });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    setBusy(true);
    try {
      const t = todayIso();
      const defaultCat = categories.find((c) => (c.direction || "支出") === "支出");
      await api.createRecurring({
        name: "新周期账目",
        frequency: "monthly",
        intervalN: 1,
        startDate: t,
        nextDueAt: t,
        enabled: true,
        template: {
          title: "新周期账目",
          amount: 100,
          kind: "expense",
          accountName: accounts[0]?.name || "",
          merchant: "",
          note: "",
          category: defaultCat
            ? { id: defaultCat.id, name: defaultCat.name, tintHex: defaultCat.tintHex }
            : { name: "未分类" },
        },
      });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = (rule: RecurringRule) => setDeleteTarget(rule);

  const performRemove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.deleteRecurring(deleteTarget.id);
      setDeleteTarget(null);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="none">
      <SectionHeader
        title="周期账目"
        description="按日 / 周 / 月 / 年自动生成交易，例如订阅、租金、固定工资。系统启动 + 每次刷新都会扫一次到期规则。"
        action={
          <Button variant="outline" size="sm" leading={<Plus size={13} />} onClick={add} loading={busy}>
            新增规则
          </Button>
        }
      />
      {loading && !data ? (
        <div className="px-5 py-8 text-center text-body-sm text-muted-foreground">载入中...</div>
      ) : rules.length === 0 ? (
        <div className="px-5 py-8 text-center text-body-sm text-muted-foreground">
          还没有周期规则。点右上角「新增规则」开始。
        </div>
      ) : (
        <SectionGrid>
          {rules.map((rule) => {
            const tpl = rule.template || {};
            const kind = (tpl.kind as TransactionKind) || "expense";
            const tplCategory = (tpl.category as { id?: string; name?: string } | undefined) || undefined;
            return (
              <ItemCard
                key={rule.id}
                header={
                  <>
                    <span
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white shadow-sm"
                      style={{ background: tplCategory?.name ? "#7f91d6" : "#9aa0a6" }}
                    >
                      <Repeat size={20} />
                    </span>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <Badge tone={rule.enabled ? "success" : "neutral"}>
                        {rule.enabled ? `${FREQUENCY_LABEL[rule.frequency]} · 启用` : "已暂停"}
                      </Badge>
                      <span className="font-mono text-[11px] uppercase text-muted-foreground">
                        下次：{rule.nextDueAt}
                      </span>
                    </div>
                  </>
                }
                onDelete={() => remove(rule)}
                deleteLabel="删除此规则"
              >
                <TextInput
                  label="规则名"
                  value={rule.name}
                  onChange={(event) => updateRule(rule, { name: event.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Autocomplete
                    label="类型"
                    value={kind}
                    onChange={(value) => updateTemplate(rule, { kind: value as TransactionKind })}
                    options={TRANSACTION_KIND_OPTIONS}
                  />
                  <TextInput
                    label="金额"
                    type="number"
                    value={String(tpl.amount ?? 0)}
                    onChange={(event) => updateTemplate(rule, { amount: Number(event.target.value) || 0 })}
                  />
                </div>
                <TextInput
                  label="标题"
                  value={String(tpl.title || "")}
                  onChange={(event) => updateTemplate(rule, { title: event.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Autocomplete
                    label="账户"
                    value={String(tpl.accountName || "")}
                    onChange={(value) => updateTemplate(rule, { accountName: value })}
                    options={accountOptions}
                    placeholder="选择账户…"
                    searchPlaceholder="搜索账户…"
                  />
                  <Autocomplete
                    label="分类"
                    value={tplCategory?.id || tplCategory?.name || ""}
                    onChange={(value) => {
                      const cat = categories.find((c) => (c.id || c.name) === value);
                      updateTemplate(rule, {
                        category: cat
                          ? { id: cat.id, name: cat.name, tintHex: cat.tintHex }
                          : { name: "未分类" },
                      });
                    }}
                    options={categoryOptions}
                    placeholder="选择分类…"
                    searchPlaceholder="搜索分类…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Autocomplete
                    label="频率"
                    value={rule.frequency}
                    onChange={(value) => updateRule(rule, { frequency: value as RecurringFrequency })}
                    options={FREQUENCY_OPTIONS}
                  />
                  <TextInput
                    label="间隔"
                    type="number"
                    value={String(rule.intervalN || 1)}
                    onChange={(event) => updateRule(rule, { intervalN: Math.max(1, Number(event.target.value) || 1) })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <TextInput
                    label="起始日期"
                    type="date"
                    value={rule.startDate}
                    onChange={(event) => updateRule(rule, { startDate: event.target.value })}
                  />
                  <TextInput
                    label="下次触发"
                    type="date"
                    value={rule.nextDueAt}
                    onChange={(event) => updateRule(rule, { nextDueAt: event.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <TextInput
                    label="结束日期（可空）"
                    type="date"
                    value={rule.endDate || ""}
                    onChange={(event) => updateRule(rule, { endDate: event.target.value || null })}
                  />
                  <Autocomplete
                    label="是否启用"
                    value={rule.enabled ? "yes" : "no"}
                    onChange={(value) => updateRule(rule, { enabled: value === "yes" })}
                    options={[
                      { value: "yes", label: "启用" },
                      { value: "no", label: "暂停" },
                    ]}
                  />
                </div>
                {rule.lastRunAt && (
                  <div className="rounded-md border border-border bg-background/40 px-3 py-2 text-[12px] text-muted-foreground">
                    上次生成：{new Date(rule.lastRunAt).toLocaleString("zh-CN")}
                  </div>
                )}
              </ItemCard>
            );
          })}
        </SectionGrid>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        tone="destructive"
        title="删除周期账目"
        description={deleteTarget ? `确认删除「${deleteTarget.name}」？此操作不可恢复。` : undefined}
        confirmLabel="删除"
        busy={busy}
        onConfirm={performRemove}
        onCancel={() => setDeleteTarget(null)}
      />
    </Card>
  );
}
