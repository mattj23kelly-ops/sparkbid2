import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";

const TYPE_CHIP = {
  commercial:    "bg-brand-50 text-brand-700",
  residential:   "bg-purple-50 text-purple-700",
  industrial:    "bg-red-50 text-red-700",
  institutional: "bg-teal-50 text-teal-700",
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 1000 / 60 / 60);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ProjectDetailPage({ params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects").select("*").eq("id", params.id).single();
  if (!project) notFound();

  const { data: gc } = await supabase
    .from("profiles")
    .select("full_name, company_name, rating, total_reviews, jobs_completed")
    .eq("id", project.gc_id).single();

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  const { count: bidCount } = await supabase
    .from("bids").select("*", { count: "exact", head: true })
    .eq("project_id", project.id);

  const { data: existingBid } = await supabase
    .from("bids").select("id, amount, status")
    .eq("project_id", project.id).eq("ec_id", user.id).single();

  const chip = TYPE_CHIP[project.project_type] ?? TYPE_CHIP.commercial;
  const isOwner = user.id === project.gc_id;
  const isEC = profile?.role === "ec";

  const budgetLabel = project.budget_min && project.budget_max
    ? `$${Number(project.budget_min).toLocaleString()} – $${Number(project.budget_max).toLocaleString()}`
    : "Budget TBD";

  const stars = gc?.rating
    ? "★".repeat(Math.round(gc.rating)) + "☆".repeat(5 - Math.round(gc.rating))
    : "—";

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-8 py-8">
      <PageHeader
        title={project.title}
        subtitle={`${project.location} · Posted ${timeAgo(project.created_at)}`}
        action={<Link href="/browse" className="btn btn-ghost">← Back to browse</Link>}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Main card */}
          <div className="card p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Budget</p>
                <p className="text-3xl font-bold text-slate-900 tabular-nums mt-1">{budgetLabel}</p>
              </div>
              <span className={`chip capitalize ${chip}`}>{project.project_type}</span>
            </div>

            <div className="h-px bg-slate-100" />

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Scope of work</p>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{project.scope_of_work}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Bids"         value={bidCount ?? 0} />
              <Stat label="Deadline"     value={project.bid_deadline
                ? new Date(project.bid_deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "—"} />
              {project.square_footage && (
                <Stat label="Sq Ft" value={Number(project.square_footage).toLocaleString()} />
              )}
              {project.stories && (
                <Stat label="Stories" value={project.stories} />
              )}
            </div>

            {project.tags && project.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {project.tags.map((tag) => (
                  <span key={tag} className="chip bg-slate-100 text-slate-600">{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Posted by */}
          <div className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Posted by</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold">
                {gc?.company_name?.charAt(0) ?? gc?.full_name?.charAt(0) ?? "G"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">
                  {gc?.company_name ?? gc?.full_name ?? "General Contractor"}
                </p>
                {gc?.rating > 0 ? (
                  <p className="text-sm text-amber-600">
                    {stars} {gc.rating.toFixed(1)}
                    {gc.total_reviews > 0 && (
                      <span className="text-slate-500 font-normal"> ({gc.total_reviews} reviews)</span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">No reviews yet</p>
                )}
                {gc?.jobs_completed > 0 && (
                  <p className="text-xs text-slate-500">{gc.jobs_completed} projects completed</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: actions */}
        <aside className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            {existingBid && (
              <div className="card p-5 bg-green-50 border-green-100">
                <p className="text-sm font-semibold text-green-800">You&apos;ve already bid</p>
                <p className="text-sm text-green-700 mt-1">
                  <strong className="tabular-nums">${Number(existingBid.amount).toLocaleString()}</strong> ·{" "}
                  <span className="capitalize">{existingBid.status}</span>
                </p>
              </div>
            )}

            {isEC && !isOwner && project.status === "open" && !existingBid && (
              <div className="card p-5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Bid on this project</p>
                <Link
                  href={`/bid/${project.id}?mode=ai`}
                  className="btn btn-primary w-full"
                >
                  Get AI bid estimate
                </Link>
                <Link
                  href={`/bid/${project.id}?mode=manual`}
                  className="btn btn-secondary w-full"
                >
                  Place a manual bid
                </Link>
                <p className="text-xs text-slate-500 text-center pt-1">
                  Both options let you review before submitting.
                </p>
              </div>
            )}

            {isEC && !isOwner && project.status === "open" && !existingBid && (
              <div className="card p-5 bg-brand-50 border-brand-100">
                <p className="text-sm font-semibold text-brand-800">Have plans for this job?</p>
                <p className="text-sm text-brand-700 mt-1 leading-relaxed">
                  Run a full structured take-off with our estimator — it gives you a priced line-by-line estimate in minutes.
                </p>
                <Link href="/estimator" className="btn btn-ghost !px-0 text-brand-700 mt-2">
                  Open estimator →
                </Link>
              </div>
            )}

            {isOwner && (
              <div className="card p-5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Your listing</p>
                <Link
                  href={`/gc/bids/${project.id}`}
                  className="btn btn-primary w-full"
                >
                  Review bids ({bidCount ?? 0})
                </Link>
              </div>
            )}

            {!isOwner && project.status !== "open" && (
              <div className="card p-5 text-center">
                <p className="text-sm font-semibold text-slate-700">This project is no longer accepting bids</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-base font-semibold text-slate-900 mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}
