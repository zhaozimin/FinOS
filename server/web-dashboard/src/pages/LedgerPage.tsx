import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, Eye, Pencil, Plus, Search } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { CategoryTabs } from "../components/ui/Tabs";
import { TextInput } from "../components/ui/TextInput";
import { TransactionEditSheet } from "../components/TransactionEditSheet";
import { AttachmentLightbox } from "../components/AttachmentLightbox";
import type { AttachmentRef } from "../types";
import { api } from "../api/client";
import { useApi } from "../lib/useApi";
import { formatCurrency } from "../lib/format";
import { useTimeRangeStore } from "../store/timeRange";
import { dailyGroups, filterTransactions, summarizeTransactions } from "../lib/financeAnalytics";
import type { Transaction, TransactionKind } from "../types";

type KindFilter = "all" | TransactionKind | "adjustment";

const KIND_OPTIONS: Array<{ value: KindFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "income", label: "收入" },
  { value: "expense", label: "支出" },
  { value: "transfer", label: "转账" },
  { value: "adjustment", label: "余额调整" },
];

const KIND_LABEL: Record<TransactionKind, string> = {
  income: "收入",
  expense: "支出",
  transfer: "转账",
};

const KIND_TONE: Record<TransactionKind, "success" | "destructive" | "brand-blue"> = {
  income: "success",
  expense: "destructive",
  transfer: "brand-blue",
};

const KIND_ICON: Record<TransactionKind, ReactNode> = {
  income: <ArrowDownRight size={14} />,
  expense: <ArrowUpRight size={14} />,
  transfer: <ArrowLeftRight size={14} />,
};

