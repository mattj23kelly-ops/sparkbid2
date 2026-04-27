// POST /api/admin/verify
// Body: { profileId: string, decision: 'approve' | 'reject', notes?: string }
//
// Updates a contractor's verification status and emails them the decision.
// Only admins can call this.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient, getUserEmail } from "@/lib/supabase/admin";
import { sendEmail, verificationDecisionTemplate } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { profileId, decision, notes } = await request.json();
    if (!profileId || !["approve", "reject"].includes(decision)) {
      return Response.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Confirm the caller is an admin.
    const { data: me } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!me?.is_admin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const approved = decision === "approve";
    const admin = createAdminClient();

    const { data: updated, error: updateErr } = await admin
      .from("profiles")
      .update({
        verification_status: approved ? "approved" : "rejected",
        verified_at:         approved ? new Date().toISOString() : null,
        verification_notes:  notes ?? null,
      })
      .eq("id", profileId)
      .select("id, full_name, company_name, role")
      .single();

    if (updateErr) {
      return Response.json({ error: updateErr.message }, { status: 500 });
    }

    // Try to email the contractor. Don't fail the whole request if email breaks.
    try {
      const email = await getUserEmail(profileId);
      if (email) {
        const tpl = verificationDecisionTemplate({
          approved,
          fullName: updated.full_name,
          notes,
        });
        await sendEmail({ to: email, ...tpl });
        await admin.from("notification_log").insert({
          kind: "verification_decision",
          recipient_id: profileId,
          recipient_email: email,
          subject: tpl.subject,
          status: "sent",
          payload: { decision, notes: notes ?? null },
        });
      }
    } catch (e) {
      console.warn("Verification email failed:", e?.message ?? e);
      await admin.from("notification_log").insert({
        kind: "verification_decision",
        recipient_id: profileId,
        status: "failed",
        error: e?.message ?? String(e),
        payload: { decision, notes: notes ?? null },
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("admin/verify error:", err);
    return Response.json({ error: err?.message ?? "Failed" }, { status: 500 });
  }
}
