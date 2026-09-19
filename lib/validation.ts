import { isValidIsoDate } from "@/lib/dates";
import { MAX_DEPOSIT_CENTS, parseAmountToCents } from "@/lib/money";
import type { TranslationKey } from "@/i18n/translations";

/**
 * Validation shared by the form and the server actions, so the browser and the
 * server always agree. Errors are returned as *translation keys* rather than
 * sentences — the UI renders them in the active language.
 */

export const MAX_DURATION_DAYS = 3650;

export type DepositInput = {
  fullName: string;
  phone: string;
  depositAmount: string;
  depositDate: string;
  durationDays: string;
};

export type ValidatedDeposit = {
  fullName: string;
  phone: string;
  depositCents: number;
  depositDate: string;
  durationDays: number;
};

export type FieldErrors = Partial<Record<keyof DepositInput, TranslationKey>>;

export type ValidationResult =
  | { ok: true; value: ValidatedDeposit }
  | { ok: false; errors: FieldErrors };

const PHONE_ALLOWED = /^[\d\s+()-]+$/;

export function validateDeposit(input: DepositInput): ValidationResult {
  const errors: FieldErrors = {};

  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  if (!fullName) errors.fullName = "validation.nameRequired";
  else if (fullName.length < 2) errors.fullName = "validation.nameTooShort";
  else if (fullName.length > 120) errors.fullName = "validation.nameTooLong";

  const phone = input.phone.trim().replace(/\s+/g, " ");
  const phoneDigits = phone.replace(/\D/g, "");
  if (!phone) errors.phone = "validation.phoneRequired";
  else if (
    !PHONE_ALLOWED.test(phone) ||
    phoneDigits.length < 7 ||
    phoneDigits.length > 20 ||
    phone.length > 25
  ) {
    errors.phone = "validation.phoneInvalid";
  }

  const rawAmount = input.depositAmount.trim();
  let depositCents = 0;
  if (!rawAmount) {
    errors.depositAmount = "validation.depositRequired";
  } else {
    const parsed = parseAmountToCents(rawAmount);
    if (parsed === null) errors.depositAmount = "validation.depositInvalid";
    else if (parsed <= 0) errors.depositAmount = "validation.depositPositive";
    else if (parsed > MAX_DEPOSIT_CENTS)
      errors.depositAmount = "validation.depositTooLarge";
    else depositCents = parsed;
  }

  const depositDate = input.depositDate.trim();
  if (!depositDate) errors.depositDate = "validation.dateRequired";
  else if (!isValidIsoDate(depositDate))
    errors.depositDate = "validation.dateInvalid";

  const rawDuration = input.durationDays.trim();
  let durationDays = 0;
  if (!rawDuration) {
    errors.durationDays = "validation.durationRequired";
  } else if (!/^\d{1,5}$/.test(rawDuration)) {
    errors.durationDays = "validation.durationPositive";
  } else {
    const parsed = Number(rawDuration);
    if (parsed <= 0) errors.durationDays = "validation.durationPositive";
    else if (parsed > MAX_DURATION_DAYS)
      errors.durationDays = "validation.durationTooLong";
    else durationDays = parsed;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: { fullName, phone, depositCents, depositDate, durationDays },
  };
}
