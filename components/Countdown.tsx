"use client";

import { useToday } from "@/components/TodayProvider";
import { useLanguage } from "@/i18n/LanguageProvider";
import { formatDate } from "@/lib/dates";
import { daysRemaining, deriveStatus } from "@/lib/status";
import type { Deposit } from "@/lib/types";

/** "15 days remaining" / "Due Today" / "5 days overdue" / "Paid on 05 Oct 2026". */
export function useCountdownText(deposit: Deposit): {
  text: string;
  tone: "active" | "due" | "paid" | "overdue";
} {
  const { t, language } = useLanguage();
  const today = useToday();
  const status = deriveStatus(deposit, today);

  if (status === "paid") {
    return {
      text: t("countdown.paidOn", {
        date: formatDate(deposit.paidAt as string, language),
      }),
      tone: "paid",
    };
  }

  const remaining = daysRemaining(deposit, today);

  if (remaining === 0) return { text: t("countdown.dueToday"), tone: "due" };

  if (remaining < 0) {
    const days = Math.abs(remaining);
    return {
      text:
        days === 1
          ? t("countdown.overdueOne")
          : t("countdown.overdue", { count: days }),
      tone: "overdue",
    };
  }

  return {
    text:
      remaining === 1
        ? t("countdown.remainingOne")
        : t("countdown.remaining", { count: remaining }),
    tone: "active",
  };
}

const TONES = {
  active: "bg-st-active-bg text-st-active",
  due: "bg-st-due-bg text-st-due",
  paid: "bg-st-paid-bg text-st-paid",
  overdue: "bg-st-overdue-bg text-st-overdue",
} as const;

export function Countdown({
  deposit,
  size = "md",
}: {
  deposit: Deposit;
  size?: "sm" | "md";
}) {
  const { text, tone } = useCountdownText(deposit);
  return (
    <span
      className={`tnum inline-flex items-center rounded-lg font-semibold ${TONES[tone]} ${
        size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
      }`}
    >
      {text}
    </span>
  );
}
