import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";

const STATUS_CHIP = {
  submitted: "bg-brand-50 text-brand-700",
  winning:   "bg-green-50 text-green-700",
  outbid:    "bg-red-50 text-red-700",
  awarded:   "bg-green-100 text-green-800",
  declined:  "bg-slate-100 text-slate-500",
};

export default async function MyBidsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: bids } = await supabase
    .from("bids")
    .select(`
      *,
      project:projects (id, title, location, budget_min, budget_max, bid_deadline, project_type, status)
    `)
    .eq("ec_id", user.id)
    .order("created_at", { ascending: false });

  const active  = bids?.filter(b => ["submitted", "winning"].includes(b.status)) ?? [];
  const awarded = bids?.filter(b => b.status === "awarded") ?? [];
  const past    = bids?.filter(b => ["outbid", "declined"].includes(b.status)) ?? [];

  const winRate = bids?.length ? Math.round((awarded.length / bids.length) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-8 py-8">
      <PageHeader
        title="My bids"
        subtitle="Every bid you've submitted across SparkBid projects."
        action={<Link href="/browse" className="btn btn-primary">Browse projects</Link>}
      />

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total bids" value={bids?.length ?? 0} />
        <StatCard label="Active"     value={active.length} />
        <StatCard label="Win rate"   value={`${winRate}%`} />
      </div>

      {(!bids || bids.length === 0) ? (
        <div className="card p-12 text-center">
          <h3 className="font-semibold text-slate-900">No bids yet</h3>
          <p className="text-sm text-slate-500 mt-1 mb-6">Browse open projects and submit your first bid.</p>
          <Link href="/browse" className="btn btn-primary">Browse projects</Link>
        </div>
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <Section title="Active">
              {active.map((bid) => <BidRow key={bid.id} bid={bid} />)}
            </Section>
          )}
          {awarded.length > 0 && (
            <Section title="Awarded">
              {awarded.map((bid) => <BidRow key={bid.id} bid={bid} />)}
            </Section>
          )}
          {past.length > 0 && (
            <Section title="Past">
              {past.map((bid) => <BidRow key={bid.id} bid={bid} />)}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900 mb-3">{title}</h2>
      <div className="card divide-y divide-slate-100">{children}</div>
    </div>
  );
}

function BidRow({ bid }) {
  const chipCls = STATUS_CHIP[bid.status] ?? "bg-slate-100 text-slate-600";
  const project = bid.project;
  const budgetLabel = project?.budget_min && project?.budget_max
    ? `$${(project.budget_min / 1000).toFixed(0)}k–$${(project.budget_max / 1000).toFixed(0)}k`
    : null;

  return (
    <Link
      href={`/project/${project?.id}`}
      className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-slate-900 truncate">{project?.title ?? "Project"}</p>
          <span className={`chip capitalize ${chipCls}`}>{bid.status}</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5 truncate">
          {project?.location ?? "—"}
          {" · Submitted "}
          {new Date(bid.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          {bid.strategy && ` · ${bid.strategy}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-slate-900 tabular-nums">${bid.amount.toLocaleString()}</p>
        {budgetLabel && <p className="text-xs text-slate-500">budget {budgetLabel}</p>}
      </div>
    </Link>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold tracking-tight text-slate-900 mt-1 tabular-nums">{value}</p>
    </div>
  );
}
