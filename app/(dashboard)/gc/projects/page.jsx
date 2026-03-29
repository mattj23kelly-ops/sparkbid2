import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/ui/Header";
import NavBar from "@/components/ui/NavBar";

const STATUS_STYLES = {
  open:    { bg: "bg-blue-50",   text: "text-blue-600",  label: "Open"    },
  awarded: { bg: "bg-green-50",  text: "text-green-600", label: "Awarded" },
  closed:  { bg: "bg-slate-100", text: "text-slate-500", label: "Closed"  },
  draft:   { bg: "bg-amber-50",  text: "text-amber-600", label: "Draft"   },
};

export default async function GCProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("gc_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      <Header title="My Projects" />

      <div className="px-4 pt-4 space-y-4">
        <Link
          href="/gc/post"
          className="block w-full bg-amber-400 text-[#0F2B46] font-black text-center py-4 rounded-2xl hover:bg-amber-300 transition-colors"
        >
          + Post a New Project
        </Link>

        {projects && projects.length > 0 ? (
          <div className="space-y-3">
            {projects.map((project) => {
              const style = STATUS_STYLES[project.status] ?? STATUS_STYLES.open;
              return (
                <div key={project.id} className="bg-white rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-black text-slate-800 text-sm flex-1 pr-2">{project.title}</h3>
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs mb-3">
                    📍 {project.location}
                    {project.bid_deadline && ` · Deadline ${new Date(project.bid_deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                  </p>
                  <p className="text-green-600 font-black">
                    ${Number(project.budget_min).toLocaleString()} – ${Number(project.budget_max).toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">📋</p>
            <p className="font-black text-slate-700">No projects yet</p>
            <p className="text-slate-400 text-sm mt-1">Post your first project to start receiving bids</p>
          </div>
        )}
      </div>

      <NavBar role="gc" />
    </div>
  );
}
