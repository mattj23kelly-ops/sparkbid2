import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/ui/Header";
import NavBar from "@/components/ui/NavBar";

const STATUS_CONFIG = {
  submitted: { bg: "bg-blue-50",   text: "text-blue-600",  label: "Submitted", icon: "📤" },
  winning:   { bg: "bg-green-50",  text: "text-green-600", label: "Winning",   icon: "🏆" },
  outbid:    { bg: "bg-red-50",    text: "text-red-500",   label: "Outbid",    icon: "📉" },
  awarded:   { bg: "bg-green-50",  text: "text-green-700", label: "Awarded!",  icon: "✅" },
  declined:  { bg: "bg-slate-100", text: "text-slate-500", label: "Declined",  icon: "✗"  },
};

export default async function MyBidsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: bids } = await supabase
    .from("bids")
    .select(`
      *,
      project:projects (
        id, title, location, budget_min, budget_max,
        bid_deadline, project_type, status
      )
    `)
    .eq("ec_id", user.id)
    .order("created_at", { ascending: false });

  const active   = bids?.filter(b => ["submitted", "winning"].includes(b.status)) ?? [];
  const awarded  = bids?.filter(b => b.status === "awarded") ?? [];
  const past     = bids?.filter(b => ["outbid", "declined"].includes(b.status)) ?? [];

  const winRate = bids?.length
    ? Math.round((awarded.length / bids.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-slate-100 pb-28">
      <Header title="My Bids" />

      <div className="px-4 pt-4 max-w-lg mx-auto space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Bids", value: bids?.length ?? 0,  color: "text-blue-500"  },
            { label: "Active",     value: active.length,       color: "text-amber-500" },
            { label: "Win Rate",   value: `${winRate}%`,       color: "text-green-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-4 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {(!bids || bids.length === 0) && (
          <div className="text-center py-16 bg-white rounded-2xl">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-black text-slate-700">No bids yet</p>
            <p className="text-slate-400 text-sm mt-1 mb-6">
              Browse open projects and submit your first bid
            </p>
            <Link
              href="/browse"
              className="bg-amber-400 text-[#0F2B46] font-bold px-6 py-3 rounded-xl inline-block hover:bg-amber-300 transition-colors"
            >
              Browse Projects
            </Link>
          </div>
        )}

        {/* Active Bids */}
        {active.length > 0 && (
          <div>
            <h3 className="font-black text-slate-800 mb-3">📤 Active Bids</h3>
            <div className="space-y-3">
              {active.map((bid) => <BidCard key={bid.id} bid={bid} />)}
            </div>
          </div>
        )}

        {/* Awarded */}
        {awarded.length > 0 && (
          <div>
            <h3 className="font-black text-slate-800 mb-3">✅ Awarded Jobs</h3>
            <div className="space-y-3">
              {awarded.map((bid) => <BidCard key={bid.id} bid={bid} />)}
            </div>
          </div>
        )}

        {/* Past / Lost */}
        {past.length > 0 && (
          <div>
            <h3 className="font-black text-slate-800 mb-3">📁 Past Bids</h3>
            <div className="space-y-3">
              {past.map((bid) => <BidCard key={bid.id} bid={bid} />)}
            </div>
          </div>
        )}
      </div>

      <NavBar role="ec" />
    </div>
  );
}

function BidCard({ bid }) {
  const config = STATUS_CONFIG[bid.status] ?? STATUS_CONFIG.submitted;
  const project = bid.project;

  const budgetLabel = project?.budget_min && project?.budget_max
    ? `$${(project.budget_min / 1000).toFixed(0)}K–$${(project.budget_max / 1000).toFixed(0)}K`
    : null;

  return (
    <Link href={`/project/${project?.id}`}>
      <div className="bg-white rounded-2xl p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-1">
          <h4 className="font-black text-slate-800 text-sm leading-tight flex-1 pr-3">
            {project?.title ?? "Project"}
          </h4>
          <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${config.bg} ${config.text}`}>
            {config.icon} {config.label}
          </span>
        </div>

        {project?.location && (
          <p className="text-slate-400 text-xs mb-3">📍 {project.location}</p>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold">YOUR BID</p>
            <p className="font-black text-slate-800 text-lg">${bid.amount.toLocaleString()}</p>
          </div>
          {budgetLabel && (
            <div className="text-right">
              <p className="text-xs text-slate-400 font-semibold">BUDGET</p>
              <p className="font-bold text-green-600 text-sm">{budgetLabel}</p>
            </div>
          )}
        </div>

        {/* AI data if present */}
        {bid.ai_confidence && (
          <div className="flex gap-2 mt-3">
            <span className="text-xs bg-amber-50 text-amber-700 font-bold px-2 py-1 rounded-lg">
              🤖 {bid.ai_confidence}% confident
            </span>
            {bid.strategy && (
              <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-2 py-1 rounded-lg capitalize">
                {bid.strategy}
              </span>
            )}
          </div>
        )}

        <p className="text-xs text-slate-300 mt-2">
          Submitted {new Date(bid.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      </div>
    </Link>
  );
}
