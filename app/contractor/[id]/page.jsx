import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/ui/Header";
import NavBar from "@/components/ui/NavBar";

export default async function ContractorProfilePage({ params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get current user role for NavBar
  let currentRole = "gc";
  if (user) {
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    currentRole = currentProfile?.role ?? "gc";
  }

  // Fetch the contractor's public profile
  const { data: contractor, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", params.id)
    .eq("role", "ec")
    .single();

  if (error || !contractor) notFound();

  // Fetch their reviews (joined with reviewer name)
  const { data: reviews } = await supabase
    .from("reviews")
    .select(`
      *,
      reviewer:profiles!reviews_gc_id_fkey (full_name, company_name)
    `)
    .eq("ec_id", params.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Helpers
  const stars = (rating) =>
    "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));

  const initials = (contractor.company_name ?? contractor.full_name ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const avgRating =
    reviews && reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length
      : contractor.rating;

  return (
    <div className="min-h-screen bg-slate-100 pb-28">
      <Header title="Contractor Profile" showBack />

      <div className="px-4 pt-4 max-w-lg mx-auto space-y-4">

        {/* ── Hero card ── */}
        <div className="bg-white rounded-2xl p-5">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-[#0F2B46] flex items-center justify-center shrink-0">
              <span className="text-amber-400 font-black text-xl">{initials}</span>
            </div>

            {/* Name / location / rating */}
            <div className="flex-1 min-w-0">
              <h1 className="font-black text-slate-800 text-xl leading-tight">
                {contractor.company_name ?? contractor.full_name}
              </h1>
              {contractor.company_name && contractor.full_name && (
                <p className="text-slate-500 text-sm">{contractor.full_name}</p>
              )}
              {contractor.location && (
                <p className="text-slate-400 text-sm mt-0.5">📍 {contractor.location}</p>
              )}
              {avgRating > 0 ? (
                <p className="text-amber-500 text-sm mt-1">
                  {stars(avgRating)}{" "}
                  <span className="font-bold">{avgRating.toFixed(1)}</span>
                  <span className="text-slate-400">
                    {" "}({contractor.total_reviews ?? reviews?.length ?? 0} reviews)
                  </span>
                </p>
              ) : (
                <p className="text-slate-400 text-sm mt-1">No reviews yet</p>
              )}
            </div>
          </div>

          {/* License badge */}
          {contractor.license_number && (
            <div className="mt-3">
              <span className="text-xs bg-green-50 text-green-700 font-bold px-3 py-1.5 rounded-lg">
                ✅ Licensed · #{contractor.license_number}
              </span>
            </div>
          )}

          {/* Bio */}
          {contractor.bio && (
            <p className="text-slate-600 text-sm leading-relaxed mt-3 border-t border-slate-100 pt-3">
              {contractor.bio}
            </p>
          )}
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Jobs Done",
              value: contractor.jobs_completed > 0 ? contractor.jobs_completed : "—",
            },
            {
              label: "Win Rate",
              value: contractor.win_rate ? `${contractor.win_rate}%` : "—",
            },
            {
              label: "Reviews",
              value: contractor.total_reviews ?? reviews?.length ?? 0,
            },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-2xl p-3 text-center">
              <p className="font-black text-slate-800 text-xl">{value}</p>
              <p className="text-slate-400 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Specialties ── */}
        {contractor.specialties?.length > 0 && (
          <div className="bg-white rounded-2xl p-4">
            <p className="text-xs font-black text-slate-400 mb-3">SPECIALTIES</p>
            <div className="flex flex-wrap gap-2">
              {contractor.specialties.map((s) => (
                <span
                  key={s}
                  className="text-sm bg-blue-50 text-blue-700 font-semibold px-3 py-1.5 rounded-lg"
                >
                  ⚡ {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Service area ── */}
        {contractor.service_radius_miles > 0 && (
          <div className="bg-white rounded-2xl p-4 flex items-center gap-3">
            <span className="text-2xl">🗺️</span>
            <div>
              <p className="font-black text-slate-800 text-sm">Service Area</p>
              <p className="text-slate-500 text-sm">
                Up to {contractor.service_radius_miles} miles
                {contractor.location ? ` from ${contractor.location}` : ""}
              </p>
            </div>
          </div>
        )}

        {/* ── Reviews ── */}
        <div>
          <p className="text-xs font-black text-slate-400 px-1 mb-2">
            REVIEWS ({reviews?.length ?? 0})
          </p>

          {reviews && reviews.length > 0 ? (
            <div className="space-y-3">
              {reviews.map((review) => (
                <div key={review.id} className="bg-white rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    {/* Reviewer info */}
                    <div>
                      <p className="font-bold text-slate-700 text-sm">
                        {review.reviewer?.company_name ??
                          review.reviewer?.full_name ??
                          "Anonymous"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(review.created_at).toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    {/* Star rating */}
                    {review.rating && (
                      <span className="text-amber-500 text-sm font-bold whitespace-nowrap">
                        {stars(review.rating)}{" "}
                        <span className="text-slate-600">{review.rating}/5</span>
                      </span>
                    )}
                  </div>

                  {review.comment && (
                    <p className="text-slate-600 text-sm leading-relaxed">
                      &ldquo;{review.comment}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center">
              <p className="text-3xl mb-2">💬</p>
              <p className="font-black text-slate-700 text-sm">No reviews yet</p>
              <p className="text-slate-400 text-xs mt-1">
                Reviews will appear here after completed projects
              </p>
            </div>
          )}
        </div>

      </div>

      <NavBar role={currentRole} />
    </div>
  );
}
