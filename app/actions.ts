"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser, isSuperAdmin } from "@/lib/auth";
import { isValidIsoDate } from "@/lib/dates";
import { DEPOSITS_TABLE, getSupabase } from "@/lib/supabase";
import { validateDeposit, type DepositInput } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Window in which an identical re-submission is treated as a double-click. */
const DUPLICATE_WINDOW_MS = 20_000;

/**
 * Every mutation re-checks the session on the server. Hiding a button is a UI
 * nicety; this is the actual gate.
 */
async function requireBranch(): Promise<
  { ok: true; branchId: string } | { ok: false; result: ActionResult }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, result: { ok: false, message: "auth.sessionExpired" } };
  }
  // A super admin manages accounts; it has no branch and may not touch deposits.
  if (isSuperAdmin(user) || !user.branchId) {
    return { ok: false, result: { ok: false, message: "users.notAllowed" } };
  }
  return { ok: true, branchId: user.branchId };
}

function refresh(id?: string) {
  revalidatePath("/");
  revalidatePath("/customers");
  if (id) revalidatePath(`/customers/${id}`);
}

export async function createDeposit(
  input: DepositInput,
): Promise<ActionResult> {
  const auth = await requireBranch();
  if (!auth.ok) return auth.result;

  const validation = validateDeposit(input);
  if (!validation.ok) {
    return {
      ok: false,
      message: "validation.fixErrors",
      fields: validation.errors,
    };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: "error.config" };

  const { fullName, phone, depositCents, depositDate, durationDays } =
    validation.value;

  // Guard against a double submit reaching the server twice: an identical row
  // created moments ago is a duplicate, not a second genuine deposit.
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const { data: recent, error: recentError } = await supabase
    .from(DEPOSITS_TABLE)
    .select("id")
    .eq("full_name", fullName)
    .eq("phone", phone)
    .eq("deposit_cents", depositCents)
    .eq("deposit_date", depositDate)
    .eq("duration_days", durationDays)
    .eq("branch_id", auth.branchId)
    .gte("created_at", since)
    .limit(1);

  if (recentError) {
    console.error("[money] duplicate check failed:", recentError.message);
    return { ok: false, message: "error.generic" };
  }
  if (recent && recent.length > 0) {
    return { ok: false, message: "error.duplicate" };
  }

  const { error } = await supabase.from(DEPOSITS_TABLE).insert({
    full_name: fullName,
    phone,
    deposit_cents: depositCents,
    deposit_date: depositDate,
    duration_days: durationDays,
    branch_id: auth.branchId,
  });

  if (error) {
    console.error("[money] createDeposit failed:", error.message);
    return { ok: false, message: "error.generic" };
  }

  refresh();
  return { ok: true, message: "toast.created" };
}

export async function updateDeposit(
  id: string,
  input: DepositInput,
): Promise<ActionResult> {
  const auth = await requireBranch();
  if (!auth.ok) return auth.result;

  if (!UUID.test(id)) return { ok: false, message: "error.notFound" };

  const validation = validateDeposit(input);
  if (!validation.ok) {
    return {
      ok: false,
      message: "validation.fixErrors",
      fields: validation.errors,
    };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: "error.config" };

  const { fullName, phone, depositCents, depositDate, durationDays } =
    validation.value;

  const { data, error } = await supabase
    .from(DEPOSITS_TABLE)
    .update({
      full_name: fullName,
      phone,
      deposit_cents: depositCents,
      deposit_date: depositDate,
      duration_days: durationDays,
    })
    .eq("id", id)
    .eq("branch_id", auth.branchId)
    .select("id");

  if (error) {
    console.error("[money] updateDeposit failed:", error.message);
    return { ok: false, message: "error.generic" };
  }
  if (!data || data.length === 0) return { ok: false, message: "error.notFound" };

  refresh(id);
  return { ok: true, message: "toast.updated" };
}

export async function markDepositPaid(
  id: string,
  paymentDate: string,
): Promise<ActionResult> {
  const auth = await requireBranch();
  if (!auth.ok) return auth.result;

  if (!UUID.test(id)) return { ok: false, message: "error.notFound" };
  if (!isValidIsoDate(paymentDate)) {
    return { ok: false, message: "validation.dateInvalid" };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: "error.config" };

  // `.is("paid_at", null)` makes a repeated confirmation a no-op rather than
  // silently rewriting the original payment date.
  const { data, error } = await supabase
    .from(DEPOSITS_TABLE)
    .update({ paid_at: paymentDate })
    .eq("id", id)
    .eq("branch_id", auth.branchId)
    .is("paid_at", null)
    .select("id");

  if (error) {
    console.error("[money] markDepositPaid failed:", error.message);
    return { ok: false, message: "error.generic" };
  }
  if (!data || data.length === 0) {
    // Either already paid or gone; a fresh read on the client resolves which.
    refresh(id);
    return { ok: true, message: "toast.paid" };
  }

  refresh(id);
  return { ok: true, message: "toast.paid" };
}

export async function deleteDeposit(id: string): Promise<ActionResult> {
  const auth = await requireBranch();
  if (!auth.ok) return auth.result;

  if (!UUID.test(id)) return { ok: false, message: "error.notFound" };

  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: "error.config" };

  const { error } = await supabase
    .from(DEPOSITS_TABLE)
    .delete()
    .eq("id", id)
    .eq("branch_id", auth.branchId);

  if (error) {
    console.error("[money] deleteDeposit failed:", error.message);
    return { ok: false, message: "error.generic" };
  }

  refresh();
  return { ok: true, message: "toast.deleted" };
}
