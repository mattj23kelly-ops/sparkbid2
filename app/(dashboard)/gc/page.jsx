import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/ui/Header";
import NavBar from "@/components/ui/NavBar";

export default async function GCDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Fetch this GC's projects
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("gc_id", user.id)
    .order("created_at", { ascending: false });

  const openProjects = projects?.filter(p => p.status === "open") ?? [];
  const awardedProjects = projects?.filter(p => p.status === "awarded") ?? [];

  // Count bids per project
  const projectIds = openProjects.map(p => p.id);
  const { data: bidCounts } = projectIds.length > 0
    ? await supabase
        .from("bids")
        .select("project_id")
        .in("project_id", projectIds)
    : { data: [] };

  const countMap = {};
  bidCounts?.forEach(b => {
    countMap[b.project_id] = (countMap[b.project_id] ?? 0) + 1;
  });

  const totalBids = Object.values(countMap).reduce((a, b) => a + b, 0);
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      <Header title="SparkBid" />

      <div className="px-4 pt-4 space-y-5">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-black text-slate-800">Welcome back, {firstName} 👋</h2>
          <p className="text-slate-400 text-sm">{profile?.company_name}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Active Projects", value: openProjects.length,   color: "text-blue-500"  },
            { label: "Total Bids",      value: totalBids,             color: "text-amber-500" },
            { label: "Awarded",         value: awardedProjects.length, color: "text-green-500" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-4 text-center">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-400 font-semibold mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Post Project CTA */}
        <Link
          href="/gc/post"
          className="block w-full bg-amber-400 text-[#0F2B46] font-black text-center py-4 rounded-2xl text-base hover:bg-amber-300 transition-colors"
        >
          + Post a New Project
        </Link>

        {/* Active Projects */}
        {openProjects.length > 0 && (
          <div>
            <h3 className="font-black text-slate-800 mb-3">📋 Your Active Projects</h3>
            <div className="space-y-3">
              {openProjects.map((project) => {
                const bidCount = countMap[project.id] ?? 0;
                const isUrgent = project.bid_deadline &&
                  new Date(project.bid_deadline) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

                return (
                  <div key={project.id} className="bg-white rounded-2xl p-4">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-black text-slate-800 text-sm flex-1 pr-2">{project.title}</h4>
                      {isUrgent && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-red-50 text-red-600 shrink-0">
                          URGENT
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs mb-3">
                      📍 {project.location}
                      {project.bid_deadline && ` · Due ${new Date(project.bid_deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-blue-500 text-sm font-bold">
                        {bidCount} bid{bidCount !== 1 ? "s" : ""} received
                      </span>
                      {bidCount > 0 && (
                        <Link
                          href={`/gc/bids/${project.id}`}
                          className="bg-blue-50 text-blue-600 font-bold text-sm px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors"
                        >
                          Review Bids
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recently Awarded */}
        {awardedProjects.length > 0 && (
          <div>
            <h3 className="font-black text-slate-800 mb-3">✅ Recently Awarded</h3>
            <div className="space-y-3">
              {awardedProjects.slice(0, 3).map((project) => (
                <div key={project.id} className="bg-white rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-black text-slate-800 text-sm">{project.title}</p>
                    <p className="text-slate-400 text-xs">📍 {project.location}</p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-lg bg-green-50 text-green-600">
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {openProjects.length === 0 && awardedProjects.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🏗️</p>
            <p className="font-black text-slate-700 text-lg">No projects yet</p>
            <p className="text-slate-400 text-sm mt-1 mb-6">Post your first project to start receiving bids</p>
            <Link
              href="/gc/post"
              className="bg-amber-400 text-[#0F2B46] font-bold px-6 py-3 rounded-xl inline-block hover:bg-amber-300 transition-colors"
            >
              Post a Project
            </Link>
          </div>
        )}
      </div>

      <NavBar role="gc" />
    </div>
  );
}
