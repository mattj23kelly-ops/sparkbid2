import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProjectCard from "@/components/ui/ProjectCard";
import PageHeader from "@/components/ui/PageHeader";

const FILTERS = ["all", "commercial", "residential", "industrial", "institutional"];

export default async function BrowsePage({ searchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
    <div className="max-w-6xl mx-auto px-6 md:px-8 py-8">
      <PageHeader
        title="Browse projects"
        subtitle="Open jobs posted by general contractors."
      />

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none mb-4">
        {FILTERS.map((f) => {
          const isActive = (typeFilter ?? "all") === f;
          return (
            <Link
              key={f}
              href={`/browse${f !== "all" ? `?type=${f}` : ""}`}
              className={`chip capitalize shrink-0 transition-colors ${
                isActive
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}
            >
              {f}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          {projects?.length ?? 0} {projects?.length === 1 ? "project" : "projects"}
        </p>
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <h3 className="font-semibold text-slate-900">No projects found</h3>
          <p className="text-sm text-slate-500 mt-1">
            {typeFilter && typeFilter !== "all"
              ? `No ${typeFilter} projects right now. Try a different filter.`
              : "Check back soon — new jobs are posted daily."}
          </p>
        </div>
      )}
    </div>
  );
}
