import { NavLink } from "react-router-dom";
import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  ReceiptText,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useTimeRangeStore, type TimeDimension } from "../store/timeRange";
import {
  deriveBuckets,
  formatDateDots,
  isoDay,
  monthKey,
  rangeBounds,
  rangeBucket,
  startOfDay,
} from "../lib/timeRange";
import type { Transaction } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  transactions: Transaction[];
}

type PickerDimension = Exclude<TimeDimension, "all" | "custom">;
type DateRangeDraft = { from?: Date; to?: Date };

const quickRanges: Array<{ value: PickerDimension | "all"; label: string }> = [
  { value: "year", label: "年" },
  { value: "quarter", label: "季度" },
  { value: "month", label: "月" },
  { value: "week", label: "周" },
  { value: "all", label: "全部" },
];

const navItems = [
  { to: "/", label: "资金流量", icon: GitBranch, end: true },
  { to: "/status", label: "财务状况", icon: BarChart3 },
  { to: "/ledger", label: "资金流水", icon: ReceiptText },
  { to: "/settings", label: "财务设置", icon: SlidersHorizontal },
];

const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const pickerLabel: Record<PickerDimension, string> = {
  year: "选择发生过流水的年份",
  quarter: "选择发生过流水的季度",
  month: "选择发生过流水的月份",
  week: "选择发生过流水的周",
};
const monthNames = Array.from({ length: 12 }, (_, index) =>
  new Date(2026, index, 1).toLocaleDateString("en-US", { month: "long" }),
);

