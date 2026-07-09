import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { TokenGate } from "./components/TokenGate";
import { ThemeProvider } from "./components/ThemeProvider";
import { OverviewPage } from "./pages/OverviewPage";
import { FlowPage } from "./pages/FlowPage";
import { LedgerPage } from "./pages/LedgerPage";
import { SettingsPage } from "./pages/SettingsPage";
import { api, getToken, setToken } from "./api/client";

function consumeUrlToken(): boolean {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("token") || url.searchParams.get("access_token");
  if (!token) return false;
  setToken(token.trim());
  url.searchParams.delete("token");
  url.searchParams.delete("access_token");
  // 写回 URL，去掉 token 参数（使用 history API 不刷新页面）
  const cleanUrl = url.pathname + (url.search || "") + url.hash;
  window.history.replaceState({}, "", cleanUrl);
  return true;
}

export function App() {
  const [authState, setAuthState] = useState<"loading" | "ok" | "needs-token">("loading");

  useEffect(() => {
    consumeUrlToken();
    const token = getToken();
    if (!token) {
      setAuthState("needs-token");
      return;
    }
    api
      .health()
      .then(() => setAuthState("ok"))
      .catch((err) => {
        if (err && typeof err === "object" && "status" in err && err.status === 401) {
          setAuthState("needs-token");
        } else {
          setAuthState("ok");
        }
      });
  }, []);

  return (
    <ThemeProvider>
      {authState === "loading" && (
        <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
          <span className="text-[14px]">正在核验 Finance Node 访问权限…</span>
        </div>
      )}
      {authState === "needs-token" && <TokenGate onAuthenticated={() => setAuthState("ok")} />}
      {authState === "ok" && (
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<FlowPage />} />
            <Route path="flow" element={<FlowPage />} />
            <Route path="status" element={<OverviewPage />} />
            <Route path="ledger" element={<LedgerPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </ThemeProvider>
  );
}
