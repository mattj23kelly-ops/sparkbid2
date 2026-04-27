// GET  /api/user-settings        → current user's notification prefs
// POST /api/user-settings        → upsert current user's notification prefs
//
// Only keys we know about are written; everything else is ignored.

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_KEYS = [
  "new_projects",
  "bid_updates",
  "new_bids",
  "bid_deadline",
  "messages",
  "marketing",
];

const DEFAULTS = {
  new_projects: true,
  bid_updates:  true,
  new_bids:     true,
  bid_deadline: true,
  messages:     true,
  marketing:    false,
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // If no row exists yet (e.g. profile was created before the v4 migration
  // and the trigger didn't fire) return defaults.
  return Response.json({ settings: data ?? { user_id: user.id, ...DEFAULTS } });
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch = {};
  for (const key of ALLOWED_KEYS) {
    if (typeof body[key] === "boolean") patch[key] = body[key];
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "No valid fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ settings: data });
}
