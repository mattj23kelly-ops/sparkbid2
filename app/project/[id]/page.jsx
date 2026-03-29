import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/ui/Header";

const TYPE_COLORS = {
  commercial:    { bg: "bg-blue-50",    text: "text-blue-600"   },
  residential:   { bg: "bg-purple-50",  text: "text-purple-600" },
  industrial:    { bg: "bg-red-50",     text: "text-red-600"    },
  institutional: { bg: "bg-teal-50",    text: "text-teal-600"   },
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

  // Fetch project
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!project) notFound();

  // Fetch GC profile
  const { data: gc } = await supabase
    .from("profiles")
    .select("full_name, company_name, rating, total_reviews, jobs_completed")
    .eq("id", project.gc_id)
    .single();

  // Fetch current user's role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Count bids
  const { count: bidCount } = await supabase
    .from("bids")
    .select("*", { count: "exact", head: true })
    .eq("project_id", project.id);

  // Check if this EC already submitted a bid
  const { data: existingBid } = await supabase
    .from("bids")
    .select("id, amount, status")
    .eq("project_id", project.id)
    .eq("ec_id", user.id)
    .single();

  const colors = TYPE_COLORS[project.project_type] ?? TYPE_COLORS.commercial;
  const isOwner = user.id === project.gc_id;
  const isEC = profile?.role === "ec";

  const budgetLabel = project.budget_min && project.budget_max
    ? `$${Number(project.budget_min).toLocaleString()} – $${Number(project.budget_max).toLocaleString()}`
    : "Budget TBD";

  const stars = gc?.rating
    ? "★".repeat(Math.round(gc.rating)) + "☆".repeat(5 - Math.round(gc.rating))
    : "—";

  return (
    <div className="min-h-screen bg-slate-100 pb-32">
      <Header title="Project Detail" showBack />

      <div className="px-4 pt-4 max-w-lg mx-auto space-y-4">

        {/* ── Main project card ── */}
        <div className="bg-white rounded-2xl p-5 space-y-4">

          {/* Title + type badge */}
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-black text-slate-800 text-xl leading-tight flex-1">
              {project.title}
            </h1>
            <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg capitalize ${colors.bg} ${colors.text}`}>
              {project.project_type}
            </span>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-slate-400 font-medium">
            <span>📍 {project.location}</span>
            <span>🕐 {timeAgo(project.created_at)}</span>
          </div>

          {/* Budget */}
          <p className="text-green-600 font-black text-3xl">{budgetLabel}</p>

          <div className="h-px bg-slate-100" />

          {/* Scope of work */}
          <div>
            <p className="text-xs font-black text-slate-400 mb-2 tracking-wide">SCOPE OF WORK</p>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-slate-600 text-sm leading-relaxed">{project.scope_of_work}</p>
            </div>
          </div>

          {/* Specs grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Bids Received",  value: bidCount ?? 0 },
              { label: "Bid Deadline",   value: project.bid_deadline
                  ? new Date(project.bid_deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : "—" },
              ...(project.square_footage
                ? [{ label: "Sq Footage", value: Number(project.square_footage).toLocaleString() }]
                : []),
              ...(project.stories
                ? [{ label: "Stories", value: project.stories }]
                : []),
            ].map((s) => (
              <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="font-black text-slate-800 text-lg">{s.value}</p>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-600 rounded-lg"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Posted by (GC info) ── */}
        <div className="bg-white rounded-2xl p-5">
          <p className="text-xs font-black text-slate-400 mb-3 tracking-wide">POSTED BY</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#0F2B46] flex items-center justify-center text-amber-400 font-black text-lg">
              {gc?.company_name?.charAt(0) ?? gc?.full_name?.charAt(0) ?? "G"}
            </div>
            <div className="flex-1">
              <p className="font-black text-slate-800">{gc?.company_name ?? gc?.full_name ?? "General Contractor"}</p>
              {gc?.rating > 0 && (
                <p className="text-amber-500 text-sm font-semibold">
                  {stars} {gc.rating.toFixed(1)}
                  {gc.total_reviews > 0 && (
                    <span className="text-slate-400 font-normal"> ({gc.total_reviews} reviews)</span>
                  )}
                </p>
              )}
              {gc?.jobs_completed > 0 && (
                <p className="text-slate-400 text-xs">{gc.jobs_completed} projects completed</p>
              )}
            </div>
          </div>
        </div>

        {/* ── AI Market Analysis teaser ── */}
        {isEC && !isOwner && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-amber-800 font-bold text-sm mb-1">🤖 AI Market Analysis Available</p>
            <p className="text-amber-700 text-sm">
              Get competitor price range, GC insights &amp; a winning bid strategy — included in the AI Bid tool below.
            </p>
          </div>
        )}

        {/* ── Already bid banner ── */}
        {existingBid && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-green-800 font-bold text-sm">✅ You&apos;ve already bid on this project</p>
              <p className="text-green-700 text-sm">
                Your bid: <strong>${Number(existingBid.amount).toLocaleString()}</strong> ·{" "}
                <span className="capitalize">{existingBid.status}</span>
              </p>
            </div>
          </div>
        )}

        {/* ── CTA Buttons (EC only, not owner, project open) ── */}
        {isEC && !isOwner && project.status === "open" && !existingBid && (
          <div className="space-y-3">
            <Link
              href={`/bid/${project.id}?mode=ai`}
              className="flex items-center justify-center gap-2 w-full bg-amber-400 text-[#0F2B46] font-black py-4 rounded-2xl hover:bg-amber-300 transition-colors text-base"
            >
              🤖 Get AI Bid Estimate
            </Link>
            <Link
              href={`/bid/${project.id}?mode=manual`}
              className="flex items-center justify-center w-full bg-[#0F2B46] text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-colors text-base"
            >
              Place a Manual Bid
            </Link>
            <p className="text-center text-xs text-slate-400">Both options let you review before submitting</p>
          </div>
        )}

        {/* ── GC owner view ── */}
        {isOwner && (
          <div className="space-y-3">
            <Link
              href={`/gc/bids/${project.id}`}
              className="flex items-center justify-center w-full bg-blue-500 text-white font-black py-4 rounded-2xl hover:bg-blue-600 transition-colors text-base"
            >
              📊 Review Bids ({bidCount ?? 0})
            </Link>
            <p className="text-center text-slate-400 text-sm">This is your project listing</p>
          </div>
        )}

        {/* ── Project closed ── */}
        {!isOwner && project.status !== "open" && (
          <div className="bg-slate-100 rounded-2xl p-4 text-center">
            <p className="text-slate-500 font-bold">This project is no longer accepting bids</p>
          </div>
        )}

      </div>
    </div>
  );
}
