import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TimeDimension = "all" | "custom" | "week" | "month" | "quarter" | "year";

interface TimeRangeState {
  dimension: TimeDimension;
  /** ISO 形式的具体范围键：custom=YYYY-MM-DD..YYYY-MM-DD / week=YYYY-Www / month=YYYY-MM / quarter=YYYY-Qn / year=YYYY / all="" */
  bucket: string;
  setDimension: (dim: TimeDimension) => void;
  setBucket: (bucket: string) => void;
}

export const useTimeRangeStore = create<TimeRangeState>()(
  persist(
    (set) => ({
      dimension: "all",
      bucket: "",
      setDimension: (dim) => set({ dimension: dim }),
      setBucket: (bucket) => set({ bucket }),
    }),
    {
      name: "finance-time-range",
      version: 3,
      migrate: () => ({ dimension: "all", bucket: "" }),
    },
  ),
);
