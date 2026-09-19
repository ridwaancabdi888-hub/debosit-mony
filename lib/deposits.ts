import { DEPOSITS_TABLE, getSupabase } from "@/lib/supabase";
import type { Deposit, DepositRow } from "@/lib/types";

const COLUMNS =
  "id, full_name, phone, deposit_cents, deposit_date, duration_days, due_date, gross_return_cents, broker_fee_cents, net_return_cents, profit_cents, paid_at, created_at";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LoadResult<T> =
  | { status: "ok"; data: T }
  | { status: "unconfigured" }
  | { status: "error" };

/**
 * `due_date` and every money figure except the principal are GENERATED columns,
 * so the numbers here come straight from the database rather than being
 * recomputed in the app.
 */
function mapRow(row: DepositRow): Deposit {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    depositCents: Number(row.deposit_cents),
    depositDate: row.deposit_date,
    durationDays: row.duration_days,
    dueDate: row.due_date,
    grossReturnCents: Number(row.gross_return_cents),
    brokerFeeCents: Number(row.broker_fee_cents),
    netReturnCents: Number(row.net_return_cents),
    profitCents: Number(row.profit_cents),
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

/**
 * Every read is scoped to one branch. `branchId` comes from the session via
 * requireBranchUser(), never from anything the browser can set, which is what
 * keeps one branch's data out of another's.
 */
export async function listDeposits(
  branchId: string,
): Promise<LoadResult<Deposit[]>> {
  const supabase = getSupabase();
  if (!supabase) return { status: "unconfigured" };

  const { data, error } = await supabase
    .from(DEPOSITS_TABLE)
    .select(COLUMNS)
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[money] listDeposits failed:", error.message);
    return { status: "error" };
  }
  return { status: "ok", data: (data as DepositRow[]).map(mapRow) };
}

export async function getDeposit(
  id: string,
  branchId: string,
): Promise<LoadResult<Deposit | null>> {
  const supabase = getSupabase();
  if (!supabase) return { status: "unconfigured" };
  if (!UUID.test(id)) return { status: "ok", data: null };

  // The branch filter means guessing another branch's id returns "not found"
  // rather than that branch's customer.
  const { data, error } = await supabase
    .from(DEPOSITS_TABLE)
    .select(COLUMNS)
    .eq("id", id)
    .eq("branch_id", branchId)
    .maybeSingle();

  if (error) {
    console.error("[money] getDeposit failed:", error.message);
    return { status: "error" };
  }
  return { status: "ok", data: data ? mapRow(data as DepositRow) : null };
}
