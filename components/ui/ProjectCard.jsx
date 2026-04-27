import Link from "next/link";

const TYPE_CHIP = {
  commercial:    "bg-brand-50 text-brand-700",
  residential:   "bg-purple-50 text-purple-700",
  industrial:    "bg-red-50 text-red-700",
  institutional: "bg-teal-50 text-teal-700",
};

export default function ProjectCard({ project }) {
  const chip = TYPE_CHIP[project.project_type] ?? TYPE_CHIP.commercial;
  const budgetLabel = project.budget_min && project.budget_max
    ? `$${(project.budget_min / 1000).toFixed(0)}k–$${(project.budget_max / 1000).toFixed(0)}k`
    : "Budget TBD";

  return (
    <Link
      href={`/project/${project.id}`}
      className="card p-5 hover:shadow-pop transition-shadow block"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-slate-900 leading-snug min-w-0 flex-1 truncate">
          {project.title}
        </h3>
        <span className={`chip capitalize shrink-0 ${chip}`}>
          {project.project_type}
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-4 truncate">{project.location}</p>
      <div className="flex items-end justify-between">
        <span className="text-lg font-semibold text-slate-900 tabular-nums">{budgetLabel}</span>
        <span className="text-xs text-slate-500">
          {project.bid_count ?? 0} bids
        </span>
      </div>
    </Link>
  );
}
