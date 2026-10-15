import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";
type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const STORAGE_KEY = "theme";
const DEFAULT_THEME: Theme = "dark";
const media = window.matchMedia("(prefers-color-scheme: dark)");

function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" || value === "system" ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Sets the `dark` class without letting every CSS transition animate the switch. */
function applyTheme(resolved: "light" | "dark") {
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(style);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
  window.getComputedStyle(document.body);
  requestAnimationFrame(() => style.remove());
}

const resolve = (theme: Theme) => (theme === "system" ? (media.matches ? "dark" : "light") : theme);

// Apply before React renders so the first paint already has the right theme.
applyTheme(resolve(storedTheme()));

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState(storedTheme);
  const systemDark = useSyncExternalStore(
    (onChange) => {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => media.matches,
  );
  const resolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => applyTheme(resolvedTheme), [resolvedTheme]);
  useEffect(() => window.openaso.setTheme(theme), [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable; the choice just won't persist.
    }
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider.");
  return context;
}
