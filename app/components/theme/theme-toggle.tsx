"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, LaptopMinimal, MoonStar, SunMedium } from "lucide-react";
import { cn } from "@/app/components/ui/utils";
import { useTheme } from "@/app/components/theme/theme-provider";
import {
  THEME_PREFERENCES,
  type ThemePreference,
} from "@/lib/theme";

const THEME_META: Record<
  ThemePreference,
  {
    label: string;
    description: string;
    icon: typeof SunMedium;
  }
> = {
  light: {
    label: "Light",
    description: "Bright workspace palette",
    icon: SunMedium,
  },
  dark: {
    label: "Dark",
    description: "Dimmed workspace palette",
    icon: MoonStar,
  },
  system: {
    label: "System",
    description: "Follow device settings",
    icon: LaptopMinimal,
  },
};

export function ThemeToggle() {
  const { themePreference, resolvedTheme, setThemePreference } = useTheme();
  const ActiveIcon =
    resolvedTheme === "dark" ? MoonStar : SunMedium;

  return (
    <Popover.Root>
      <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={`Theme settings. Current preference: ${THEME_META[themePreference].label}`}
            className="theme-control-trigger"
          >
            <span className="sr-only">Open theme settings</span>
            <ActiveIcon className="h-4 w-4" />
            <span className="hidden text-sm font-semibold sm:inline">
              Theme
            </span>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align="end"
            className="theme-control-panel z-[120]"
            collisionPadding={16}
            side="top"
            sideOffset={12}
          >
            <div className="mb-3 px-1">
              <p className="label-caps">Appearance</p>
              <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                Choose how the interface should look everywhere in the app.
              </p>
            </div>

            <div className="space-y-2">
              {THEME_PREFERENCES.map((preference) => {
                const option = THEME_META[preference];
                const Icon = option.icon;
                const selected = themePreference === preference;

                return (
                  <Popover.Close asChild key={preference}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      className={cn(
                        "theme-option-button",
                        selected && "theme-option-button-active",
                      )}
                      onClick={() => {
                        setThemePreference(preference);
                      }}
                    >
                      <span className="flex items-center gap-3">
                        <span className="theme-option-icon">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="text-left">
                          <span className="block text-sm font-semibold text-[var(--on-surface)]">
                            {option.label}
                          </span>
                          <span className="block text-xs text-[var(--on-surface-variant)]">
                            {option.description}
                          </span>
                        </span>
                      </span>
                      <span
                        className={cn(
                          "theme-option-check",
                          selected ? "opacity-100" : "opacity-0",
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </span>
                    </button>
                  </Popover.Close>
                );
              })}
            </div>

            <Popover.Arrow
              className="fill-[var(--theme-control-bg)]"
              height={12}
              width={18}
            />
          </Popover.Content>
        </Popover.Portal>
      </div>
    </Popover.Root>
  );
}
