"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_COOKIE_MAX_AGE,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  isThemePreference,
  resolveThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setThemePreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialThemePreference(): ThemePreference {
  if (typeof document === "undefined") {
    return DEFAULT_THEME_PREFERENCE;
  }

  const value = document.documentElement.dataset.themePreference;
  return isThemePreference(value) ? value : DEFAULT_THEME_PREFERENCE;
}

function readInitialResolvedTheme(): ResolvedTheme {
  if (typeof document === "undefined") {
    return "light";
  }

  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function readSystemResolvedTheme(): ResolvedTheme {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyThemePreference(preference: ThemePreference): ResolvedTheme {
  const prefersDark = readSystemResolvedTheme() === "dark";
  const resolvedTheme = resolveThemePreference(preference, prefersDark);
  const root = document.documentElement;

  root.dataset.themePreference = preference;
  root.dataset.theme = resolvedTheme;
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.style.colorScheme = resolvedTheme;

  return resolvedTheme;
}

function persistThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Ignore storage failures and fall back to cookie persistence only.
  }

  document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(
    preference,
  )}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(
    readInitialThemePreference,
  );
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(
    readInitialResolvedTheme,
  );

  useEffect(() => {
    const mediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    const handleSystemThemeChange = () => {
      const currentPreference = readInitialThemePreference();
      if (currentPreference === "system") {
        setResolvedTheme(applyThemePreference("system"));
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY || !isThemePreference(event.newValue)) {
        return;
      }

      setThemePreferenceState(event.newValue);
      setResolvedTheme(applyThemePreference(event.newValue));
    };

    mediaQuery?.addEventListener("change", handleSystemThemeChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      mediaQuery?.removeEventListener("change", handleSystemThemeChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setThemePreference = (preference: ThemePreference) => {
    setThemePreferenceState(preference);
    setResolvedTheme(applyThemePreference(preference));
    persistThemePreference(preference);
  };

  return (
    <ThemeContext.Provider
      value={{
        themePreference,
        resolvedTheme,
        setThemePreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider.");
  }

  return context;
}
