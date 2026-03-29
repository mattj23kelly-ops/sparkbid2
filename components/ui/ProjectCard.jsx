import Link from "next/link";

const TYPE_COLORS = {
  commercial:   { bg: "bg-blue-50",   text: "text-blue-600"  },
  residential:  { bg: "bg-purple-50", text: "text-purple-600"},
  industrial:   { bg: "bg-red-50",    text: "text-red-600"   },
  institutional:{ bg: "bg-teal-50",   text: "text-teal-600"  },
  urgent:       { bg: "bg-red-50",    text: "text-red-600"   },
};

export default function ProjectCard({ project }) {
  const colors = TYPE_COLORS[project.project_type] ?? TYPE_COLORS.commercial;
  const budgetLabel = project.budget_min && project.budget_max
    ? `$${(project.budget_min / 1000).toFixed(0)}K–$${(project.budget_max / 1000).toFixed(0)}K`
    : "Budget TBD";

  return (
    <Link href={`/project/${project.id}`}>
      <div className="bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-black text-slate-800 text-base leading-tight flex-1 pr-2">
            {project.title}
          </h3>
          <span className={`text-xs font-bold px-2 py-1 rounded-lg capitalize shrink-0 ${colors.bg} ${colors.text}`}>
            {project.project_type}
          </span>
        </div>
        <p className="text-slate-400 text-xs mb-3">📍 {project.location}</p>
        <div className="flex items-end justify-between">
          <span className="text-green-600 font-black text-xl">{budgetLabel}</span>
          <span className="text-slate-400 text-xs">
            {project.bid_count ?? 0} bids
          </span>
        </div>
      </div>
    </Link>
  );
}
