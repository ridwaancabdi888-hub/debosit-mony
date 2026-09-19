"use client";

import { useTheme } from "@/components/ThemeProvider";
import { useT } from "@/i18n/LanguageProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const t = useT();
  const label = theme === "dark" ? t("nav.themeLight") : t("nav.themeDark");

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-surface-2 text-base text-muted transition-colors hover:text-ink"
    >
      <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
    </button>
  );
}
