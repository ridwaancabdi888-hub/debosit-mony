import { USERS_TABLE, type Role } from "@/lib/auth";
import type { LoadResult } from "@/lib/deposits";
import { getSupabase } from "@/lib/supabase";

export type ManagedUser = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  active: boolean;
  isOwner: boolean;
  branchName: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};

type UserRow = {
  id: string;
  username: string;
  full_name: string;
  role: Role;
  active: boolean;
  is_owner: boolean;
  // PostgREST types a to-one embed as an array; it arrives as an object.
  money_branches: { name: string } | { name: string }[] | null;
  created_at: string;
  last_login_at: string | null;
};

/** Normalises a to-one embed that may arrive as an object or a single-item array. */
function firstName(
  value: { name: string } | { name: string }[] | null,
): string | null {
  if (!value) return null;
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name ?? null;
}

/** Never selects password_hash — it has no reason to leave the database. */
const COLUMNS =
  "id, username, full_name, role, active, is_owner, created_at, last_login_at, money_branches(name)";

export async function listUsers(): Promise<LoadResult<ManagedUser[]>> {
  const supabase = getSupabase();
  if (!supabase) return { status: "unconfigured" };

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select(COLUMNS)
    // Owner first, then oldest account first.
    .order("is_owner", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[money] listUsers failed:", error.message);
    return { status: "error" };
  }

  return {
    status: "ok",
    data: (data as unknown as UserRow[]).map((row) => ({
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      active: row.active,
      isOwner: row.is_owner,
      branchName: firstName(row.money_branches),
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
    })),
  };
}
