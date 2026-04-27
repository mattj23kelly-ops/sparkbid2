import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";

export default async function ContractorProfilePage({ params }) {
  const supabase = await createClient();

  const { data: contractor, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", params.id)
    .eq("role", "ec")
    .single();

  if (error || !contractor) notFound();

  const { data: reviews } = await supabase
    .from("reviews")
    .select(`*, reviewer:profiles!reviews_gc_id_fkey (full_name, company_name)`)
    .eq("ec_id", params.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const stars = (rating) =>
    "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));

  const initials = (contractor.company_name ?? contractor.full_name ?? "?")
    .split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const avgRating = reviews && reviews.length > 0
    ? reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length
    : contractor.rating;

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-8 py-8">
      <PageHeader
        title={contractor.company_name ?? contractor.full_name ?? "Contractor"}
        subtitle={contractor.location}
        action={<Link href="/browse" className="btn btn-ghost">← Back</Link>}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Hero */}
          <div className="card p-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xl font-bold shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold text-slate-900">
                  {contractor.company_name ?? contractor.full_name}
                </h1>
                {contractor.company_name && contractor.full_name && (
                  <p className="text-sm text-slate-500">{contractor.full_name}</p>
                )}
                {avgRating > 0 ? (
                  <p className="text-sm text-amber-600 mt-1">
                    {stars(avgRating)} <strong>{avgRating.toFixed(1)}</strong>
                    <span className="text-slate-500 font-normal"> ({contractor.total_reviews ?? reviews?.length ?? 0} reviews)</span>
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">No reviews yet</p>
                )}
                {contractor.license_number && (
                  <p className="mt-2">
                    <span className="chip bg-green-50 text-green-700">Licensed · #{contractor.license_number}</span>
                  </p>
                )}
              </div>
            </div>

            {contractor.bio && (
              <p className="text-sm text-slate-700 leading-relaxed mt-4 pt-4 border-t border-slate-100">
                {contractor.bio}
              </p>
            )}
          </div>

          {/* Reviews */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Reviews ({reviews?.length ?? 0})</h2>
            {reviews && reviews.length > 0 ? (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div key={review.id} className="card p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {review.reviewer?.company_name ?? review.reviewer?.full_name ?? "Anonymous"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(review.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </p>
                      </div>
                      {review.rating && (
                        <span className="text-sm text-amber-600 whitespace-nowrap">
                          {stars(review.rating)} <span className="text-slate-700">{review.rating}/5</span>
                        </span>
                      )}
                    </div>
                    {review.comment && (
                      <p className="text-sm text-slate-700 leading-relaxed">&ldquo;{review.comment}&rdquo;</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="card p-8 text-center">
                <p className="text-sm text-slate-600">No reviews yet.</p>
                <p className="text-xs text-slate-500 mt-1">Reviews appear after completed projects.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Jobs"    value={contractor.jobs_completed > 0 ? contractor.jobs_completed : "—"} />
            <Stat label="Win rate" value={contractor.win_rate ? `${contractor.win_rate}%` : "—"} />
            <Stat label="Reviews"  value={contractor.total_reviews ?? reviews?.length ?? 0} />
          </div>

          {contractor.specialties?.length > 0 && (
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Specialties</p>
              <div className="flex flex-wrap gap-2">
                {contractor.specialties.map((s) => (
                  <span key={s} className="chip bg-brand-50 text-brand-700">{s}</span>
                ))}
              </div>
            </div>
          )}

          {contractor.service_radius_miles > 0 && (
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Service area</p>
              <p className="text-sm text-slate-700">
                Up to {contractor.service_radius_miles} miles
                {contractor.location ? ` from ${contractor.location}` : ""}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card p-3 text-center">
      <p className="text-lg font-semibold text-slate-900 tabular-nums">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
