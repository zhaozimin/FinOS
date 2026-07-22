import clsx from "clsx";

// 品牌拆分规则：系统内一律 FinOS（无个人痕迹）；登录页 TokenGate 才保留个人署名。
export function ProductLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={clsx("brand-logo text-foreground select-none", compact && "text-[22px]")}>
      FinOS<span className="text-brand-red">.</span>
    </span>
  );
}
