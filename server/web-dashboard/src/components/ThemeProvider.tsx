import { useEffect } from "react";
import { useThemeStore } from "../store/theme";
import { applyPalette, getPalette } from "../lib/themes";

interface Props {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: Props) {
  const preference = useThemeStore((s) => s.preference);
  const palette = useThemeStore((s) => s.palette);
  const setResolved = useThemeStore((s) => s.setResolved);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved: "light" | "dark" =
        preference === "system" ? (mql.matches ? "dark" : "light") : preference;
      const root = document.documentElement;
      if (resolved === "dark") root.classList.add("dark");
      else root.classList.remove("dark");

      applyPalette(root, palette, resolved);

      const p = getPalette(palette);
      const themeColor = p.metaThemeColor[resolved];
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", themeColor);
      setResolved(resolved);
    };
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [preference, palette, setResolved]);

  return <>{children}</>;
}
