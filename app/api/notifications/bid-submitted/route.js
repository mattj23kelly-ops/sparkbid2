// POST /api/notifications/bid-submitted
// Body: { bidId: string }
//
// Called fire-and-forget from the bid submission UI after a bid row is inserted.
// Verifies the caller really owns that bid, then looks up the GC's email and
// sends them a "new bid received" notification via Resend.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient, getUserEmail, userWantsNotification } from "@/lib/supabase/admin";
import { sendEmail, bidSubmittedTemplate } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { bidId } = await request.json();
    if (!bidId) {
      return Response.json({ error: "Missing bidId" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    // RLS already restricts bids to the submitting EC, so this confirms
    // the caller actually owns the bid they're notifying about.
    const { data: bid, error: bidErr } = await supabase
      .from("bids")
      .select("id, amount, ec_id, project_id")
      .eq("id", bidId)
      .eq("ec_id", user.id)
      .single();

    if (bidErr || !bid) {
      return Response.json({ error: "Bid not found" }, { status: 404 });
    }

    // Use the admin client for cross-user lookups (GC profile + email).
    const admin = createAdminClient();

    const [{ data: project }, { data: ecProfile }] = await Promise.all([
      admin.from("projects").select("id, title, gc_id").eq("id", bid.project_id).single(),
      admin.from("profiles").select("full_name, company_name").eq("id", user.id).single(),
    ]);

    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const gcEmail = await getUserEmail(project.gc_id);
    if (!gcEmail) {
      // Soft-fail: logging only. We don't want to break the bid flow.
      await admin.from("notification_log").insert({
        kind: "bid_submitted",
        recipient_id: project.gc_id,
        status: "failed",
        error: "GC email not found",
        payload: { bid_id: bid.id, project_id: project.id },
      });
      return Response.json({ ok: true, skipped: "no_gc_email" });
    }

    // Respect the GC's notification preferences.
    const wants = await userWantsNotification(project.gc_id, "new_bids");
    if (!wants) {
      await admin.from("notification_log").insert({
        kind: "bid_submitted",
        recipient_id: project.gc_id,
        recipient_email: gcEmail,
        status: "skipped",
        payload: { bid_id: bid.id, project_id: project.id, reason: "opted_out" },
      });
      return Response.json({ ok: true, skipped: "opted_out" });
    }

    const contractorName =
      ecProfile?.company_name ?? ecProfile?.full_name ?? "An electrician";

    const tpl = bidSubmittedTemplate({
      projectTitle:   project.title,
      contractorName,
      amount:         bid.amount,
      projectId:      project.id,
    });

    try {
      await sendEmail({ to: gcEmail, ...tpl });
      await admin.from("notification_log").insert({
        kind: "bid_submitted",
        recipient_id: project.gc_id,
        recipient_email: gcEmail,
        subject: tpl.subject,
        status: "sent",
        payload: { bid_id: bid.id, project_id: project.id, amount: bid.amount },
      });
    } catch (sendErr) {
      await admin.from("notification_log").insert({
        kind: "bid_submitted",
        recipient_id: project.gc_id,
        recipient_email: gcEmail,
        subject: tpl.subject,
        status: "failed",
        error: sendErr?.message ?? String(sendErr),
        payload: { bid_id: bid.id, project_id: project.id },
      });
      throw sendErr;
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("bid-submitted notification error:", err);
    return Response.json(
      { error: err?.message ?? "Notification failed" },
      { status: 500 }
    );
  }
}
