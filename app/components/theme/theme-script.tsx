import Script from "next/script";
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";

function getThemeBootstrapScript(initialThemePreference: ThemePreference) {
  return `
(() => {
  const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
  const preference = ${JSON.stringify(initialThemePreference)};
  const fallbackPreference = ${JSON.stringify(DEFAULT_THEME_PREFERENCE)};

  const applyTheme = (preference) => {
    const prefersDark =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved = preference === "system"
      ? (prefersDark ? "dark" : "light")
      : preference;
    const root = document.documentElement;
    root.dataset.themePreference = preference;
    root.dataset.theme = resolved;
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
  };

  try {
    applyTheme(preference);
    window.localStorage.setItem(storageKey, preference);
  } catch {
    applyTheme(fallbackPreference);
  }
})();
`;
}

type ThemeScriptProps = {
  initialThemePreference: ThemePreference;
};

export function ThemeScript({ initialThemePreference }: ThemeScriptProps) {
  return (
    <Script
      id="theme-bootstrap"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{
        __html: getThemeBootstrapScript(initialThemePreference),
      }}
    />
  );
}
