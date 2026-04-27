import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";

const STATUS_STYLES = {
  draft:    "bg-slate-100 text-slate-600",
  ready:    "bg-brand-100 text-brand-700",
  sent:     "bg-blue-100 text-blue-700",
  won:      "bg-green-100 text-green-700",
  lost:     "bg-red-100 text-red-700",
  archived: "bg-slate-100 text-slate-400",
};

export default async function EstimatesListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: estimates } = await supabase
    .from("estimates")
    .select("*, takeoff:takeoffs(location, project_type, square_footage)")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-8 py-8">
      <PageHeader
        title="My Estimates"
        subtitle="Every take-off and priced estimate you've created."
        action={
          <Link href="/estimator" className="btn btn-primary">
            + New estimate
          </Link>
        }
      />

      {!estimates || estimates.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th className="text-left font-medium px-5 py-3">Title</th>
                <th className="text-left font-medium px-5 py-3 hidden md:table-cell">Location</th>
                <th className="text-left font-medium px-5 py-3">Status</th>
                <th className="text-right font-medium px-5 py-3">Total</th>
                <th className="text-left font-medium px-5 py-3 hidden md:table-cell">Created</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((e) => (
                <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/estimates/${e.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                      {e.title}
                    </Link>
                    {e.takeoff?.project_type && (
                      <p className="text-xs text-slate-500 capitalize mt-0.5">{e.takeoff.project_type}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600 hidden md:table-cell">{e.takeoff?.location ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`chip capitalize ${STATUS_STYLES[e.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold text-slate-900">
                    ${Number(e.grand_total).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-slate-500 hidden md:table-cell">
                    {new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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

function EmptyState() {
  return (
    <div className="card p-12 text-center">
      <div className="mx-auto w-12 h-12 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
      </div>
      <h3 className="font-semibold text-slate-900">No estimates yet</h3>
      <p className="text-sm text-slate-500 mt-1 mb-6 max-w-sm mx-auto">
        Upload a blueprint and let the AI produce a full take-off and priced estimate.
      </p>
      <Link href="/estimator" className="btn btn-primary">+ Create your first estimate</Link>
    </div>
  );
}
