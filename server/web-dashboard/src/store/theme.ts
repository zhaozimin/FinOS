import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemePaletteId } from "../lib/themes";

export type ThemePref = "light" | "dark" | "system";

interface ThemeState {
  preference: ThemePref;
  resolved: "light" | "dark";
  palette: ThemePaletteId;
  setPreference: (pref: ThemePref) => void;
  setResolved: (resolved: "light" | "dark") => void;
  setPalette: (palette: ThemePaletteId) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: "system",
      resolved: "light",
      palette: "claude",
      setPreference: (pref) => set({ preference: pref }),
      setResolved: (resolved) => set({ resolved }),
      setPalette: (palette) => set({ palette }),
    }),
    {
      name: "finance-theme",
      partialize: (state) => ({ preference: state.preference, palette: state.palette }),
    },
  ),
);
