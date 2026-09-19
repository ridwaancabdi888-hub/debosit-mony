import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getSupabase } from "@/lib/supabase";

/**
 * Self-contained auth for the Money system.
 *
 * Supabase Auth is deliberately unused: a new row in this project's auth.users
 * fires the Cafeteria trigger trg_on_auth_user_created, which would make every
 * account an active Cafeteria 'cashier'. Cafeteria is read-only for us, so we
 * keep our own users table and never touch auth.users.
 */

export const USERS_TABLE = "money_users";
export const SESSIONS_TABLE = "money_sessions";
export const SESSION_COOKIE = "money_session";

const SESSION_TTL_DAYS = 7;
const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;

export type Role = "super_admin" | "admin";

export type AuthUser = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  /** The one protected account: other super admins cannot act on it. */
  isOwner: boolean;
  /** NULL for a super admin; the tenant an admin is confined to. */
  branchId: string | null;
  branchName: string | null;
};

export function isSuperAdmin(user: AuthUser | null): boolean {
  return user?.role === "super_admin";
}

/* ----------------------------------------------------------- passwords ---- */

const SCRYPT = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;

/**
 * Deliberately short, at the owner's request, so logins stay quick to type
 * (e.g. "1234"). The brute-force throttle in app/auth-actions.ts carries the
 * weight instead. Raise this if the app is ever exposed to the internet.
 */
export const MIN_PASSWORD_LENGTH = 4;

/** Login identifier rules, mirrored by the money_users_username_format CHECK. */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, KEY_LENGTH, SCRYPT);
  return [
    "scrypt",
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltB64, keyB64] = parts;
  try {
    const salt = Buffer.from(saltB64, "base64url");
    const expected = Buffer.from(keyB64, "base64url");
    const actual = scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    // Constant-time: a timing difference would leak how much of the hash matched.
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------ sessions ---- */

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Issues a session and sets the cookie. Only the token's hash is stored. */
export async function createSession(userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  const { error } = await supabase.from(SESSIONS_TABLE).insert({
    token_hash: sha256(token),
    user_id: userId,
    expires_at: expiresAt.toISOString(),
  });
  if (error) {
    console.error("[money] createSession failed:", error.message);
    return false;
  }

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return true;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  jar.delete(SESSION_COOKIE);
  if (!token) return;

  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from(SESSIONS_TABLE).delete().eq("token_hash", sha256(token));
}

/** Drops every session for a user — used when a password is reset or the account disabled. */
export async function revokeUserSessions(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from(SESSIONS_TABLE).delete().eq("user_id", userId);
}

type SessionRow = {
  expires_at: string;
  money_users: {
    id: string;
    username: string;
    full_name: string;
    role: Role;
    active: boolean;
    is_owner: boolean;
    branch_id: string | null;
    // PostgREST types a to-one embed as an array; it arrives as an object.
    money_branches:
      | { name: string; active: boolean }
      | { name: string; active: boolean }[]
      | null;
  } | null;
};

/**
 * The signed-in user, or null. Memoised per request so the layout, the page and
 * any component can all ask without repeating the query.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(SESSIONS_TABLE)
    .select(
      "expires_at, money_users(id, username, full_name, role, active, is_owner, branch_id, money_branches(name, active))",
    )
    .eq("token_hash", sha256(token))
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as SessionRow;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;

  const user = row.money_users;
  // A deactivated account loses access immediately, without waiting for expiry.
  if (!user || !user.active) return null;

  const branch = Array.isArray(user.money_branches)
    ? user.money_branches[0]
    : user.money_branches;
  // Disabling a whole branch signs out everyone in it.
  if (user.branch_id && branch?.active === false) return null;

  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    isOwner: user.is_owner,
    branchId: user.branch_id,
    branchName: branch?.name ?? null,
  };
});

/** For pages: redirect to the login screen when not signed in. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * For the branch-management pages. A branch admin has no business here, so it
 * is sent back to its own dashboard.
 */
export async function requireSuperAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (!isSuperAdmin(user)) redirect("/");
  return user;
}

/**
 * For every page that shows deposits.
 *
 * Returns a user guaranteed to carry a branch id, which callers then use to
 * scope their queries. A super admin is redirected to the branch list: it
 * manages accounts and never sees a customer, a total or a commission.
 */
export async function requireBranchUser(): Promise<
  AuthUser & { branchId: string }
> {
  const user = await requireUser();
  if (isSuperAdmin(user) || !user.branchId) redirect("/branches");
  return user as AuthUser & { branchId: string };
}
