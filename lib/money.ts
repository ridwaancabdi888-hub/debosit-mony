/**
 * Decimal-safe money helpers.
 *
 * Money is represented everywhere as an integer number of cents. No float ever
 * holds a monetary value, so `0.1 + 0.2` style drift is structurally impossible.
 */

/**
 * The business rule, all percentages of the PRINCIPAL:
 *
 *   gross      = principal x 1.45
 *   broker fee = principal x 10%      <- from the principal, never the gross
 *   net        = gross - broker fee   (what the customer receives)
 *   profit     = net - principal      (the customer's gain)
 *
 * Net therefore equals principal x 1.35 for whole-cent amounts, which is what
 * customers received before the broker commission existed.
 *
 * These mirror the STORED generated columns on public.money_deposits, which
 * remain the source of truth; the functions here drive the live form preview.
 */
export const GROSS_RETURN_PERCENT = 145;
export const BROKER_FEE_PERCENT = 10;
const PERCENT_BASE = 100;

/** Largest deposit the system accepts: $1,000,000,000.00 (mirrors the DB CHECK). */
export const MAX_DEPOSIT_CENTS = 100_000_000_000;

/**
 * `cents * percent` is an exact integer (<= 1.45e13, far inside
 * Number.MAX_SAFE_INTEGER), and the division is done by hand with an explicit
 * half-up rule, so the result never depends on binary floating-point rounding.
 */
function applyPercent(cents: number, percent: number): number {
  const scaled = cents * percent;
  const whole = Math.floor(scaled / PERCENT_BASE);
  const remainder = scaled - whole * PERCENT_BASE;
  return remainder >= PERCENT_BASE / 2 ? whole + 1 : whole;
}

/** Soo Noqoshada Guud / Gross Return = principal x 1.45. */
export function computeGrossReturnCents(depositCents: number): number {
  return applyPercent(depositCents, GROSS_RETURN_PERCENT);
}

/** Dilaalka / Broker Commission = 10% of the principal. Belongs to the admin. */
export function computeBrokerFeeCents(depositCents: number): number {
  return applyPercent(depositCents, BROKER_FEE_PERCENT);
}

/**
 * Lacagta Macmiilku Helayo / Net Return = gross - broker fee.
 * Derived from the other two so the commission is deducted exactly once.
 */
export function computeNetReturnCents(depositCents: number): number {
  return (
    computeGrossReturnCents(depositCents) - computeBrokerFeeCents(depositCents)
  );
}

/** Faa'iido / Customer profit = net return - principal. */
export function computeProfitCents(depositCents: number): number {
  return computeNetReturnCents(depositCents) - depositCents;
}

/**
 * Parse user input ("1,234.5", "$1234.50", " 100 ") into integer cents.
 * Returns null if the text is not a well-formed non-negative money amount.
 */
export function parseAmountToCents(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$\s,]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const [whole, fraction = ""] = cleaned.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Format cents as "$1,350.00". Identical in every UI language, by design. */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Cents -> a plain editable string like "1234.50" (for prefilling form inputs). */
export function centsToInputValue(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
