import clsx from "clsx";

export function ProductLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={clsx("brand-logo text-foreground select-none", compact && "text-[22px]")}>
      FinOS<span className="text-brand-red">.</span>
    </span>
  );
}
