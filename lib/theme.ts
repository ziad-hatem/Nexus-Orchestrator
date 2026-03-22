export const THEME_COOKIE_NAME = "nexus-theme";
export const THEME_STORAGE_KEY = "nexus-theme-preference";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === "string" &&
    (THEME_PREFERENCES as readonly string[]).includes(value)
  );
}

export function resolveThemePreference(
  preference: ThemePreference,
  prefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") {
    return prefersDark ? "dark" : "light";
  }

  return preference;
}
