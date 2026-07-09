import { useMemo } from "react";
import { CategoryTabs } from "./ui/Tabs";
import { Select } from "./ui/Select";
import { useTimeRangeStore, type TimeDimension } from "../store/timeRange";
import { deriveBuckets, transactionMatchesRange } from "../lib/timeRange";
import type { Transaction } from "../types";

const DIMENSIONS: Array<{ value: TimeDimension; label: string }> = [
  { value: "custom", label: "自定义" },
  { value: "week", label: "本周" },
  { value: "month", label: "本月" },
  { value: "quarter", label: "本季度" },
  { value: "year", label: "本年" },
  { value: "all", label: "全部时间" },
];

const HINT: Record<TimeDimension, string> = {
  custom: "使用侧边栏日历选择区间。",
  week: "仅显示有流水的周次。",
  month: "仅显示有流水的月份。",
  quarter: "仅显示有流水的季度。",
  year: "仅显示有流水的年份。",
  all: "全部时间内的所有流水。",
};

interface Props {
  transactions: Transaction[];
}

/** 智能时间筛选：维度 + 仅有流水的具体值。 */
export function TimeRangePicker({ transactions }: Props) {
  const { dimension, bucket, setDimension, setBucket } = useTimeRangeStore();

  const buckets = useMemo(() => deriveBuckets(transactions, dimension), [transactions, dimension]);

  // 当 dimension 切换时，bucket 可能不再有效，自动选第一个
  const effectiveBucket = useMemo(() => {
    if (dimension === "all" || dimension === "custom") return "";
    if (buckets.find((b) => b.value === bucket)) return bucket;
    return buckets[0]?.value || "";
  }, [bucket, buckets, dimension]);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <span className="block text-[11px] font-semibold tracking-wider uppercase text-muted-foreground mb-1.5">
          时间维度
        </span>
        <CategoryTabs
          value={dimension}
          onChange={(v) => {
            setDimension(v);
            // 自动定位到第一个有数据的 bucket
            const next = deriveBuckets(transactions, v);
            setBucket(next[0]?.value || "");
          }}
          options={DIMENSIONS}
          size="sm"
        />
      </div>
      {dimension !== "all" && dimension !== "custom" && (
        <div className="min-w-[200px]">
          <Select
            label={LABEL_FOR_DIM[dimension]}
            value={effectiveBucket}
            onChange={(e) => setBucket(e.target.value)}
            options={
              buckets.length > 0
                ? buckets
                : [{ value: "", label: "（无流水）", disabled: true }]
            }
            hint={HINT[dimension]}
          />
        </div>
      )}
    </div>
  );
}

const LABEL_FOR_DIM: Record<TimeDimension, string> = {
  custom: "",
  week: "选择周",
  month: "选择月",
  quarter: "选择季度",
  year: "选择年",
  all: "",
};

export { transactionMatchesRange };
