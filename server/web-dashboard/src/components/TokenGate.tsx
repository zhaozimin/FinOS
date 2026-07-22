import { useEffect, useRef, useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { api, setToken } from "../api/client";

interface Props {
  onAuthenticated: () => void;
}

const HELP_URL = "https://github.com/zhaozimin/FinOS";
const MONO = `Menlo, Monaco, Consolas, "Courier New", monospace`;

export function TokenGate({ onAuthenticated }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = value.trim();
    if (!token) {
      setError("请输入登录密钥");
      return;
    }
    setBusy(true);
    setError(null);
    setToken(token);
    try {
      await api.health();
      onAuthenticated();
    } catch (err) {
      setToken("");
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as Error).message)
          : "登录密钥无效";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <GlitchCanvas />
      <CursorRing />

      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle,_rgba(0,0,0,0)_58%,_#000_100%)]" />
      <div className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(circle,_rgba(0,0,0,0.82)_0%,_rgba(0,0,0,0.18)_42%,_rgba(0,0,0,0)_62%)]" />
      <div className="pointer-events-none absolute inset-0 z-[3] bg-black/50" />
      <div
        className="pointer-events-none absolute inset-0 z-[4] opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(255,255,255,0.18) 0, rgba(255,255,255,0) 1px)",
          backgroundSize: "100% 4px",
        }}
      />

      <header className="fixed inset-x-0 top-0 z-30 flex h-[60px] items-center justify-between px-5 sm:px-8">
        <span className="brand-logo select-none text-[22px] font-semibold leading-none text-white">
          FinOS<span style={{ color: "var(--brand-red)" }}>.</span>
        </span>
        <a
          href={HELP_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 border border-white/40 px-3 py-2 text-[11px] font-medium uppercase tracking-[1.8px] text-white/85 transition-colors hover:border-white hover:bg-white hover:text-black"
          style={{ fontFamily: MONO }}
        >
          详细使用说明
          <ExternalLink size={12} />
        </a>
      </header>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-5 pb-12 pt-[60px]">
        <div className="flex w-full max-w-[440px] flex-col items-center">
          <div
            className="h-[180px] w-[180px] overflow-hidden rounded-full border border-white/35"
            style={{
              boxShadow:
                "0 24px 80px rgba(0,0,0,0.55), 0 0 0 6px rgba(255,255,255,0.04)",
            }}
          >
            <img
              src="/avatar.jpg"
              alt="头像"
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>

          <p
            className="mt-8 text-[11px] uppercase tracking-[3.85px] text-white/85"
            style={{ fontFamily: MONO }}
          >
            输入登录密钥继续
          </p>

          <form onSubmit={submit} className="mt-5 w-full">
            <div
              className="flex h-[55px] items-stretch border border-white backdrop-blur-[3px] transition-colors"
              style={{ background: "rgba(246,243,236,0.18)" }}
            >
              <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                type="password"
                autoFocus
                aria-label="登录密钥"
                placeholder="请输入登录密码"
                className="min-w-0 flex-1 bg-transparent px-4 text-[14px] tracking-[1.2px] text-white outline-none placeholder:text-white/55"
                style={{ fontFamily: MONO }}
              />
              <button
                type="submit"
                disabled={busy}
                aria-label="登录"
                className="flex h-full w-[55px] items-center justify-center border-l border-white/60 text-white transition-colors hover:bg-white hover:text-black disabled:opacity-50"
              >
                <ArrowRight size={18} />
              </button>
            </div>
            {error && (
              <p
                className="mt-3 text-center text-[12px] tracking-[1.2px] text-[#ff7676]"
                style={{ fontFamily: MONO }}
              >
                {error}
              </p>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}

function CursorRing() {
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    if (window.matchMedia("(hover: none)").matches) return;

    const interactiveSelector = "button, a, input, select, textarea";
    let targetX = -400;
    let targetY = -400;
    let currentX = -400;
    let currentY = -400;
    let rafId = 0;
    let visible = false;

    const setSize = (small: boolean) => {
      ring.style.width = small ? "16px" : "200px";
      ring.style.height = small ? "16px" : "200px";
      ring.style.opacity = small ? "0" : visible ? "1" : "0";
    };

    const move = () => {
      currentX += (targetX - currentX) * 0.18;
      currentY += (targetY - currentY) * 0.18;
      ring.style.left = `${currentX}px`;
      ring.style.top = `${currentY}px`;
      rafId = requestAnimationFrame(move);
    };

    const onEnter = () => {
      visible = true;
      ring.style.opacity = "1";
      document.documentElement.style.cursor = "none";
    };

    const onLeave = () => {
      visible = false;
      ring.style.opacity = "0";
      document.documentElement.style.cursor = "";
    };

    const onMove = (event: MouseEvent) => {
      if (!visible) {
        visible = true;
        ring.style.opacity = "1";
        document.documentElement.style.cursor = "none";
      }
      targetX = event.clientX;
      targetY = event.clientY;
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const small = !!(element && element.closest(interactiveSelector));
      setSize(small);
    };

    document.addEventListener("mouseenter", onEnter);
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mousemove", onMove);
    move();

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("mouseenter", onEnter);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mousemove", onMove);
      document.documentElement.style.cursor = "";
    };
  }, []);

  return (
    <div
      ref={ringRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-40 rounded-full"
      style={{
        width: "200px",
        height: "200px",
        background: "#f6f3ec",
        mixBlendMode: "difference",
        opacity: 0,
        transform: "translate(-50%, -50%)",
        transition:
          "width 0.2s cubic-bezier(0.22, 1, 0.36, 1), height 0.2s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.15s ease",
      }}
    />
  );
}

function GlitchCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const palette = ["#53514D", "#53514D", "#998f84"];
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789";
    const fontSize = 16;
    const cellWidth = 10;
    const cellHeight = 20;
    const frameMs = 50;
    const fadeStep = 0.05;

    type Cell = { char: string; color: string; targetColor: string; progress: number };
    let cells: Cell[] = [];
    let columns = 0;
    let lastFrame = Date.now();
    let animationFrame = 0;
    let resizeTimer = 0;

    const randomChar = () => chars[Math.floor(Math.random() * chars.length)];
    const randomColor = () => palette[Math.floor(Math.random() * palette.length)];

    const hexToRgb = (hex: string) => {
      const expanded = hex.replace(
        /^#?([\da-f])([\da-f])([\da-f])$/i,
        (_, r, g, b) => r + r + g + g + b + b,
      );
      const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(expanded);
      return match
        ? {
            r: Number.parseInt(match[1], 16),
            g: Number.parseInt(match[2], 16),
            b: Number.parseInt(match[3], 16),
          }
        : null;
    };

    const mixColor = (
      from: { r: number; g: number; b: number },
      to: { r: number; g: number; b: number },
      progress: number,
    ) =>
      `rgb(${Math.round(from.r + (to.r - from.r) * progress)},${Math.round(
        from.g + (to.g - from.g) * progress,
      )},${Math.round(from.b + (to.b - from.b) * progress)})`;

    const seedCells = (rows: number) => {
      cells = Array.from({ length: columns * rows }, () => {
        const color = randomColor();
        return { char: randomChar(), color, targetColor: randomColor(), progress: 1 };
      });
    };

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.font = `${fontSize}px monospace`;
      ctx.textBaseline = "top";
      for (let index = 0; index < cells.length; index += 1) {
        const cell = cells[index];
        ctx.fillStyle = cell.color;
        ctx.fillText(
          cell.char,
          (index % columns) * cellWidth,
          Math.floor(index / columns) * cellHeight,
        );
      }
    };

    const mutate = () => {
      const amount = Math.max(1, Math.floor(cells.length * 0.05));
      for (let i = 0; i < amount; i += 1) {
        const index = Math.floor(Math.random() * cells.length);
        cells[index].char = randomChar();
        cells[index].targetColor = randomColor();
        cells[index].progress = 0;
      }
    };

    const fadeColors = () => {
      let changed = false;
      for (const cell of cells) {
        if (cell.progress >= 1) continue;
        cell.progress = Math.min(1, cell.progress + fadeStep);
        const from = hexToRgb(cell.color);
        const to = hexToRgb(cell.targetColor);
        if (from && to) {
          cell.color = mixColor(from, to, cell.progress);
          changed = true;
        }
      }
      if (changed) draw();
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      columns = Math.ceil(rect.width / cellWidth);
      const rows = Math.ceil(rect.height / cellHeight);
      seedCells(rows);
      draw();
    };

    const loop = () => {
      const now = Date.now();
      if (now - lastFrame >= frameMs) {
        mutate();
        draw();
        lastFrame = now;
      }
      fadeColors();
      animationFrame = requestAnimationFrame(loop);
    };

    resize();
    loop();

    const observer = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        cancelAnimationFrame(animationFrame);
        resize();
        loop();
      }, 100);
    });
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(resizeTimer);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 z-0 h-full w-full"
      style={{ background: "#1a1a1a" }}
    />
  );
}
