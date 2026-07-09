import { useEffect, useState } from "react";
import clsx from "clsx";
import { Wifi, WifiOff, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { api } from "../api/client";

type Status = "online" | "verifying" | "waiting" | "error" | "reconnecting";

const STATUS_CONFIG: Record<Status, { label: string; tone: string; Icon: typeof Wifi }> = {
  online: { label: "连接状态: 已连接", tone: "text-success", Icon: Wifi },
  verifying: { label: "连接状态: 检查中", tone: "text-warning", Icon: Loader2 },
  waiting: { label: "连接状态: 未连接", tone: "text-muted-foreground", Icon: WifiOff },
  error: { label: "连接状态: 断开", tone: "text-destructive", Icon: AlertCircle },
  reconnecting: { label: "连接状态: 重连中", tone: "text-warning", Icon: RefreshCw },
};

export function StatusIndicator() {
  const [status, setStatus] = useState<Status>("verifying");
  const [nodeName, setNodeName] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const probe = async (mode: "verifying" | "reconnecting" = "verifying") => {
      if (cancelled) return;
      setStatus(mode);
      try {
        const health = await api.health();
        if (cancelled) return;
        setStatus("online");
        setNodeName(health.nodeName || "Finance Node");
      } catch {
        if (cancelled) return;
        setStatus("error");
      } finally {
        if (!cancelled) {
          timer = setTimeout(() => probe("reconnecting"), 30_000);
        }
      }
    };

    probe("verifying");
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const cfg = STATUS_CONFIG[status];
  const spinning = status === "verifying" || status === "reconnecting";

  return (
    <div className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card/70 px-3 text-[13px] leading-none">
      <cfg.Icon
        size={14}
        className={clsx(cfg.tone, spinning && "animate-spin")}
        strokeWidth={2.2}
      />
      <span className={clsx("font-medium", cfg.tone)}>{cfg.label}</span>
      {nodeName && status === "online" && <span className="sr-only">{nodeName}</span>}
    </div>
  );
}
