"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  MIN_PASSWORD_LENGTH,
  USERNAME_PATTERN,
  USERS_TABLE,
  normalizeUsername,
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  revokeUserSessions,
  verifyPassword,
} from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import type { ActionResult } from "@/lib/types";

/** Sign-in also reports where that account belongs, so there is no bounce. */
export type SignInResult = ActionResult & { redirectTo?: string };

/* ------------------------------------------------------- login throttling -- */

/**
 * Small in-process backoff so a password cannot be brute-forced at full speed.
 * Per-process and memory-only, which is proportionate for a single-operator
 * tool; a multi-instance deployment would want this in the database.
 */
const MAX_ATTEMPTS = 6;
const LOCKOUT_MS = 60_000;
const attempts = new Map<string, { count: number; firstAt: number }>();

function isThrottled(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > LOCKOUT_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string): void {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.firstAt > LOCKOUT_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count += 1;
}

/* --------------------------------------------------------------- sign in -- */

export async function signIn(
  usernameRaw: string,
  password: string,
): Promise<SignInResult> {
  const username = normalizeUsername(usernameRaw);

  if (!username) {
    return {
      ok: false,
      message: "auth.usernameRequired",
      fields: { username: "auth.usernameRequired" },
    };
  }
  if (!password) {
    return {
      ok: false,
      message: "auth.passwordRequired",
      fields: { password: "auth.passwordRequired" },
    };
  }
  // A malformed username cannot match any stored account, so treat it exactly
  // like a wrong password rather than hinting at the format.
  if (!USERNAME_PATTERN.test(username) || isThrottled(username)) {
    recordFailure(username);
    return { ok: false, message: "auth.invalidCredentials" };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: "error.config" };

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select("id, password_hash, active, role, branch_id, money_branches(active)")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    console.error("[money] signIn lookup failed:", error.message);
    return { ok: false, message: "error.generic" };
  }

  // Same message whether the account is missing or the password is wrong, so
  // the form cannot be used to discover which usernames exist.
  if (!data || !verifyPassword(password, data.password_hash)) {
    recordFailure(username);
    return { ok: false, message: "auth.invalidCredentials" };
  }
  if (!data.active) {
    return { ok: false, message: "auth.accountDisabled" };
  }

  // Refuse here rather than letting the session be created and the first page
  // silently bounce back to the login screen.
  const branch = Array.isArray(data.money_branches)
    ? data.money_branches[0]
    : data.money_branches;
  if (data.branch_id && branch?.active === false) {
    return { ok: false, message: "auth.branchDisabled" };
  }

  attempts.delete(username);

  if (!(await createSession(data.id))) {
    return { ok: false, message: "error.generic" };
  }

  await supabase
    .from(USERS_TABLE)
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.id);

  revalidatePath("/", "layout");
  // A super admin manages branches and accounts; a branch admin runs deposits.
  return {
    ok: true,
    message: "auth.signIn",
    redirectTo: data.role === "super_admin" ? "/branches" : "/",
  };
}

/* -------------------------------------------------------------- sign out -- */

export async function signOut(): Promise<void> {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/login");
}

/* ------------------------------------------------------- change password -- */

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "auth.sessionExpired" };

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: "auth.passwordTooShort",
      fields: { newPassword: "auth.passwordTooShort" },
    };
  }
  if (newPassword !== confirmPassword) {
    return {
      ok: false,
      message: "auth.passwordMismatch",
      fields: { confirmPassword: "auth.passwordMismatch" },
    };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: "error.config" };

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select("password_hash")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return { ok: false, message: "error.generic" };

  if (!verifyPassword(currentPassword, data.password_hash)) {
    return {
      ok: false,
      message: "auth.wrongCurrentPassword",
      fields: { currentPassword: "auth.wrongCurrentPassword" },
    };
  }

  const { error: updateError } = await supabase
    .from(USERS_TABLE)
    .update({ password_hash: hashPassword(newPassword) })
    .eq("id", user.id);

  if (updateError) {
    console.error("[money] changeOwnPassword failed:", updateError.message);
    return { ok: false, message: "error.generic" };
  }

  // Every other device is signed out; this one keeps its session.
  await revokeUserSessions(user.id);
  await createSession(user.id);

  revalidatePath("/", "layout");
  return { ok: true, message: "auth.passwordChanged" };
}
