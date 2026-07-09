import { Outlet, useLocation } from "react-router-dom";
import { Menu, RefreshCw, LogOut, Search } from "lucide-react";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Sidebar } from "./Sidebar";
import { StatusIndicator } from "./StatusIndicator";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { ProductLogo } from "./ProductLogo";
import { GlobalSearchPalette } from "./GlobalSearchPalette";
import { api, clearToken } from "../api/client";
import { useApi } from "../lib/useApi";
import { rangeLabel } from "../lib/timeRange";
import { useTimeRangeStore } from "../store/timeRange";

const PAGE_TITLE: Record<string, string> = {
  "/": "资金流量",
  "/flow": "资金流量",
  "/status": "财务状况",
  "/ledger": "资金流水",
  "/settings": "财务设置",
};

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const dimension = useTimeRangeStore((s) => s.dimension);
  const bucket = useTimeRangeStore((s) => s.bucket);
  const { data: transactionData } = useApi(() => api.listTransactions({ limit: 2000 }), []);
  const { data: configuration } = useApi(() => api.configuration(), []);
  const transactions = transactionData || [];
  const pageTitle = PAGE_TITLE[location.pathname] || "资金流量";
  const dateLabel = rangeLabel(dimension, bucket, transactions);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/88 backdrop-blur-xl">
        <div className="flex h-[72px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="展开侧边栏"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card/70 text-foreground hover:bg-accent"
            >
              <Menu size={18} />
            </button>
            <div className="flex min-w-0 items-baseline gap-3">
              <ProductLogo compact />
              <span className="hidden h-4 w-px self-center bg-border sm:block" />
              <div className="hidden min-w-0 items-baseline gap-2 text-[13px] leading-none sm:flex">
                <span className="whitespace-nowrap font-semibold text-foreground">{pageTitle}</span>
                <span className="whitespace-nowrap tabular-nums text-muted-foreground">{dateLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden md:block">
              <StatusIndicator />
            </div>
            <button
              type="button"
              aria-label="全局搜索（⌘K）"
              title="全局搜索（⌘K）"
              onClick={() => setSearchOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card/70 px-3 text-[12.5px] text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Search size={14} />
              <span className="hidden sm:inline">搜索…</span>
              <span className="hidden rounded border border-border bg-muted/40 px-1 py-0.5 font-mono text-[10px] sm:inline">⌘K</span>
            </button>
            <ThemeSwitcher compact />
            <button
              type="button"
              aria-label="刷新页面"
              onClick={() => window.location.reload()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card/70 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <RefreshCw size={16} />
            </button>
            <button
              type="button"
              aria-label="退出登录"
              onClick={() => {
                clearToken();
                window.location.reload();
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card/70 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        transactions={transactions}
      />

      <main
        className={clsx(
          "mx-auto w-full max-w-[1600px] px-4 py-5 transition duration-200 sm:px-6 lg:px-8",
          sidebarOpen && "blur-[2px]",
        )}
      >
        <Outlet />
      </main>

      <GlobalSearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        transactions={transactions}
        accounts={configuration?.accounts || []}
        projects={configuration?.settings?.projects || []}
        categories={configuration?.categories || []}
        counterparties={configuration?.settings?.counterparties || []}
      />
    </div>
  );
}
