// POST /api/notifications/bid-awarded
// Body: { bidId: string }
//
// Called after a GC awards a bid. Looks up the EC's email and sends the
// "you won" notification. Caller must be the GC who owns the parent project.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient, getUserEmail, userWantsNotification } from "@/lib/supabase/admin";
import { sendEmail, bidAwardedTemplate } from "@/lib/email";

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

    const admin = createAdminClient();

    const { data: bid, error: bidErr } = await admin
      .from("bids")
      .select("id, amount, ec_id, project_id, status")
      .eq("id", bidId)
      .single();

    if (bidErr || !bid) {
      return Response.json({ error: "Bid not found" }, { status: 404 });
    }

    const { data: project } = await admin
      .from("projects")
      .select("id, title, gc_id")
      .eq("id", bid.project_id)
      .single();

    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    // Only the GC who owns the project can send this notification.
    if (project.gc_id !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: gcProfile } = await admin
      .from("profiles")
      .select("full_name, company_name")
      .eq("id", project.gc_id)
      .single();

    const ecEmail = await getUserEmail(bid.ec_id);
    if (!ecEmail) {
      await admin.from("notification_log").insert({
        kind: "bid_awarded",
        recipient_id: bid.ec_id,
        status: "failed",
        error: "EC email not found",
        payload: { bid_id: bid.id, project_id: project.id },
      });
      return Response.json({ ok: true, skipped: "no_ec_email" });
    }

    // Respect the winning EC's notification preferences.
    const wants = await userWantsNotification(bid.ec_id, "bid_updates");
    if (!wants) {
      await admin.from("notification_log").insert({
        kind: "bid_awarded",
        recipient_id: bid.ec_id,
        recipient_email: ecEmail,
        status: "skipped",
        payload: { bid_id: bid.id, project_id: project.id, reason: "opted_out" },
      });
      return Response.json({ ok: true, skipped: "opted_out" });
    }

    const gcName = gcProfile?.company_name ?? gcProfile?.full_name ?? "The GC";

    const tpl = bidAwardedTemplate({
      projectTitle: project.title,
      gcName,
      amount:       bid.amount,
      projectId:    project.id,
    });

    try {
      await sendEmail({ to: ecEmail, ...tpl });
      await admin.from("notification_log").insert({
        kind: "bid_awarded",
        recipient_id: bid.ec_id,
        recipient_email: ecEmail,
        subject: tpl.subject,
        status: "sent",
        payload: { bid_id: bid.id, project_id: project.id, amount: bid.amount },
      });
    } catch (sendErr) {
      await admin.from("notification_log").insert({
        kind: "bid_awarded",
        recipient_id: bid.ec_id,
        recipient_email: ecEmail,
        subject: tpl.subject,
        status: "failed",
        error: sendErr?.message ?? String(sendErr),
        payload: { bid_id: bid.id, project_id: project.id },
      });
      throw sendErr;
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("bid-awarded notification error:", err);
    return Response.json(
      { error: err?.message ?? "Notification failed" },
      { status: 500 }
    );
  }
}
