import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client.
 *
 * None of these variables carry the NEXT_PUBLIC_ prefix, so Next.js will not
 * inline them into the client bundle — the browser never sees the Supabase key.
 * Every request carries the private `x-app-key` header that the table's RLS
 * policies require, which means a leaked publishable key on its own cannot read
 * or write `money_deposits`.
 */

export const DEPOSITS_TABLE = "money_deposits";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  const appKey = process.env.MONEY_APP_KEY;
  if (!url || !key || !appKey) return null;

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-app-key": appKey } },
  });
  return cached;
}