export function Sidebar({ open, onClose, transactions }: Props) {
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [pickerOpen, setPickerOpen] = useState<PickerDimension | null>(null);
  const [draftRange, setDraftRange] = useState<DateRangeDraft>({});
  const { dimension, bucket, setDimension, setBucket } = useTimeRangeStore();
  const monthExpense = useMemo(() => expenseByDay(transactions), [transactions]);
  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth]);
  const activePicker = pickerOpen || "month";
  const availableBuckets = useMemo(
    () => deriveBuckets(transactions, activePicker),
    [activePicker, transactions],
  );
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const tx of transactions) {
      const year = Number(tx.occurredAt.slice(0, 4));
      if (year) years.add(year);
    }
    years.add(visibleMonth.getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions, visibleMonth]);
  const storedRange = useMemo(() => {
    if (dimension !== "custom") return {};
    return rangeBounds("custom", bucket);
  }, [bucket, dimension]);
  const selectedRange = draftRange.from ? draftRange : storedRange;

  const locate = (dim: PickerDimension | "all") => {
    if (dim === "all") {
      setDimension("all");
      setBucket("");
      setPickerOpen(null);
      setDraftRange({});
      return;
    }
    setPickerOpen((current) => (current === dim ? null : dim));
  };

  const chooseBucket = (nextBucket: string) => {
    if (!pickerOpen) return;
    setDimension(pickerOpen);
    setBucket(nextBucket);
    setPickerOpen(null);
    setDraftRange({});
    syncVisibleMonth(pickerOpen, nextBucket, setVisibleMonth);
  };

  const chooseDay = (date: Date) => {
    const day = startOfDay(date);
    if (!draftRange.from || draftRange.to) {
      setDraftRange({ from: day });
      setDimension("custom");
      setBucket(rangeBucket(day, day));
      setVisibleMonth(new Date(day.getFullYear(), day.getMonth(), 1));
      return;
    }

    const [from, to] =
      draftRange.from.getTime() <= day.getTime() ? [draftRange.from, day] : [day, draftRange.from];
    setDraftRange({ from, to });
    setDimension("custom");
    setBucket(rangeBucket(from, to));
    setVisibleMonth(new Date(day.getFullYear(), day.getMonth(), 1));
  };

  const changeMonth = (month: number) => {
    setVisibleMonth((date) => new Date(date.getFullYear(), month, 1));
  };

  const changeYear = (year: number) => {
    setVisibleMonth((date) => new Date(year, date.getMonth(), 1));
  };

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="关闭侧边栏遮罩"
          onClick={onClose}
          className="fixed inset-0 z-50 bg-background/40 backdrop-blur-[6px]"
        />
      )}
      <aside
        className={clsx(
          "fixed bottom-3 left-3 top-3 z-50 flex w-[min(390px,calc(100vw-24px))] flex-col overflow-visible rounded-lg border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[0_30px_100px_rgba(0,0,0,0.28)] transition duration-200",
          open ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-8 opacity-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-primary" />
            <span className="text-title-sm">快速定位</span>
          </div>
          <button
            type="button"
            aria-label="关闭侧边栏"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 overflow-hidden p-4">
          <section className="relative rounded-lg border border-sidebar-border bg-background/35 p-2.5">
            <div className="grid grid-cols-5 gap-2">
              {quickRanges.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => locate(item.value)}
                  className={clsx(
                    "h-8 rounded-md border text-[13px] font-semibold transition-colors",
                    (dimension === item.value || pickerOpen === item.value)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-sidebar-border bg-sidebar-accent/45 text-muted-foreground hover:text-sidebar-foreground",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {pickerOpen && (
              <div className="absolute left-2.5 right-2.5 top-[48px] z-[75] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-2xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-muted-foreground">
                    {pickerLabel[pickerOpen]}
                  </span>
                  <button
                    type="button"
                    aria-label="关闭快速定位选择"
                    onClick={() => setPickerOpen(null)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                </div>
                <select
                  autoFocus
                  value={bucket}
                  onChange={(event) => chooseBucket(event.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none"
                >
                  {availableBuckets.length === 0 && <option value="">暂无流水时间</option>}
                  {availableBuckets.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-sidebar-border bg-background/35 p-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="上个月"
                onClick={() => setVisibleMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="grid flex-1 grid-cols-[1fr_92px] gap-2">
                <FlatSelect
                  ariaLabel="选择月份"
                  value={String(visibleMonth.getMonth())}
                  onChange={(value) => changeMonth(Number(value))}
                  options={monthNames.map((name, index) => ({
                    value: String(index),
                    label: name,
                  }))}
                />
                <FlatSelect
                  ariaLabel="选择年份"
                  value={String(visibleMonth.getFullYear())}
                  onChange={(value) => changeYear(Number(value))}
                  options={availableYears.map((year) => ({
                    value: String(year),
                    label: String(year),
                  }))}
                />
              </div>
              <button
                type="button"
                aria-label="下个月"
                onClick={() => setVisibleMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="mb-2 rounded-md border border-sidebar-border bg-background/50 px-2.5 py-1.5 text-[11px] text-muted-foreground">
              {selectedRange.from
                ? `${formatDateDots(selectedRange.from)} - ${formatDateDots(selectedRange.to || selectedRange.from)}`
                : "点击日期选择起点，再点击终点完成区间"}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
              {weekdays.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-7 gap-1">
              {days.map((date) => {
                const key = isoDay(date);
                const amount = monthExpense.get(key) || 0;
                const inMonth = monthKey(date) === monthKey(visibleMonth);
                const today = isoDay(date) === isoDay(new Date());
                const rangeState = getRangeState(date, selectedRange);
                const selectedEdge = rangeState.start || rangeState.end;
                return (
                  <button
                    key={key}
                    type="button"
                    title={`${formatDateDots(date)} 支出 ${formatAmount(amount)}`}
                    onClick={() => chooseDay(date)}
                    style={getDayStyle(rangeState)}
                    className={clsx(
                      "min-h-[34px] rounded-md border px-1 py-0.5 text-center transition-colors",
                      inMonth ? "bg-sidebar-accent/55" : "text-muted-foreground/45",
                      rangeState.inRange && !selectedEdge && "font-semibold text-foreground",
                      selectedEdge && "font-semibold",
                      today && !selectedEdge && "border-primary bg-card text-foreground",
                      "hover:border-primary/60 hover:bg-card hover:text-foreground",
                    )}
                  >
                    <span className="block text-[12px] tabular-nums">{date.getDate()}</span>
                    {amount > 0 && inMonth && (
                      <span
                        className={clsx(
                          "block truncate text-[9px] leading-3 tabular-nums",
                          selectedEdge ? "text-primary-foreground/85" : "text-muted-foreground",
                        )}
                      >
                        {formatAmount(amount)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <nav className="mt-auto border-t border-sidebar-border pt-2.5">
            <div className="space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      clsx(
                        "flex h-9 items-center gap-3 rounded-md px-3 text-[14px] font-semibold transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/55 hover:text-sidebar-foreground",
                      )
                    }
                  >
                    <Icon size={17} />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </nav>
        </div>
      </aside>
    </>
  );
}

function FlatSelect({
  ariaLabel,
  value,
  onChange,
  options,
}: {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full appearance-none rounded-md border border-sidebar-border bg-sidebar-accent/40 pl-2 pr-6 text-center text-[13px] font-semibold text-foreground outline-none transition-colors hover:bg-sidebar-accent focus:border-primary"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        strokeWidth={2.2}
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

function syncVisibleMonth(
  dim: PickerDimension,
  nextBucket: string,
  setVisibleMonth: (updater: Date | ((date: Date) => Date)) => void,
) {
  const { from } = rangeBounds(dim, nextBucket);
  if (from) setVisibleMonth(new Date(from.getFullYear(), from.getMonth(), 1));
}

function getRangeState(date: Date, range: DateRangeDraft) {
  const day = startOfDay(date).getTime();
  const from = range.from ? startOfDay(range.from).getTime() : undefined;
  const to = range.to ? startOfDay(range.to).getTime() : from;
  return {
    start: from !== undefined && day === from,
    end: to !== undefined && day === to && to !== from,
    inRange: from !== undefined && to !== undefined && day >= Math.min(from, to) && day <= Math.max(from, to),
  };
}

function getDayStyle(rangeState: ReturnType<typeof getRangeState>) {
  if (rangeState.start || rangeState.end) {
    return {
      backgroundColor: "var(--primary)",
      borderColor: "var(--primary)",
      color: "var(--primary-foreground)",
    };
  }
  if (rangeState.inRange) {
    return {
      backgroundColor: "color-mix(in oklab, var(--primary) 14%, transparent)",
      borderColor: "color-mix(in oklab, var(--primary) 38%, transparent)",
    };
  }
  return undefined;
}

function expenseByDay(transactions: Transaction[]) {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.kind !== "expense") continue;
    const day = tx.occurredAt.slice(0, 10);
    map.set(day, (map.get(day) || 0) + tx.amount);
  }
  return map;
}

function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const visibleDays = first.getDay() + last.getDate() > 35 ? 42 : 35;
  return Array.from({ length: visibleDays }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function formatAmount(amount: number) {
  if (!amount) return "¥0";
  if (amount >= 1000) return `¥${(amount / 1000).toFixed(1)}k`;
  return `¥${Math.round(amount)}`;
}
