import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import TestEnvBanner from "./components/TestEnvBanner";

export type Theme = "light" | "dark";

const THEME_KEY = "editorial-calendar:theme:v1";

/** Saved preference, else the OS preference, else dark (the brand default). */
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* storage unavailable */
  }
  try {
    if (window.matchMedia?.("(prefers-color-scheme: light)").matches) return "light";
  } catch {
    /* matchMedia unavailable */
  }
  return "dark";
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Scopes the calendar app's theming to the `body` element.
 *
 * Why `body` and not a wrapper div: dialogs, dropdowns and toasts render in
 * portals attached to `<body>`, so they only inherit the CSS variables if the
 * variables live on `body` itself. The `calendar-route` class also keeps the
 * landing page (which is permanently dark and hides the cursor) untouched.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => initialTheme());

  // Mark the route and apply the theme before paint, to avoid a flash.
  useLayoutEffect(() => {
    document.body.classList.add("calendar-route");
    return () => {
      document.body.classList.remove("calendar-route");
      document.body.removeAttribute("data-theme");
    };
  }, []);

  useLayoutEffect(() => {
    document.body.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(
    () => setTheme(theme === "dark" ? "light" : "dark"),
    [theme, setTheme],
  );

  // Follow the OS only while the user hasn't chosen explicitly.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch {
      /* ignore */
    }
    if (saved) return;
    const mq = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setThemeState(e.matches ? "light" : "dark");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
      <TestEnvBanner />
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de <ThemeProvider>.");
  return ctx;
}

/** Sun/moon button that flips between light and dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const toDark = theme === "light";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={toDark ? "Ativar tema escuro" : "Ativar tema claro"}
      title={toDark ? "Tema escuro" : "Tema claro"}
      className={cn("h-9 w-9 text-muted-foreground hover:text-foreground", className)}
    >
      {toDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}
