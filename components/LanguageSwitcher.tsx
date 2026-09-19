"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { LANGUAGES, type Language } from "@/i18n/translations";

const LABELS: Record<Language, string> = { so: "SO", en: "EN" };
const FULL: Record<Language, string> = { so: "Soomaali", en: "English" };

/**
 * SO | EN segmented control. Always visible — in the header on every breakpoint,
 * never tucked into the mobile drawer.
 */
export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t("nav.language")}
      className="flex shrink-0 items-center rounded-lg border border-line-strong bg-surface-2 p-0.5"
    >
      {LANGUAGES.map((code) => {
        const active = code === language;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            onClick={() => setLanguage(code)}
            aria-pressed={active}
            title={FULL[code]}
            className={`min-w-[38px] rounded-[6px] px-2 py-1.5 text-xs font-bold tracking-wide transition-colors ${
              active
                ? "bg-accent text-white shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            {LABELS[code]}
          </button>
        );
      })}
    </div>
  );
}
