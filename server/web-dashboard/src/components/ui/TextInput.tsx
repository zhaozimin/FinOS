import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  containerClassName?: string;
}

export const TextInput = forwardRef<HTMLInputElement, Props>(function TextInput(
  { label, hint, error, leading, trailing, className, containerClassName, ...rest },
  ref,
) {
  return (
    <label className={clsx("block", containerClassName)}>
      {label && (
        <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground block mb-1.5">
          {label}
        </span>
      )}
      <span
        className={clsx(
          "flex items-center gap-2 h-10 px-3 rounded-md bg-background/70 border transition-colors text-[13.5px]",
          error
            ? "border-destructive"
            : "border-border focus-within:border-ring focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring/30",
        )}
      >
        {leading && <span className="text-muted-foreground">{leading}</span>}
        <input
          ref={ref}
          className={clsx(
            "flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/70",
            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            className,
          )}
          {...rest}
        />
        {trailing && <span className="text-muted-foreground">{trailing}</span>}
      </span>
      {(hint || error) && (
        <span className={clsx("text-[11.5px] mt-1 block", error ? "text-destructive" : "text-muted-foreground")}>
          {error || hint}
        </span>
      )}
    </label>
  );
});
