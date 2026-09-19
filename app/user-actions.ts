"use server";

import { revalidatePath } from "next/cache";

import {
  MIN_PASSWORD_LENGTH,
  USERNAME_PATTERN,
  USERS_TABLE,
  getCurrentUser,
  hashPassword,
  isSuperAdmin,
  normalizeUsername,
  revokeUserSessions,
  type AuthUser,
  type Role,
} from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import type { ActionResult } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every action here re-checks the role on the server; the hidden nav item is only cosmetic. */
async function requireAdmin(): Promise<
  { ok: true; admin: AuthUser } | { ok: false; result: ActionResult }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, result: { ok: false, message: "auth.sessionExpired" } };
  }
  if (!isSuperAdmin(user)) {
    return { ok: false, result: { ok: false, message: "users.notAllowed" } };
  }
  return { ok: true, admin: user };
}

/**
 * Guards a write against another account.
 *
 * Every super admin has the same powers, with one exception: the OWNER account
 * is off limits to everyone but the owner. That is what makes the other admins
 * equals rather than superiors.
 */
async function guardTarget(
  admin: AuthUser,
  id: string,
): Promise<ActionResult | null> {
  if (!UUID.test(id)) return { ok: false, message: "error.notFound" };

  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: "error.config" };

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select("is_owner")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[money] guardTarget failed:", error.message);
    return { ok: false, message: "error.generic" };
  }
  if (!data) return { ok: false, message: "error.notFound" };

  if (data.is_owner && !admin.isOwner) {
    return { ok: false, message: "users.ownerProtected" };
  }
  return null;
}

export async function createUser(input: {
  fullName: string;
  username: string;
  password: string;
  role: Role;
  branchId: string | null;
}): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.result;

  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  const username = normalizeUsername(input.username);

  if (!fullName || fullName.length < 2) {
    return {
      ok: false,
      message: "users.nameRequired",
      fields: { fullName: "users.nameRequired" },
    };
  }
  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      message: "users.usernameInvalid",
      fields: { username: "users.usernameInvalid" },
    };
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: "auth.passwordTooShort",
      fields: { password: "auth.passwordTooShort" },
    };
  }
  if (input.role !== "super_admin" && input.role !== "admin") {
    return { ok: false, message: "error.generic" };
  }

  // An admin runs exactly one branch; a super admin runs none. The database
  // enforces the same rule with money_users_role_branch_check.
  const branchId = input.role === "admin" ? input.branchId : null;
  if (input.role === "admin" && (!branchId || !UUID.test(branchId))) {
    return {
      ok: false,
      message: "users.branchRequired",
      fields: { branchId: "users.branchRequired" },
    };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: "error.config" };

  // is_owner is never settable from the UI: there is exactly one owner, and the
  // database enforces that with a partial unique index.
  const { error } = await supabase.from(USERS_TABLE).insert({
    full_name: fullName,
    username,
    password_hash: hashPassword(input.password),
    role: input.role,
    branch_id: branchId,
    active: true,
  });

  if (error) {
    // 23505 is the unique violation on the username column.
    if (error.code === "23505") {
      return {
        ok: false,
        message: "users.usernameTaken",
        fields: { username: "users.usernameTaken" },
      };
    }
    console.error("[money] createUser failed:", error.message);
    return { ok: false, message: "error.generic" };
  }

  revalidatePath("/users");
  return { ok: true, message: "users.created" };
}

export async function setUserActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.result;

  const denied = await guardTarget(guard.admin, id);
  if (denied) return denied;

  // Locking yourself out would leave nobody able to manage accounts.
  if (id === guard.admin.id && !active) {
    return { ok: false, message: "users.cannotSelfDisable" };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: "error.config" };

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .update({ active })
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[money] setUserActive failed:", error.message);
    return { ok: false, message: "error.generic" };
  }
  if (!data || data.length === 0) return { ok: false, message: "error.notFound" };

  // A disabled account must lose access now, not when its cookie expires.
  if (!active) await revokeUserSessions(id);

  revalidatePath("/users");
  return { ok: true, message: "users.updated" };
}

export async function resetUserPassword(
  id: string,
  password: string,
): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.result;

  const denied = await guardTarget(guard.admin, id);
  if (denied) return denied;

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: "auth.passwordTooShort",
      fields: { password: "auth.passwordTooShort" },
    };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: "error.config" };

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .update({ password_hash: hashPassword(password) })
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[money] resetUserPassword failed:", error.message);
    return { ok: false, message: "error.generic" };
  }
  if (!data || data.length === 0) return { ok: false, message: "error.notFound" };

  await revokeUserSessions(id);

  revalidatePath("/users");
  return { ok: true, message: "users.updated" };
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.result;

  const denied = await guardTarget(guard.admin, id);
  if (denied) return denied;

  if (id === guard.admin.id) {
    return { ok: false, message: "users.cannotSelfDelete" };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: "error.config" };

  // Sessions cascade with the row, but clearing them first closes the window.
  await revokeUserSessions(id);

  const { error } = await supabase.from(USERS_TABLE).delete().eq("id", id);
  if (error) {
    console.error("[money] deleteUser failed:", error.message);
    return { ok: false, message: "error.generic" };
  }

  revalidatePath("/users");
  return { ok: true, message: "users.deleted" };
}
