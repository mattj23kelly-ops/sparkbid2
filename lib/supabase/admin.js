// Server-side Supabase client using the service role key.
// BYPASSES ROW LEVEL SECURITY. Never import this from client code.
// Use it only from API routes when you need to look up auth.users emails
// or send notifications on behalf of users.
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL missing");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Convenience: look up an email address for a user id.
export async function getUserEmail(userId) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw error;
  return data?.user?.email ?? null;
}

// Check whether a user wants a specific notification category.
// Missing row (legacy users) or missing key → treated as opted-in by default,
// matching the checkbox defaults on /settings.
//
// Known keys: new_projects, bid_updates, new_bids, bid_deadline, messages, marketing.
// Account-critical emails (verification decisions) should bypass this check.
export async function userWantsNotification(userId, key) {
  if (!userId || !key) return true;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_settings")
    .select(key)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[userWantsNotification] lookup failed:", error.message);
    return true; // fail-open so we don't silently drop notifications on a db error
  }
  if (!data) return true;              // no row → defaults apply
  const val = data[key];
  if (typeof val !== "boolean") return true;
  return val;
}
