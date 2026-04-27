import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";

const STATUS_CHIP = {
  open:    "bg-brand-50 text-brand-700",
  awarded: "bg-green-50 text-green-700",
  closed:  "bg-slate-100 text-slate-500",
  draft:   "bg-amber-50 text-amber-700",
};

export default async function GCProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("gc_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-8 py-8">
      <PageHeader
        title="My projects"
        subtitle="Everything you've posted — open, awarded, and closed."
        action={<Link href="/gc/post" className="btn btn-primary">+ Post project</Link>}
      />

      {!projects || projects.length === 0 ? (
        <div className="card p-12 text-center">
          <h3 className="font-semibold text-slate-900">No projects yet</h3>
          <p className="text-sm text-slate-500 mt-1 mb-6">Post your first project to start receiving bids.</p>
          <Link href="/gc/post" className="btn btn-primary">+ Post project</Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th className="text-left font-medium px-5 py-3">Title</th>
                <th className="text-left font-medium px-5 py-3 hidden md:table-cell">Location</th>
                <th className="text-left font-medium px-5 py-3">Status</th>
                <th className="text-right font-medium px-5 py-3">Budget</th>
                <th className="text-left font-medium px-5 py-3 hidden md:table-cell">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/project/${p.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                      {p.title}
                    </Link>
                    {p.project_type && (
                      <p className="text-xs text-slate-500 capitalize mt-0.5">{p.project_type}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600 hidden md:table-cell">{p.location ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`chip capitalize ${STATUS_CHIP[p.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-900 font-medium">
                    ${Number(p.budget_min / 1000).toFixed(0)}k–${Number(p.budget_max / 1000).toFixed(0)}k
                  </td>
                  <td className="px-5 py-3 text-slate-500 hidden md:table-cell">
                    {p.bid_deadline
                      ? new Date(p.bid_deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
