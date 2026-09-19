import { diffDays } from "@/lib/dates";
import type { Deposit } from "@/lib/types";

export type DepositStatus = "paid" | "overdue" | "due_today" | "active";

/**
 * Status is derived, never stored — a stored status would silently go stale the
 * moment the calendar rolls over. Only `paid_at` is persisted.
 */
export function deriveStatus(deposit: Deposit, today: string): DepositStatus {
  if (deposit.paidAt) return "paid";
  const remaining = diffDays(today, deposit.dueDate);
  if (remaining < 0) return "overdue";
  if (remaining === 0) return "due_today";
  return "active";
}

/** Days until (positive) or past (negative) the due date. */
export function daysRemaining(deposit: Deposit, today: string): number {
  return diffDays(today, deposit.dueDate);
}

/** "Due soon" = unpaid and landing within the next 7 days, today included. */
export const DUE_SOON_WINDOW_DAYS = 7;

export function isDueSoon(deposit: Deposit, today: string): boolean {
  if (deposit.paidAt) return false;
  const remaining = diffDays(today, deposit.dueDate);
  return remaining >= 0 && remaining <= DUE_SOON_WINDOW_DAYS;
}
