import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";

export default async function ECDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();

  // Estimator-first: recent estimates drive the dashboard
  const { data: recentEstimates } = await supabase
    .from("estimates")
    .select("id, title, status, grand_total, created_at, takeoff:takeoffs(location, project_type)")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: openProjects } = await supabase
    .from("projects")
    .select("id, title, location, budget_min, budget_max, project_type")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(3);

  // Marketplace stats (kept, but secondary)
  const { data: bids } = await supabase
    .from("bids").select("id, status, amount")
    .eq("ec_id", user.id);

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const activeBids  = (bids ?? []).filter(b => ["submitted", "winning"].includes(b.status));
  const totalValue  = (recentEstimates ?? []).reduce((s, e) => s + Number(e.grand_total ?? 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-8 py-8">
        <PageHeader
          title={`Welcome back, ${firstName}`}
          subtitle="Your estimating workspace."
          action={
            <Link href="/estimator" className="btn btn-primary">+ New estimate</Link>
          }
        />

        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Recent estimates" value={recentEstimates?.length ?? 0} />
          <StatCard label="Estimated value"  value={`$${(totalValue / 1000).toFixed(0)}k`} />
          <StatCard label="Active bids"      value={activeBids.length} />
          <StatCard label="Win rate"         value={`${profile?.win_rate ?? 0}%`} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent estimates */}
          <div className="lg:col-span-2">
            <SectionHeader
              title="Recent estimates"
              action={<Link href="/estimates" className="text-sm font-medium text-brand-600 hover:text-brand-700">View all →</Link>}
            />
            {recentEstimates && recentEstimates.length > 0 ? (
              <div className="card divide-y divide-slate-100">
                {recentEstimates.map((e) => (
                  <Link key={e.id} href={`/estimates/${e.id}`}
                        className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{e.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {e.takeoff?.location ?? "—"}
                        {e.takeoff?.project_type && ` · ${e.takeoff.project_type}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="font-semibold text-slate-900 tabular-nums">${Number(e.grand_total).toLocaleString()}</p>
                      <p className="text-xs text-slate-500 capitalize mt-0.5">{e.status}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="card p-8 text-center">
                <p className="text-sm text-slate-600">No estimates yet.</p>
                <Link href="/estimator" className="btn btn-primary mt-3">Create your first</Link>
              </div>
            )}
          </div>

          {/* Sidebar: marketplace shortcut */}
          <div className="lg:col-span-1 space-y-6">
            <div className="card p-5">
              <SectionHeader
                title="Open projects"
                action={<Link href="/browse" className="text-sm font-medium text-brand-600 hover:text-brand-700">Browse →</Link>}
                size="sm"
              />
              {openProjects && openProjects.length > 0 ? (
                <ul className="divide-y divide-slate-100 -mx-2">
                  {openProjects.map((p) => (
                    <li key={p.id}>
                      <Link href={`/project/${p.id}`} className="block px-2 py-2 hover:bg-slate-50 rounded-md">
                        <p className="text-sm font-medium text-slate-900 truncate">{p.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {p.location} · ${Number(p.budget_min/1000).toFixed(0)}k–${Number(p.budget_max/1000).toFixed(0)}k
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No open projects right now.</p>
              )}
            </div>

            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Tip</p>
              <p className="text-sm text-slate-700 leading-relaxed">
                Upload any plan sheet — even a partial — and the AI will produce a take-off. Review, adjust, and price in under 5 minutes.
              </p>
              <Link href="/estimator" className="btn btn-secondary mt-4 w-full">Try it now</Link>
            </div>
          </div>
        </div>
    </div>
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

function SectionHeader({ title, action, size = "md" }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className={size === "sm" ? "text-sm font-semibold text-slate-900" : "text-lg font-semibold text-slate-900"}>{title}</h2>
      {action}
    </div>
  );
}
