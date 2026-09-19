import { USERS_TABLE } from "@/lib/auth";
import type { LoadResult } from "@/lib/deposits";
import { getSupabase } from "@/lib/supabase";

export const BRANCHES_TABLE = "money_branches";

export type Branch = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  /** How many accounts belong to this branch. Not a financial figure. */
  accountCount: number;
};

type BranchRow = {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
};

/**
 * Branches for the super admin's management screen.
 *
 * Deliberately returns no customer counts, balances or commission: the super
 * admin manages branches and accounts and never sees a branch's money.
 */
export async function listBranches(): Promise<LoadResult<Branch[]>> {
  const supabase = getSupabase();
  if (!supabase) return { status: "unconfigured" };

  const [branches, users] = await Promise.all([
    supabase
      .from(BRANCHES_TABLE)
      .select("id, name, active, created_at")
      .order("created_at", { ascending: true }),
    supabase.from(USERS_TABLE).select("branch_id"),
  ]);

  if (branches.error || users.error) {
    console.error(
      "[money] listBranches failed:",
      branches.error?.message ?? users.error?.message,
    );
    return { status: "error" };
  }

  const counts = new Map<string, number>();
  for (const row of (users.data ?? []) as { branch_id: string | null }[]) {
    if (!row.branch_id) continue;
    counts.set(row.branch_id, (counts.get(row.branch_id) ?? 0) + 1);
  }

  return {
    status: "ok",
    data: (branches.data as BranchRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      active: row.active,
      createdAt: row.created_at,
      accountCount: counts.get(row.id) ?? 0,
    })),
  };
}
