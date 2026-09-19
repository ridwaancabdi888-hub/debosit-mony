"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { LANGUAGE_STORAGE_KEY } from "@/lib/client-storage";
import { useIsomorphicLayoutEffect } from "@/lib/useIsomorphicLayoutEffect";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  translate,
  type Language,
  type TranslationKey,
} from "@/i18n/translations";

/**
 * localStorage is the store of record, but the server cannot read it — so the
 * choice is mirrored into a cookie of the same name purely as a server-rendering
 * hint. Without it the first paint would show the default language and visibly
 * flip once JavaScript hydrates.
 */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

type Translator = (
  key: TranslationKey,
  vars?: Record<string, string | number>,
) => string;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translator;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language);
}

export function LanguageProvider({
  initialLanguage = DEFAULT_LANGUAGE,
  children,
}: {
  initialLanguage?: Language;
  children: ReactNode;
}) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  // Restore the saved choice before the first paint.
  useIsomorphicLayoutEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isLanguage(saved) && saved !== language) setLanguageState(saved);
    } catch {
      // Private browsing / storage disabled — the default language still works.
    }
    // Only on mount: afterwards `setLanguage` is the single source of truth.
  }, []);

  useIsomorphicLayoutEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // Ignore: the switch still applies for this session.
    }
    // Written alongside localStorage so the next server render already knows.
    document.cookie = `${LANGUAGE_STORAGE_KEY}=${next}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, vars) => translate(language, key, vars),
    }),
    [language, setLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside <LanguageProvider>");
  }
  return context;
}

/** Convenience hook for components that only need the translator. */
export function useT(): Translator {
  return useLanguage().t;
}
