/**
 * Calendar-date helpers.
 *
 * Dates are plain "YYYY-MM-DD" strings (matching Postgres `date`). All
 * arithmetic goes through Date.UTC so a daylight-saving shift can never move a
 * due date by a day.
 */

import type { Language } from "@/i18n/translations";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  // Rejects real-calendar impossibilities such as 2026-02-31.
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

function toUtcMillis(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMillis(ms: number): string {
  const date = new Date(ms);
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DAY_MS = 86_400_000;

/** Due Date = Deposit Date + Duration. */
export function addDays(iso: string, days: number): string {
  return fromUtcMillis(toUtcMillis(iso) + days * DAY_MS);
}

/** Whole days from `from` to `to`. Positive when `to` is in the future. */
export function diffDays(from: string, to: string): number {
  return Math.round((toUtcMillis(to) - toUtcMillis(from)) / DAY_MS);
}

/** Today as a local calendar date (not UTC — "today" means the user's today). */
export function todayIso(): string {
  const now = new Date();
  const y = String(now.getFullYear()).padStart(4, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const MONTHS: Record<Language, string[]> = {
  so: ["Jan", "Feb", "Mar", "Abr", "May", "Jun", "Lul", "Ogo", "Seb", "Okt", "Nof", "Dis"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

/**
 * "2026-10-05" -> "05 Oct 2026" / "05 Okt 2026".
 * Day-month-year in both languages, with Western digits, so the value is
 * unambiguous and never reorders when the language changes.
 */
export function formatDate(iso: string, language: Language): string {
  if (!isValidIsoDate(iso)) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[language][m - 1]} ${y}`;
}
