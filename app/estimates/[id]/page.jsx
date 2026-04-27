import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import UseEstimateForBid from "@/components/ui/UseEstimateForBid";

const CATEGORY_LABELS = {
  device:  "Devices",
  fixture: "Fixtures",
  panel:   "Panels / gear",
  conduit: "Conduit",
  wire:    "Wire",
  other:   "Other",
  labor:   "Labor",
};

export default async function EstimateDetailPage({ params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: estimate } = await supabase
    .from("estimates")
    .select("*, takeoff:takeoffs(*)")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();

  if (!estimate) notFound();

  const { data: lines } = await supabase
    .from("estimate_line_items")
    .select("*")
    .eq("estimate_id", estimate.id)
    .order("sort_order", { ascending: true });

  const byCat = {};
  for (const li of lines ?? []) (byCat[li.category] ??= []).push(li);

  // Data for the "Use this estimate on a bid" picker.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, verification_status")
    .eq("id", user.id)
    .single();

  const canBid =
    profile?.role === "ec" && profile?.verification_status === "approved";

  // Projects the user has already bid on — exclude them from the picker
  // since the bids table has UNIQUE(project_id, ec_id).
  const { data: existingBids } = await supabase
    .from("bids")
    .select("project_id")
    .eq("ec_id", user.id);
  const alreadyBidIds = new Set((existingBids ?? []).map((b) => b.project_id));

  const { data: openProjects } = canBid
    ? await supabase
        .from("projects")
        .select("id, title, location, project_type, budget_max, bid_deadline, created_at")
        .eq("status", "open")
        .order("bid_deadline", { ascending: true, nullsFirst: false })
        .limit(30)
    : { data: [] };

  const biddableProjects = (openProjects ?? []).filter(
    (p) => !alreadyBidIds.has(p.id)
  );

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-8 py-8">
      <PageHeader
        title={estimate.title}
        subtitle={estimate.takeoff?.location ? `${estimate.takeoff.location} · ${new Date(estimate.created_at).toLocaleDateString()}` : null}
        action={
          <Link href="/estimates" className="btn btn-ghost">← All estimates</Link>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Take-off summary */}
          {estimate.takeoff && (
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Take-off</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <Stat label="Type"   value={estimate.takeoff.project_type ?? "—"} className="capitalize" />
                <Stat label="Sq Ft"  value={estimate.takeoff.square_footage ? Number(estimate.takeoff.square_footage).toLocaleString() : "—"} />
                <Stat label="Stories" value={estimate.takeoff.stories ?? "—"} />
                <Stat label="AI"     value={estimate.takeoff.ai_confidence ? `${Math.round(estimate.takeoff.ai_confidence)}%` : "—"} />
              </div>
              {estimate.takeoff.scope_summary && (
                <p className="text-sm text-slate-600 mt-4 leading-relaxed">{estimate.takeoff.scope_summary}</p>
              )}
            </div>
          )}

          {/* Line items */}
          {Object.entries(byCat).map(([cat, rows]) => (
            <div key={cat} className="card overflow-hidden">
              <p className="px-5 py-3 text-sm font-semibold text-slate-900 border-b border-slate-200 bg-slate-50">
                {CATEGORY_LABELS[cat] ?? cat}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-slate-500">
                      <th className="text-left font-medium px-4 py-2">Description</th>
                      <th className="text-right font-medium px-4 py-2">Qty</th>
                      <th className="text-right font-medium px-4 py-2">Unit</th>
                      <th className="text-right font-medium px-4 py-2">Ext mat</th>
                      <th className="text-right font-medium px-4 py-2">Ext hrs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((li) => (
                      <tr key={li.id} className="border-t border-slate-100">
                        <td className="px-4 py-2 text-slate-900">{li.description}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{li.quantity}</td>
                        <td className="px-4 py-2 text-right text-slate-500">{li.unit}</td>
                        <td className="px-4 py-2 text-right tabular-nums">${Number(li.line_material).toFixed(2)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{Number(li.line_labor_hrs).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Totals sidebar */}
        <aside className="lg:col-span-1">
          <div className="sticky top-6 card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Summary</p>
            <Row label="Materials"    value={estimate.materials_total} />
            <Row label={`Labor (${Number(estimate.labor_hours).toFixed(1)} hrs × $${estimate.labor_rate}/hr)`} value={estimate.labor_total} />
            <Divider />
            <Row muted label={`Overhead (${estimate.overhead_pct}%)`}       value={estimate.overhead_total} />
            <Row muted label={`Profit (${estimate.profit_pct}%)`}           value={estimate.profit_total} />
            <Row muted label={`Contingency (${estimate.contingency_pct}%)`} value={estimate.contingency_total} />
            <Divider />
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-semibold text-slate-900">Grand total</span>
              <span className="text-2xl font-bold tabular-nums">${Number(estimate.grand_total).toLocaleString()}</span>
            </div>

            {/* Estimate → bid launcher */}
            {profile?.role === "ec" && (
              <UseEstimateForBid
                estimateId={estimate.id}
                projects={biddableProjects}
                canBid={canBid}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, className = "" }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-semibold text-slate-900 mt-0.5 ${className}`}>{value}</p>
    </div>
  );
}

function Row({ label, value, muted }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={`text-sm ${muted ? "text-slate-500" : "text-slate-700"}`}>{label}</span>
      <span className={`text-sm tabular-nums ${muted ? "text-slate-500" : "font-medium text-slate-900"}`}>
        ${Number(value).toLocaleString()}
      </span>
    </div>
  );
}

function Divider() { return <div className="h-px bg-slate-100 my-2" />; }
