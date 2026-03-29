import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/ui/Header";
import NavBar from "@/components/ui/NavBar";
import AwardButton from "@/components/ui/AwardButton";

// AI picks the best bid based on price, rating, and experience
function getAiPick(bids) {
  if (!bids || bids.length === 0) return null;

  const scored = bids.map((bid) => {
    const rating = bid.contractor?.rating ?? 0;
    const jobs   = bid.contractor?.jobs_completed ?? 0;
    const price  = bid.amount;

    // Score: lower price is better, higher rating/jobs are better
    // Normalize: price penalty, rating bonus, experience bonus
    const priceScore   = 1 - (price / Math.max(...bids.map(b => b.amount)));
    const ratingScore  = rating / 5;
    const expScore     = Math.min(jobs / 50, 1);

    return { ...bid, aiScore: priceScore * 0.4 + ratingScore * 0.35 + expScore * 0.25 };
  });

  return scored.sort((a, b) => b.aiScore - a.aiScore)[0];
}

const STRATEGY_COLORS = {
  aggressive:   { bg: "bg-red-50",   text: "text-red-600"   },
  recommended:  { bg: "bg-green-50", text: "text-green-600" },
  conservative: { bg: "bg-blue-50",  text: "text-blue-600"  },
};

export default async function BidManagerPage({ params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch project and verify ownership
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.projectId)
    .eq("gc_id", user.id)
    .single();

  if (!project) notFound();

  // Fetch all bids with contractor profile info
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

  const stars = (rating) => rating
    ? "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating))
    : "No rating yet";

  const isAwarded = project.status === "awarded";

  return (
    <div className="min-h-screen bg-slate-100 pb-28">
      <Header title="Bid Manager" showBack />

      <div className="px-4 pt-4 max-w-lg mx-auto space-y-4">

        {/* Project summary */}
        <div className="bg-white rounded-2xl p-4">
          <h2 className="font-black text-slate-800 text-base leading-tight">{project.title}</h2>
          <p className="text-slate-400 text-xs mt-0.5">
            📍 {project.location}
            {project.bid_deadline && ` · Deadline ${new Date(project.bid_deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
              isAwarded ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"
            }`}>
              {isAwarded ? "✅ Awarded" : "🟢 Open"}
            </span>
            <span className="text-slate-500 text-sm font-semibold">
              {bids?.length ?? 0} bid{bids?.length !== 1 ? "s" : ""} received
            </span>
          </div>
        </div>

        {/* No bids yet */}
        {(!bids || bids.length === 0) && (
          <div className="text-center py-16 bg-white rounded-2xl">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-black text-slate-700">No bids yet</p>
            <p className="text-slate-400 text-sm mt-1">
              Electricians will appear here once they submit bids
            </p>
          </div>
        )}

        {/* AI Recommendation banner */}
        {aiPick && !isAwarded && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-amber-800 font-black text-sm mb-1">🤖 AI Recommendation</p>
            <p className="text-amber-700 text-sm">
              <strong>{aiPick.contractor?.company_name ?? aiPick.contractor?.full_name}</strong> offers
              the best overall value — competitive price
              {aiPick.contractor?.rating > 0 && `, ${aiPick.contractor.rating.toFixed(1)}★ rating`}
              {aiPick.contractor?.jobs_completed > 0 && `, and ${aiPick.contractor.jobs_completed} completed jobs`}.
            </p>
          </div>
        )}

        {/* Sort bar */}
        {bids && bids.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold">Sorted by: lowest price</span>
          </div>
        )}

        {/* Bid cards */}
        {bids?.map((bid) => {
          const isAiPick = aiPick?.id === bid.id;
          const isAwarded = bid.status === "awarded";
          const strategyStyle = STRATEGY_COLORS[bid.strategy] ?? STRATEGY_COLORS.recommended;
          const contractor = bid.contractor;

          return (
            <div
              key={bid.id}
              className={`bg-white rounded-2xl p-5 border-2 transition-all ${
                isAwarded
                  ? "border-green-400"
                  : isAiPick
                  ? "border-amber-300"
                  : "border-transparent"
              }`}
            >
              {/* Badges row */}
              <div className="flex gap-2 mb-3">
                {isAiPick && !isAwarded && (
                  <span className="text-xs font-black px-2 py-1 rounded-lg bg-amber-100 text-amber-700">
                    🤖 AI Pick
                  </span>
                )}
                {isAwarded && (
                  <span className="text-xs font-black px-2 py-1 rounded-lg bg-green-100 text-green-700">
                    ✅ Awarded
                  </span>
                )}
                {bid.strategy && (
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg capitalize ${strategyStyle.bg} ${strategyStyle.text}`}>
                    {bid.strategy}
                  </span>
                )}
              </div>

              {/* Contractor info */}
              <div className="flex items-start justify-between mb-3">
                <Link
                  href={`/contractor/${contractor?.id}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#0F2B46] flex items-center justify-center shrink-0">
                    <span className="text-amber-400 font-black text-sm">
                      {(contractor?.company_name ?? contractor?.full_name ?? "?")
                        .split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="font-black text-slate-800 text-sm underline underline-offset-2 decoration-slate-300">
                      {contractor?.company_name ?? contractor?.full_name ?? "Unknown"}
                    </p>
                    {contractor?.rating > 0 ? (
                      <p className="text-amber-500 text-xs">
                        {stars(contractor.rating)} {contractor.rating.toFixed(1)}
                        <span className="text-slate-400"> ({contractor.total_reviews})</span>
                      </p>
                    ) : (
                      <p className="text-slate-400 text-xs">No reviews yet</p>
                    )}
                    {contractor?.jobs_completed > 0 && (
                      <p className="text-slate-400 text-xs">{contractor.jobs_completed} jobs completed</p>
                    )}
                  </div>
                </Link>

                {/* Bid amount */}
                <div className="text-right">
                  <p className="font-black text-green-600 text-2xl">
                    ${bid.amount.toLocaleString()}
                  </p>
                  {project.budget_max && (
                    <p className="text-slate-400 text-xs">
                      {bid.amount <= project.budget_max ? "Within budget" : "Over budget"}
                    </p>
                  )}
                </div>
              </div>

              {/* Cost breakdown if AI-generated */}
              {bid.materials_cost && (
                <div className="bg-slate-50 rounded-xl p-3 mb-3">
                  <p className="text-xs font-black text-slate-400 mb-2">COST BREAKDOWN</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {[
                      { label: "Materials", value: bid.materials_cost },
                      { label: "Labor",     value: bid.labor_cost     },
                      { label: "Overhead",  value: bid.overhead_cost  },
                      { label: "Profit",    value: bid.amount - bid.materials_cost - bid.labor_cost - bid.overhead_cost },
                    ].map((item) => (
                      <div key={item.label} className="flex justify-between text-xs">
                        <span className="text-slate-500">{item.label}</span>
                        <span className="font-bold text-slate-700">${Math.round(item.value).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI confidence if available */}
              {bid.ai_confidence && (
                <div className="flex gap-3 mb-3">
                  <div className="flex-1 bg-green-50 rounded-xl p-2 text-center">
                    <p className="text-green-600 font-black text-sm">{bid.ai_confidence}%</p>
                    <p className="text-xs text-slate-400">AI confidence</p>
                  </div>
                  <div className="flex-1 bg-blue-50 rounded-xl p-2 text-center">
                    <p className="text-blue-500 font-black text-sm">{bid.ai_win_chance}%</p>
                    <p className="text-xs text-slate-400">Win chance</p>
                  </div>
                </div>
              )}

              {/* Cover note */}
              {bid.cover_note && (
                <div className="mb-3">
                  <p className="text-xs font-black text-slate-400 mb-1">COVER NOTE</p>
                  <p className="text-slate-600 text-sm italic leading-relaxed">
                    &quot;{bid.cover_note}&quot;
                  </p>
                </div>
              )}

              {/* Contractor details */}
              <div className="flex flex-wrap gap-2 mb-4">
                {contractor?.license_number && (
                  <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-2 py-1 rounded-lg">
                    🪪 {contractor.license_number}
                  </span>
                )}
                {contractor?.location && (
                  <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-2 py-1 rounded-lg">
                    📍 {contractor.location}
                  </span>
                )}
                {contractor?.specialties?.slice(0, 2).map(s => (
                  <span key={s} className="text-xs bg-blue-50 text-blue-600 font-semibold px-2 py-1 rounded-lg">
                    {s}
                  </span>
                ))}
              </div>

              {/* Award button — client component */}
              {!project.status === "awarded" || bid.status === "awarded" ? null : null}
              {bid.status !== "awarded" && project.status !== "awarded" && (
                <AwardButton
                  bidId={bid.id}
                  projectId={project.id}
                  contractorName={contractor?.company_name ?? contractor?.full_name ?? "this contractor"}
                  amount={bid.amount}
                />
              )}

              {bid.status === "awarded" && (
                <div className="w-full bg-green-50 text-green-700 font-black py-3 rounded-xl text-center text-sm">
                  ✅ Job Awarded to This Contractor
                </div>
              )}

              <p className="text-xs text-slate-300 mt-2 text-right">
                Submitted {new Date(bid.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
          );
        })}

        {/* Already awarded notice */}
        {isAwarded && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <p className="text-green-800 font-black">🎉 Job has been awarded</p>
            <p className="text-green-700 text-sm mt-1">
              This project is no longer accepting new bids.
            </p>
          </div>
        )}

      </div>

      <NavBar role="gc" />
    </div>
  );
}
