import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/ui/LogoutButton";
import PageHeader from "@/components/ui/PageHeader";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: reviews } = await supabase
    .from("reviews")
    .select("*, project:projects(title)")
    .eq("reviewee_id", user.id)
    .order("created_at", { ascending: false })
    .limit(3);

  const initials = profile?.full_name
    ?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) ?? "?";

  const stars = (rating) =>
    "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));

  const isEC = profile?.role === "ec";
  const roleLabel = isEC ? "Electrical contractor" : "General contractor";

  return (
    <div className="max-w-4xl mx-auto px-6 md:px-8 py-8 space-y-6">
      <PageHeader
        title="Profile"
        subtitle="Your account, company details and reviews."
      />

      {/* ── Identity card ── */}
      <div className="card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xl font-bold shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-slate-900 truncate">
            {profile?.company_name ?? profile?.full_name ?? "Your Company"}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">{profile?.full_name}</p>
          <p className="text-xs text-slate-500 mt-1">
            {roleLabel}
            {profile?.location && ` · ${profile.location}`}
            {profile?.license_number && ` · License #${profile.license_number}`}
          </p>
          {profile?.rating > 0 && (
            <p className="text-sm text-amber-600 font-medium mt-2">
              {stars(profile.rating)} {profile.rating.toFixed(1)}
              <span className="text-slate-500 font-normal"> ({profile.total_reviews} reviews)</span>
            </p>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        {(isEC ? [
          { label: "Jobs completed", value: profile?.jobs_completed ?? 0 },
          { label: "Win rate",       value: `${profile?.win_rate ?? 0}%` },
          { label: "Avg rating",     value: profile?.rating?.toFixed(1) ?? "—" },
        ] : [
          { label: "Projects posted", value: profile?.jobs_completed ?? 0 },
          { label: "Avg rating",      value: profile?.rating?.toFixed(1) ?? "—" },
          { label: "Reviews",         value: profile?.total_reviews ?? 0 },
        ]).map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-xs font-medium text-slate-500">{s.label}</p>
            <p className="text-2xl font-bold tracking-tight text-slate-900 mt-1 tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Specialties (EC only) ── */}
      {isEC && profile?.specialties && profile.specialties.length > 0 && (
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Specialties</p>
          <div className="flex flex-wrap gap-2">
            {profile.specialties.map((s) => (
              <span key={s} className="chip bg-brand-50 text-brand-700">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent reviews ── */}
      <div className="card p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Recent reviews</p>
        {reviews && reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border-b border-slate-100 last:border-0 pb-4 last:pb-0">
                <p className="text-amber-600 text-sm">{stars(review.rating)}</p>
                {review.comment && (
                  <p className="text-slate-700 text-sm italic mt-1">&ldquo;{review.comment}&rdquo;</p>
                )}
                {review.project?.title && (
                  <p className="text-xs text-slate-500 mt-1">{review.project.title}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No reviews yet — reviews appear here after completing jobs.</p>
        )}
      </div>

      {/* ── Account ── */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Account</p>
          <p className="text-xs text-slate-500 mt-2">Signed in as</p>
          <p className="text-sm font-medium text-slate-900 truncate">{user.email}</p>
        </div>

        <Link
          href="/profile/edit"
          className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors border-b border-slate-100"
        >
          <span className="text-sm font-medium text-slate-700">Edit profile</span>
          <span className="text-slate-300">›</span>
        </Link>

        <Link
          href="/settings"
          className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
        >
          <span className="text-sm font-medium text-slate-700">Notification settings</span>
          <span className="text-slate-300">›</span>
        </Link>

        <div className="p-5 border-t border-slate-100">
          <LogoutButton />
        </div>
      </div>

      <p className="text-center text-xs text-slate-400">SparkBid v0.1</p>
    </div>
  );
}
