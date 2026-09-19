"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useT } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";

type Tone = "success" | "error";

type Toast = { id: number; key: TranslationKey; tone: Tone };

type ToastContextValue = {
  showToast: (key: TranslationKey, tone?: Tone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 4000;

/**
 * Toasts store a translation *key*, not a sentence, so an open toast follows the
 * language switcher instead of getting stranded in the previous language.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (key: TranslationKey, tone: Tone = "success") => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, key, tone }]);
      timers.current.push(setTimeout(() => dismiss(id), VISIBLE_MS));
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    [],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  const t = useT();
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4 pb-4 sm:inset-x-auto sm:right-4 sm:items-end"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`animate-rise pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${
            toast.tone === "error"
              ? "border-st-overdue/40 bg-st-overdue-bg text-st-overdue"
              : "border-st-paid/40 bg-st-paid-bg text-st-paid"
          }`}
        >
          <span className="mt-0.5 shrink-0" aria-hidden="true">
            {toast.tone === "error" ? "⚠" : "✓"}
          </span>
          <p className="flex-1 text-sm font-medium">{t(toast.key)}</p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label={t("toast.dismiss")}
            className="shrink-0 rounded-md px-1 text-base leading-none opacity-70 transition hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