export function LedgerPage() {
  const dimension = useTimeRangeStore((s) => s.dimension);
  const bucket = useTimeRangeStore((s) => s.bucket);
  const [kind, setKind] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const target = sessionStorage.getItem("ledger-search-q");
    if (target) {
      setSearch(target);
      sessionStorage.removeItem("ledger-search-q");
    }
  }, []);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [lightboxAttachments, setLightboxAttachments] = useState<AttachmentRef[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const { data: configuration } = useApi(() => api.configuration(), []);
  const { data: transactionData, loading, refresh } = useApi(
    () => api.listTransactions({ limit: 3000 }),
    [],
  );
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const { data: budgetStatus } = useApi(
    () => api.budgetStatus({ month: currentMonth }),
    [currentMonth],
  );

  const accounts = configuration?.accounts || [];
  const transactions = transactionData || [];
  const filtered = useMemo(() => {
    let items = filterTransactions(transactions, accounts, "combined", dimension, bucket);
    if (kind === "adjustment") {
      items = items.filter((tx) => tx.source === "adjustment");
    } else if (kind !== "all") {
      items = items.filter((tx) => tx.kind === kind);
    }
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      items = items.filter((tx) =>
        [tx.title, tx.merchant, tx.note, tx.accountName, tx.category?.name, tx.projectName, ...(tx.tags || [])]
          .filter(Boolean)
          .some((item) => String(item).toLowerCase().includes(needle)),
      );
    }
    return items;
  }, [accounts, bucket, dimension, kind, search, transactions]);

  const stats = useMemo(() => summarizeTransactions(filtered), [filtered]);
  const groups = useMemo(() => dailyGroups(filtered), [filtered]);

  const onSaved = () => {
    setEditorOpen(false);
    setEditTarget(null);
    refresh();
  };

  const onDeleted = () => {
    setEditorOpen(false);
    setEditTarget(null);
    refresh();
  };

  return (
    <div className="space-y-5">
      <Card padding="none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h1 className="text-display-sm">流水</h1>
            <p className="text-body-sm text-muted-foreground">
              按日期汇总当前区间内的收支记录。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CategoryTabs value={kind} onChange={setKind} options={KIND_OPTIONS} />
            <Button
              leading={<Plus size={14} />}
              onClick={() => {
                setEditTarget(null);
                setEditorOpen(true);
              }}
            >
              新增交易
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-[1fr_260px]">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <SmallStat label="记录天数" value={stats.dayCount} />
            <SmallStat label="记录条数" value={stats.count} />
            <SmallStat label="区间收入" value={formatCurrency(stats.income)} tone="success" />
            <SmallStat label="内部转账" value={formatCurrency(stats.transfer)} />
            <SmallStat
              label="区间净额"
              value={formatCurrency(stats.net)}
              tone={stats.net > 0 ? "success" : stats.net < 0 ? "warning" : "neutral"}
            />
          </div>
          <TextInput
            label="搜索"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="标题 / 商户 / 账户 / 分类"
            leading={<Search size={14} />}
          />
        </div>
        {kind === "expense" && budgetStatus && budgetStatus.items.length > 0 && (
          <BudgetMiniBar
            totalBudget={budgetStatus.totalBudget}
            totalSpent={budgetStatus.totalSpent}
            month={budgetStatus.month}
          />
        )}
      </Card>

      {loading && !transactionData && <div className="h-[360px] rounded-lg bg-muted animate-pulse" />}
      {!loading && groups.length === 0 && <Card><div className="empty-state">当前筛选下暂无流水。</div></Card>}

      {groups.map((group) => (
        <Card key={group.date} padding="none">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="text-display-sm tabular-nums">{group.date.replaceAll("-", ".")}</h2>
              <p className="text-body-sm text-muted-foreground">按日期分类汇总当前流水。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill label="收入" value={formatCurrency(group.summary.income)} tone={group.summary.income > 0 ? "success" : "neutral"} />
              <Pill label="支出" value={formatCurrency(group.summary.expense)} tone={group.summary.expense !== 0 ? "destructive" : "neutral"} />
              <Pill label="转账" value={formatCurrency(group.summary.transfer)} tone={group.summary.transfer !== 0 ? "transfer" : "neutral"} />
              <Pill
                label="净额"
                value={formatCurrency(group.summary.net)}
                tone={group.summary.net > 0 ? "success" : group.summary.net < 0 ? "destructive" : "neutral"}
              />
            </div>
          </div>

          <div>
            <table className="w-full table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[60px]" />
                <col className="w-[82px]" />
                <col />
                <col />
                <col className="w-[104px]" />
                <col className="w-[92px]" />
                <col className="w-[44px]" />
                <col className="w-[44px]" />
                <col className="w-[118px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border text-caption-uppercase">
                  <th className="px-3 py-3 font-semibold">时间</th>
                  <th className="px-2 py-3 font-semibold">类型</th>
                  <th className="px-3 py-3 font-semibold">摘要</th>
                  <th className="px-3 py-3 font-semibold">账户</th>
                  <th className="px-3 py-3 font-semibold">分类</th>
                  <th className="px-3 py-3 font-semibold">项目</th>
                  <th className="px-1 py-3 text-center font-semibold">附件</th>
                  <th className="px-1 py-3 text-center font-semibold">编辑</th>
                  <th className="px-3 py-3 text-right font-semibold">金额</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/80 last:border-0 hover:bg-muted/25">
                    <td className="px-3 py-3 text-mono text-muted-foreground">{tx.occurredAt.slice(11, 16)}</td>
                    <td className="px-2 py-3">
                      <Badge tone={KIND_TONE[tx.kind]} className="gap-1">
                        {KIND_ICON[tx.kind]}
                        {KIND_LABEL[tx.kind]}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditTarget(tx);
                          setEditorOpen(true);
                        }}
                        className="block max-w-full truncate text-left font-semibold text-foreground hover:text-primary"
                      >
                        {tx.title}
                      </button>
                      {tx.merchant && tx.merchant !== tx.title && (
                        <div className="truncate text-caption">{tx.merchant}</div>
                      )}
                    </td>
                    <td className="truncate px-3 py-3 text-body-sm text-muted-foreground">
                      {tx.kind === "transfer"
                        ? `${tx.fromAccountName || "?"} → ${tx.toAccountName || "?"}`
                        : tx.accountName}
                    </td>
                    <td className="truncate px-3 py-3 text-body-sm">{tx.category?.name || "未分类"}</td>
                    <td className="truncate px-3 py-3 text-body-sm text-muted-foreground">{tx.projectName || "—"}</td>
                    <td className="px-1 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {(tx.attachments?.length || 0) > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setLightboxAttachments(tx.attachments || []);
                              setLightboxOpen(true);
                            }}
                            title={`查看 ${tx.attachments!.length} 个附件`}
                            aria-label={`查看 ${tx.attachments!.length} 个附件`}
                            className="relative inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <Eye size={14} />
                            {tx.attachments!.length > 1 && (
                              <span className="absolute -top-1 -right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-primary px-[3px] text-[9px] font-semibold leading-none text-primary-foreground">
                                {tx.attachments!.length}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="text-[12px] text-muted-foreground/40">—</span>
                        )}
                        {tx.invoiceIssued && !tx.invoiceAttachmentId && (
                          <span
                            title="缺发票附件"
                            className="rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300"
                          >
                            缺
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-1 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setEditTarget(tx);
                          setEditorOpen(true);
                        }}
                        title="编辑"
                        aria-label="编辑"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Pencil size={13} />
                      </button>
                    </td>
                    <td className={`px-3 py-3 text-right font-serif text-[16px] tabular-nums ${tx.kind === "income" ? "text-emerald-800" : tx.kind === "expense" ? "text-red-700" : "text-blue-800"}`}>
                      {tx.kind === "expense" ? "−" : tx.kind === "income" ? "+" : ""}
                      ¥{tx.amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      <TransactionEditSheet
        open={editorOpen}
        initial={editTarget}
        onClose={() => {
          setEditorOpen(false);
          setEditTarget(null);
        }}
        onSaved={onSaved}
        onDeleted={onDeleted}
      />

      <AttachmentLightbox
        open={lightboxOpen}
        attachments={lightboxAttachments}
        onClose={() => {
          setLightboxOpen(false);
          setLightboxAttachments([]);
        }}
        onDelete={() => {
          setLightboxOpen(false);
          setLightboxAttachments([]);
          refresh();
        }}
      />
    </div>
  );
}

