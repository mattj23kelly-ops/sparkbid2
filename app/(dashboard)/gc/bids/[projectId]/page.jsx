import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AwardButton from "@/components/ui/AwardButton";
import PageHeader from "@/components/ui/PageHeader";

// AI picks the best bid based on price, rating, and experience
function getAiPick(bids) {
  if (!bids || bids.length === 0) return null;
  const maxAmount = Math.max(...bids.map(b => b.amount));
  const scored = bids.map((bid) => {
    const rating = bid.contractor?.rating ?? 0;
    const jobs   = bid.contractor?.jobs_completed ?? 0;
    const price  = bid.amount;
    const priceScore   = 1 - (price / maxAmount);
    const ratingScore  = rating / 5;
    const expScore     = Math.min(jobs / 50, 1);
    return { ...bid, aiScore: priceScore * 0.4 + ratingScore * 0.35 + expScore * 0.25 };
  });
  return scored.sort((a, b) => b.aiScore - a.aiScore)[0];
}

const STRATEGY_CHIP = {
  aggressive:   "bg-red-50 text-red-700",
  recommended:  "bg-green-50 text-green-700",
  conservative: "bg-brand-50 text-brand-700",
};

export default async function BidManagerPage({ params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects").select("*")
    .eq("id", params.projectId).eq("gc_id", user.id).single();
  if (!project) notFound();

  const { data: bids } = await supabase
    .from("bids")
    .select(`
      *,
      contractor:profiles!bids_ec_id_fkey (
        id, full_name, company_name, rating, total_reviews, jobs_completed,
        license_number, location, specialties
      )
    `)
    .eq("project_id", params.projectId)
    .order("amount", { ascending: true });

  const aiPick = getAiPick(bids);
  const isAwarded = project.status === "awarded";

  const stars = (rating) => rating
    ? "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating))
    : "";

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-8 py-8">
      <PageHeader
        title="Bid manager"
        subtitle={project.title}
        action={<Link href="/gc/projects" className="btn btn-ghost">← All projects</Link>}
      />

      {/* Project summary */}
      <div className="card p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">
            {project.location}
            {project.bid_deadline && ` · Deadline ${new Date(project.bid_deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className={`chip ${isAwarded ? "bg-green-50 text-green-700" : "bg-brand-50 text-brand-700"}`}>
              {isAwarded ? "Awarded" : "Open"}
            </span>
            <span className="text-sm text-slate-600">
              {bids?.length ?? 0} bid{bids?.length !== 1 ? "s" : ""} received
            </span>
          </div>
        </div>
        <p className="text-sm text-slate-500">
          Budget:{" "}
          <strong className="text-slate-900 tabular-nums">
            ${Number(project.budget_min).toLocaleString()} – ${Number(project.budget_max).toLocaleString()}
          </strong>
        </p>
      </div>

      {/* AI recommendation banner */}
      {aiPick && !isAwarded && (
        <div className="card p-4 bg-brand-50 border-brand-100 mb-4">
          <p className="text-sm font-semibold text-brand-800">AI recommendation</p>
          <p className="text-sm text-brand-700 mt-1">
            <strong>{aiPick.contractor?.company_name ?? aiPick.contractor?.full_name}</strong> offers the best overall value —
            competitive price
            {aiPick.contractor?.rating > 0 && `, ${aiPick.contractor.rating.toFixed(1)}★ rating`}
            {aiPick.contractor?.jobs_completed > 0 && `, ${aiPick.contractor.jobs_completed} completed jobs`}.
          </p>
        </div>
      )}

      {/* No bids */}
      {(!bids || bids.length === 0) && (
        <div className="card p-12 text-center">
          <h3 className="font-semibold text-slate-900">No bids yet</h3>
          <p className="text-sm text-slate-500 mt-1">Electricians will appear here once they submit bids.</p>
        </div>
      )}

      {/* Bid list */}
      <div className="space-y-4">
        {bids?.map((bid) => {
          const isAiPick = aiPick?.id === bid.id;
          const bidAwarded = bid.status === "awarded";
          const contractor = bid.contractor;
          const initials = (contractor?.company_name ?? contractor?.full_name ?? "?")
            .split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

          return (
            <div
              key={bid.id}
              className={`card p-5 ${
                bidAwarded ? "border-green-300" : isAiPick ? "border-brand-300" : ""
              }`}
            >
              {/* Badges */}
              <div className="flex gap-2 mb-3">
                {isAiPick && !bidAwarded && (
                  <span className="chip bg-brand-100 text-brand-700">AI pick</span>
                )}
                {bidAwarded && <span className="chip bg-green-100 text-green-700">Awarded</span>}
                {bid.strategy && (
                  <span className={`chip capitalize ${STRATEGY_CHIP[bid.strategy] ?? "bg-slate-100 text-slate-600"}`}>
                    {bid.strategy}
                  </span>
                )}
              </div>

              {/* Contractor + amount */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <Link href={`/contractor/${contractor?.id}`} className="flex items-center gap-3 min-w-0 flex-1 group">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate group-hover:text-brand-600">
                      {contractor?.company_name ?? contractor?.full_name ?? "Unknown"}
                    </p>
                    {contractor?.rating > 0 ? (
                      <p className="text-xs text-amber-600">
                        {stars(contractor.rating)} {contractor.rating.toFixed(1)}
                        <span className="text-slate-500"> ({contractor.total_reviews ?? 0} reviews)</span>
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">No reviews yet</p>
                    )}
                    {contractor?.jobs_completed > 0 && (
                      <p className="text-xs text-slate-500">{contractor.jobs_completed} jobs completed</p>
                    )}
                  </div>
                </Link>

                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">
                    ${bid.amount.toLocaleString()}
                  </p>
                  {project.budget_max && (
                    <p className="text-xs text-slate-500">
                      {bid.amount <= project.budget_max ? "Within budget" : "Over budget"}
                    </p>
                  )}
                </div>
              </div>

              {/* Cost breakdown */}
              {bid.materials_cost && (
                <div className="bg-slate-50 rounded-lg p-3 mb-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {[
                    { label: "Materials", value: bid.materials_cost },
                    { label: "Labor",     value: bid.labor_cost     },
                    { label: "Overhead",  value: bid.overhead_cost  },
                    { label: "Profit",    value: bid.amount - bid.materials_cost - bid.labor_cost - bid.overhead_cost },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-xs text-slate-500">{item.label}</p>
                      <p className="font-medium text-slate-900 tabular-nums">${Math.round(item.value).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* AI confidence */}
              {bid.ai_confidence && (
                <div className="flex gap-3 mb-3">
                  <div className="flex-1 bg-green-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-slate-500">AI confidence</p>
                    <p className="text-sm font-semibold text-green-700 tabular-nums">{bid.ai_confidence}%</p>
                  </div>
                  <div className="flex-1 bg-brand-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-slate-500">Win chance</p>
                    <p className="text-sm font-semibold text-brand-700 tabular-nums">{bid.ai_win_chance}%</p>
                  </div>
                </div>
              )}

              {/* Cover note */}
              {bid.cover_note && (
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Cover note</p>
                  <p className="text-sm text-slate-700 italic leading-relaxed">&ldquo;{bid.cover_note}&rdquo;</p>
                </div>
              )}

              {/* Meta chips */}
              <div className="flex flex-wrap gap-2 mb-4">
                {contractor?.license_number && (
                  <span className="chip bg-slate-100 text-slate-600">License {contractor.license_number}</span>
                )}
                {contractor?.location && (
                  <span className="chip bg-slate-100 text-slate-600">{contractor.location}</span>
                )}
                {contractor?.specialties?.slice(0, 2).map(s => (
                  <span key={s} className="chip bg-brand-50 text-brand-700">{s}</span>
                ))}
              </div>

              {/* Action */}
              {!bidAwarded && !isAwarded && (
                <AwardButton
                  bidId={bid.id}
                  projectId={project.id}
                  contractorName={contractor?.company_name ?? contractor?.full_name ?? "this contractor"}
                  amount={bid.amount}
                />
              )}

              {bidAwarded && (
                <div className="chip bg-green-50 text-green-700 w-full text-center !py-2.5">
                  Job awarded to this contractor
                </div>
              )}

              <p className="text-xs text-slate-400 mt-2 text-right">
                Submitted {new Date(bid.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
          );
        })}
      </div>

      {/* Awarded banner */}
      {isAwarded && (
        <div className="card p-5 bg-green-50 border-green-100 text-center mt-6">
          <p className="font-semibold text-green-800">Job has been awarded</p>
          <p className="text-sm text-green-700 mt-1">This project is no longer accepting new bids.</p>
        </div>
      )}
    </div>
  );
}
