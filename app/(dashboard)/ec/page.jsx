import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/ui/Header";
import NavBar from "@/components/ui/NavBar";
import ProjectCard from "@/components/ui/ProjectCard";

export default async function ECDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Fetch this EC's active bids with project info
  const { data: bids } = await supabase
    .from("bids")
    .select("*, project:projects(title, location, budget_min, budget_max)")
    .eq("ec_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  // Fetch recommended open projects (most recent)
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(4);

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const activeBids = bids?.filter(b => ["submitted", "winning", "outbid"].includes(b.status)) ?? [];
  const winningBids = activeBids.filter(b => b.status === "winning");

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      <Header title="SparkBid" />

      <div className="px-4 pt-4 space-y-5">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-black text-slate-800">Welcome back, {firstName} 👋</h2>
          <p className="text-slate-400 text-sm">
            {activeBids.length} active bid{activeBids.length !== 1 ? "s" : ""}
            {winningBids.length > 0 && ` · ${winningBids.length} winning`}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Active Bids",  value: activeBids.length,   color: "text-blue-500"  },
            { label: "Winning",      value: winningBids.length,  color: "text-green-500" },
            { label: "Win Rate",     value: `${profile?.win_rate ?? 0}%`, color: "text-amber-500" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-4 text-center">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-400 font-semibold mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* AI Insight banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-amber-800 font-bold text-sm">🤖 AI Insight</p>
          <p className="text-amber-700 text-sm mt-0.5">
            {projects?.length ?? 0} new project{projects?.length !== 1 ? "s" : ""} in your area match your specialties.
          </p>
        </div>

        {/* Recommended projects */}
        {projects && projects.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-slate-800">🔥 Recommended For You</h3>
              <Link href="/browse" className="text-amber-500 text-sm font-bold">See all</Link>
            </div>
            <div className="space-y-3">
              {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
            </div>
          </div>
        )}

        {/* Active Bids */}
        {activeBids.length > 0 && (
          <div>
            <h3 className="font-black text-slate-800 mb-3">📋 Your Active Bids</h3>
            <div className="space-y-3">
              {activeBids.map((bid) => (
                <div key={bid.id} className="bg-white rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-black text-slate-800 text-sm">{bid.project?.title}</span>
                    <span className="font-black text-slate-800">${bid.amount?.toLocaleString()}</span>
                  </div>
                  <p className="text-slate-400 text-xs mb-2">📍 {bid.project?.location}</p>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                    bid.status === "winning"
                      ? "bg-green-50 text-green-600"
                      : bid.status === "outbid"
                      ? "bg-red-50 text-red-600"
                      : "bg-blue-50 text-blue-600"
                  }`}>
                    {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {activeBids.length === 0 && (!projects || projects.length === 0) && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">⚡</p>
            <p className="font-black text-slate-700 text-lg">No projects yet</p>
            <p className="text-slate-400 text-sm mt-1 mb-6">Browse open projects to place your first bid</p>
            <Link
              href="/browse"
              className="bg-amber-400 text-[#0F2B46] font-bold px-6 py-3 rounded-xl inline-block hover:bg-amber-300 transition-colors"
            >
              Browse Projects
            </Link>
          </div>
        )}
      </div>

      <NavBar role="ec" />
    </div>
  );
}
