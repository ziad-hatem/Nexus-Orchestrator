import {
  DEFAULT_THEME_PREFERENCE,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

const themeBootstrapScript = `
(() => {
  const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
  const cookieName = ${JSON.stringify(THEME_COOKIE_NAME)};
  const defaultPreference = ${JSON.stringify(DEFAULT_THEME_PREFERENCE)};
  const valid = new Set(["light", "dark", "system"]);

  const readCookie = (name) => {
    const escaped = name.replace(/[.*+?^$()|[\\]\\\\]/g, "\\\\$&");
    const match = document.cookie.match(new RegExp("(?:^|; )" + escaped + "=([^;]+)"));
    return match ? decodeURIComponent(match[1]) : null;
  };

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
    const stored = window.localStorage.getItem(storageKey);
    const cookie = readCookie(cookieName);
    const preference = valid.has(stored ?? "")
      ? stored
      : valid.has(cookie ?? "")
        ? cookie
        : defaultPreference;

    applyTheme(preference);
  } catch {
    applyTheme(defaultPreference);
  }
})();
`;

export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: themeBootstrapScript,
      }}
    />
  );
}