function BudgetMiniBar({
  totalBudget,
  totalSpent,
  month,
}: {
  totalBudget: number;
  totalSpent: number;
  month: string;
}) {
  const percent = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;
  const overflow = totalBudget > 0 && totalSpent > totalBudget;
  const remaining = totalBudget - totalSpent;
  const tone = overflow
    ? { text: "text-destructive", bg: "bg-destructive", track: "bg-destructive/15" }
    : percent > 80
      ? { text: "text-amber-700 dark:text-amber-300", bg: "bg-amber-500", track: "bg-amber-500/15" }
      : { text: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-500", track: "bg-emerald-500/15" };
  return (
    <div className="border-t border-border px-5 py-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-caption text-muted-foreground">{month} 总预算进度</span>
        <span className={`text-[12.5px] tabular-nums font-medium ${tone.text}`}>
          {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)} · {percent.toFixed(1)}%
          {overflow ? ` · 超支 ${formatCurrency(-remaining)}` : ` · 剩余 ${formatCurrency(remaining)}`}
        </span>
      </div>
      <div className={`h-1.5 overflow-hidden rounded-full ${tone.track}`}>
        <div className={`h-full rounded-full ${tone.bg}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function SmallStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "success" | "warning";
}) {
  const color = {
    neutral: "text-foreground",
    success: "text-emerald-800",
    warning: "text-red-700",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-background/45 p-4">
      <div className="text-caption">{label}</div>
      <div className={`mt-1 text-display-sm tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function Pill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "destructive" | "transfer";
}) {
  const toneClass = {
    neutral: "border-border bg-background/45 text-muted-foreground",
    success: "border-emerald-700/25 bg-emerald-600/10 text-emerald-900",
    destructive: "border-red-700/25 bg-red-600/10 text-red-800",
    transfer: "border-blue-700/25 bg-blue-600/10 text-blue-900",
  }[tone];

  return (
    <span className={`rounded-md border px-3 py-1.5 text-[13px] tabular-nums ${toneClass}`}>
      {label} {value}
    </span>
  );
}
