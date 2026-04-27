import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";

export default async function GCDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();

  const { data: projects } = await supabase
    .from("projects").select("*").eq("gc_id", user.id)
    .order("created_at", { ascending: false });

  const open     = (projects ?? []).filter(p => p.status === "open");
  const awarded  = (projects ?? []).filter(p => p.status === "awarded");

  const projectIds = open.map(p => p.id);
  const { data: bidCounts } = projectIds.length
    ? await supabase.from("bids").select("project_id").in("project_id", projectIds)
    : { data: [] };

  const countMap = {};
  bidCounts?.forEach(b => { countMap[b.project_id] = (countMap[b.project_id] ?? 0) + 1; });
  const totalBids = Object.values(countMap).reduce((a, b) => a + b, 0);
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-8 py-8">
        <PageHeader
          title={`Welcome back, ${firstName}`}
          subtitle={profile?.company_name ?? "Your project workspace."}
          action={<Link href="/gc/post" className="btn btn-primary">+ Post project</Link>}
        />

        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label="Active projects" value={open.length} />
          <StatCard label="Total bids"      value={totalBids} />
          <StatCard label="Awarded"         value={awarded.length} />
        </div>

        <SectionHeader title="Active projects" action={
          <Link href="/gc/projects" className="text-sm font-medium text-brand-600 hover:text-brand-700">View all →</Link>
        } />

        {open.length > 0 ? (
          <div className="card divide-y divide-slate-100">
            {open.map((project) => {
              const bidCount = countMap[project.id] ?? 0;
              const urgent   = project.bid_deadline &&
                new Date(project.bid_deadline) < new Date(Date.now() + 3*24*60*60*1000);
              return (
                <div key={project.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 truncate">{project.title}</p>
                      {urgent && <span className="chip bg-red-100 text-red-700">Urgent</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {project.location}
                      {project.bid_deadline && ` · Due ${new Date(project.bid_deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-medium text-brand-700">{bidCount} bid{bidCount !== 1 ? "s" : ""}</span>
                    {bidCount > 0 && (
                      <Link href={`/gc/bids/${project.id}`} className="btn btn-secondary !py-1.5 !px-3 text-xs">Review</Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <h3 className="font-semibold text-slate-900">No active projects</h3>
            <p className="text-sm text-slate-500 mt-1 mb-6">Post your first project to start receiving bids from electricians.</p>
            <Link href="/gc/post" className="btn btn-primary">+ Post project</Link>
          </div>
        )}

        {awarded.length > 0 && (
          <>
            <div className="mt-8">
              <SectionHeader title="Recently awarded" />
            </div>
            <div className="card divide-y divide-slate-100">
              {awarded.slice(0, 3).map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{p.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{p.location}</p>
                  </div>
                  <span className="chip bg-green-100 text-green-700">Active</span>
                </div>
              ))}
            </div>
          </>
        )}
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

function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {action}
    </div>
  );
}
