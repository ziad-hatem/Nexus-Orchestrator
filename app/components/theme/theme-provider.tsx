"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  THEME_COOKIE_MAX_AGE,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  isThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setThemePreference: (preference: ThemePreference) => void;
};

type ThemeProviderProps = {
  children: ReactNode;
  initialThemePreference: ThemePreference;
  initialResolvedTheme: ResolvedTheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readSystemResolvedTheme(): ResolvedTheme {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
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

function syncPersistedThemePreference(preference: ThemePreference): void {
  let storedPreference: string | null = null;

  try {
    storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Ignore storage access failures and rely on cookie persistence below.
  }

  if (storedPreference !== preference) {
    persistThemePreference(preference);
    return;
  }

  document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(
    preference,
  )}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
}

export function ThemeProvider({
  children,
  initialThemePreference,
  initialResolvedTheme,
}: ThemeProviderProps) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() =>
    initialThemePreference,
  );
  const systemResolvedTheme = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window.matchMedia !== "function") {
        return () => undefined;
      }

      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", onStoreChange);

      return () => {
        mediaQuery.removeEventListener("change", onStoreChange);
      };
    },
    readSystemResolvedTheme,
    () => initialResolvedTheme,
  );
  const resolvedTheme =
    themePreference === "system" ? systemResolvedTheme : themePreference;

  useEffect(() => {
    const root = document.documentElement;

    root.dataset.themePreference = themePreference;
    root.dataset.theme = resolvedTheme;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.style.colorScheme = resolvedTheme;
    syncPersistedThemePreference(themePreference);
  }, [resolvedTheme, themePreference]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY || !isThemePreference(event.newValue)) {
        return;
      }

      setThemePreferenceState(event.newValue);
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setThemePreference = (preference: ThemePreference) => {
    setThemePreferenceState(preference);
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
