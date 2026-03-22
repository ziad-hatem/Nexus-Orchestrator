"use client";

import { Clock3, Filter, RotateCcw, Search, Shield } from "lucide-react";
import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { cn } from "@/app/components/ui/utils";

const ALL_FILTER_VALUE = "__all__";
const FILTER_ICONS = {
  clock: Clock3,
  filter: Filter,
  shield: Shield,
} as const;

export type FilterSelectOption = {
  label: string;
  value: string;
};

export type FilterSelectConfig = {
  key: string;
  label: string;
  placeholder: string;
  value?: string;
  icon: keyof typeof FILTER_ICONS;
  options: FilterSelectOption[];
};

type FilterToolbarProps = {
  className?: string;
  resetHref: string;
  search: {
    label: string;
    placeholder: string;
    value?: string;
  };
  selects?: FilterSelectConfig[];
  submitLabel?: string;
};

export function FilterToolbar({
  className,
  resetHref,
  search,
  selects = [],
  submitLabel = "Apply filters",
}: FilterToolbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(() => search.value ?? "");
  const [selectValues, setSelectValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      selects.map((select) => [select.key, select.value || ALL_FILTER_VALUE]),
    ),
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const searchParams = new URLSearchParams();
    const trimmedQuery = query.trim();

    if (trimmedQuery) {
      searchParams.set("query", trimmedQuery);
    }

    for (const select of selects) {
      const value = selectValues[select.key];
      if (value && value !== ALL_FILTER_VALUE) {
        searchParams.set(select.key, value);
      }
    }

    const href = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    startTransition(() => {
      router.push(href);
    });
  };

  const handleReset = () => {
    setQuery("");
    setSelectValues(
      Object.fromEntries(
        selects.map((select) => [select.key, ALL_FILTER_VALUE]),
      ),
    );

    startTransition(() => {
      router.push(resetHref);
    });
  };

  return (
    <form
      aria-label={submitLabel}
      className={cn(
        "grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_repeat(2,minmax(12rem,0.7fr))_auto]",
        className,
      )}
      onSubmit={handleSubmit}
      role="search"
    >
      <div className="glass-pill flex min-h-12 items-center gap-3 rounded-[1.15rem] px-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-container-high)] text-primary">
          <Search className="h-4 w-4" />
        </span>
        <label htmlFor="filter-toolbar-search" className="sr-only">
          {search.label}
        </label>
        <Input
          id="filter-toolbar-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={search.placeholder}
          className="h-12 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
        />
      </div>

      {selects.map((select) => {
        const Icon = FILTER_ICONS[select.icon];

        return (
          <div
            key={select.key}
            className="glass-pill flex min-h-12 items-center gap-3 rounded-[1.15rem] px-3"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-container-high)] text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <label className="sr-only" htmlFor={`filter-select-${select.key}`}>
              {select.label}
            </label>
            <Select
              value={selectValues[select.key] ?? ALL_FILTER_VALUE}
              onValueChange={(value) =>
                setSelectValues((current) => ({
                  ...current,
                  [select.key]: value,
                }))
              }
            >
              <SelectTrigger
                id={`filter-select-${select.key}`}
                className="h-12 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              >
                <SelectValue placeholder={select.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {select.options.map((option) => (
                  <SelectItem
                    key={`${select.key}-${option.value || "all"}`}
                    value={option.value || ALL_FILTER_VALUE}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="premium-gradient rounded-xl px-5" disabled={isPending}>
          {submitLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl px-5"
          onClick={handleReset}
          disabled={isPending}
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>
    </form>
  );
}
