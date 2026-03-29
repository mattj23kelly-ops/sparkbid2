import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/ui/Header";
import NavBar from "@/components/ui/NavBar";
import ProjectCard from "@/components/ui/ProjectCard";

const FILTERS = ["All", "Commercial", "Residential", "Industrial", "Institutional"];

export default async function BrowsePage({ searchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const typeFilter = searchParams?.type?.toLowerCase();

  let query = supabase
    .from("projects")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (typeFilter && typeFilter !== "all") {
    query = query.eq("project_type", typeFilter);
  }

  const { data: projects } = await query;

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      <Header title="Browse Projects" />

      <div className="px-4 pt-4 space-y-4">
        {/* Search bar (visual — full search can be added later) */}
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 text-slate-400 text-sm">
          🔍 &nbsp;Search projects...
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
          {FILTERS.map((f) => {
            const value = f.toLowerCase();
            const isActive = (typeFilter ?? "all") === value;
            return (
              <a
                key={f}
                href={`/browse${value !== "all" ? `?type=${value}` : ""}`}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                  isActive
                    ? "bg-[#0F2B46] text-white"
                    : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"
                }`}
              >
                {f}
              </a>
            );
          })}
        </div>

        {/* Count + sort */}
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-sm font-semibold">
            {projects?.length ?? 0} projects
          </p>
          <span className="text-amber-500 text-sm font-bold cursor-pointer">Sort ↕</span>
        </div>

        {/* Project list */}
        {projects && projects.length > 0 ? (
          <div className="space-y-3">
            {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">🔍</p>
            <p className="font-black text-slate-700">No projects found</p>
            <p className="text-slate-400 text-sm mt-1">
              {typeFilter && typeFilter !== "all"
                ? `No ${typeFilter} projects right now. Try a different filter.`
                : "Check back soon — new jobs are posted daily."}
            </p>
          </div>
        )}
      </div>

      <NavBar role={profile?.role ?? "ec"} />
    </div>
  );
}
