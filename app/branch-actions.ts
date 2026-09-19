"use server";

import { revalidatePath } from "next/cache";

import {
  USERS_TABLE,
  getCurrentUser,
  isSuperAdmin,
  revokeUserSessions,
} from "@/lib/auth";
import { BRANCHES_TABLE } from "@/lib/branches";
import { DEPOSITS_TABLE, getSupabase } from "@/lib/supabase";
import type { ActionResult } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only the super admin manages branches; re-checked here, not just in the nav. */
async function requireSuperAdminAction(): Promise<ActionResult | null> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "auth.sessionExpired" };
  if (!isSuperAdmin(user)) return { ok: false, message: "users.notAllowed" };
  return null;
}

function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export async function createBranch(nameRaw: string): Promise<ActionResult> {
  const denied = await requireSuperAdminAction();
  if (denied) return denied;

  const name = cleanName(nameRaw);
  if (name.length < 2 || name.length > 80) {
    return {
      ok: false,
      message: "branches.nameRequired",
      fields: { name: "branches.nameRequired" },
    };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: "error.config" };

  const { error } = await supabase.from(BRANCHES_TABLE).insert({ name });
  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message: "branches.nameTaken",
        fields: { name: "branches.nameTaken" },
      };
    }
    console.error("[money] createBranch failed:", error.message);
    return { ok: false, message: "error.generic" };
  }

  revalidatePath("/branches");
  revalidatePath("/users");
  return { ok: true, message: "branches.created" };
}

export async function renameBranch(
  id: string,
  nameRaw: string,
): Promise<ActionResult> {
  const denied = await requireSuperAdminAction();
  if (denied) return denied;
  if (!UUID.test(id)) return { ok: false, message: "error.notFound" };

  const name = cleanName(nameRaw);
  if (name.length < 2 || name.length > 80) {
    return {
      ok: false,
      message: "branches.nameRequired",
      fields: { name: "branches.nameRequired" },
    };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: "error.config" };

  const { data, error } = await supabase
    .from(BRANCHES_TABLE)
    .update({ name })
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message: "branches.nameTaken",
        fields: { name: "branches.nameTaken" },
      };
    }
    console.error("[money] renameBranch failed:", error.message);
    return { ok: false, message: "error.generic" };
  }
  if (!data || data.length === 0) return { ok: false, message: "error.notFound" };

  revalidatePath("/branches");
  revalidatePath("/users");
  return { ok: true, message: "branches.updated" };
}

export async function setBranchActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const denied = await requireSuperAdminAction();
  if (denied) return denied;
  if (!UUID.test(id)) return { ok: false, message: "error.notFound" };

  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: "error.config" };

  const { data, error } = await supabase
    .from(BRANCHES_TABLE)
    .update({ active })
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[money] setBranchActive failed:", error.message);
    return { ok: false, message: "error.generic" };
  }
  if (!data || data.length === 0) return { ok: false, message: "error.notFound" };

  // Closing a branch must take effect now: sign out everyone who belongs to it.
  if (!active) {
    const { data: members } = await supabase
      .from(USERS_TABLE)
      .select("id")
      .eq("branch_id", id);
    for (const member of (members ?? []) as { id: string }[]) {
      await revokeUserSessions(member.id);
    }
  }

  revalidatePath("/branches");
  revalidatePath("/users");
  return { ok: true, message: "branches.updated" };
}

export async function deleteBranch(id: string): Promise<ActionResult> {
  const denied = await requireSuperAdminAction();
  if (denied) return denied;
  if (!UUID.test(id)) return { ok: false, message: "error.notFound" };

  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: "error.config" };

  // Refuse while anything still belongs to it, so a branch's customers can
  // never be orphaned or silently destroyed. The FK is ON DELETE RESTRICT too.
  const [accounts, customers] = await Promise.all([
    supabase.from(USERS_TABLE).select("id").eq("branch_id", id).limit(1),
    supabase.from(DEPOSITS_TABLE).select("id").eq("branch_id", id).limit(1),
  ]);

  if (accounts.error || customers.error) {
    console.error(
      "[money] deleteBranch checks failed:",
      accounts.error?.message ?? customers.error?.message,
    );
    return { ok: false, message: "error.generic" };
  }
  if (
    (accounts.data && accounts.data.length > 0) ||
    (customers.data && customers.data.length > 0)
  ) {
    return { ok: false, message: "branches.deleteBlocked" };
  }

  const { error } = await supabase.from(BRANCHES_TABLE).delete().eq("id", id);
  if (error) {
    console.error("[money] deleteBranch failed:", error.message);
    return { ok: false, message: "error.generic" };
  }

  revalidatePath("/branches");
  revalidatePath("/users");
  return { ok: true, message: "branches.deleted" };
}
