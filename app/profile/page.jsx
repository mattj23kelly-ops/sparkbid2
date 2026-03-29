import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/ui/Header";
import NavBar from "@/components/ui/NavBar";
import LogoutButton from "@/components/ui/LogoutButton";

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
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  const stars = (rating) =>
    "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));

  const isEC = profile?.role === "ec";

  return (
    <div className="min-h-screen bg-slate-100 pb-28">
      <Header title="Profile" />

      <div className="px-4 pt-4 max-w-lg mx-auto space-y-4">

        {/* ── Avatar + identity ── */}
        <div className="bg-white rounded-2xl p-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-[#0F2B46] flex items-center justify-center mx-auto mb-4">
            <span className="text-amber-400 font-black text-2xl">{initials}</span>
          </div>
          <h2 className="font-black text-slate-800 text-xl">
            {profile?.company_name ?? profile?.full_name ?? "Your Company"}
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">{profile?.full_name}</p>
          {profile?.license_number && (
            <p className="text-slate-400 text-xs mt-0.5">License #{profile.license_number}</p>
          )}
          {profile?.location && (
            <p className="text-slate-400 text-sm mt-1">📍 {profile.location}</p>
          )}
          {profile?.rating > 0 && (
            <p className="text-amber-500 font-semibold mt-2">
              {stars(profile.rating)} {profile.rating.toFixed(1)}
              <span className="text-slate-400 font-normal text-sm"> ({profile.total_reviews} reviews)</span>
            </p>
          )}
          <p className="text-slate-400 text-xs mt-1">
            {profile?.role === "ec" ? "⚡ Electrician" : "🏗️ General Contractor"} · Member since {new Date(user.created_at).getFullYear()}
          </p>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-3">
          {(isEC ? [
            { label: "Jobs Done",  value: profile?.jobs_completed ?? 0, color: "text-blue-500"  },
            { label: "Win Rate",   value: `${profile?.win_rate ?? 0}%`, color: "text-green-600" },
            { label: "Avg Rating", value: profile?.rating?.toFixed(1) ?? "—", color: "text-amber-500" },
          ] : [
            { label: "Projects",   value: profile?.jobs_completed ?? 0, color: "text-blue-500"  },
            { label: "Avg Rating", value: profile?.rating?.toFixed(1) ?? "—", color: "text-amber-500" },
            { label: "Reviews",    value: profile?.total_reviews ?? 0, color: "text-green-600" },
          ]).map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-4 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Specialties (EC only) ── */}
        {isEC && profile?.specialties && profile.specialties.length > 0 && (
          <div className="bg-white rounded-2xl p-5">
            <p className="text-xs font-black text-slate-400 tracking-wide mb-3">SPECIALTIES</p>
            <div className="flex flex-wrap gap-2">
              {profile.specialties.map((s) => (
                <span key={s} className="px-3 py-1.5 bg-blue-50 text-blue-600 text-sm font-bold rounded-lg">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Recent Reviews ── */}
        {reviews && reviews.length > 0 && (
          <div className="bg-white rounded-2xl p-5">
            <p className="text-xs font-black text-slate-400 tracking-wide mb-4">RECENT REVIEWS</p>
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border-b border-slate-100 last:border-0 pb-4 last:pb-0">
                  <p className="text-amber-500 font-semibold text-sm mb-1">{stars(review.rating)}</p>
                  {review.comment && (
                    <p className="text-slate-600 text-sm italic">&quot;{review.comment}&quot;</p>
                  )}
                  {review.project?.title && (
                    <p className="text-slate-400 text-xs mt-1">{review.project.title}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── No reviews yet ── */}
        {(!reviews || reviews.length === 0) && (
          <div className="bg-white rounded-2xl p-5 text-center">
            <p className="text-2xl mb-2">⭐</p>
            <p className="font-bold text-slate-600 text-sm">No reviews yet</p>
            <p className="text-slate-400 text-xs mt-1">Reviews appear here after completing jobs</p>
          </div>
        )}

        {/* ── Account section ── */}
        <div className="bg-white rounded-2xl overflow-hidden">
          <p className="text-xs font-black text-slate-400 tracking-wide px-5 pt-5 pb-3">ACCOUNT</p>

          <div className="px-5 pb-2">
            <p className="text-sm text-slate-500">Signed in as</p>
            <p className="font-bold text-slate-800 truncate">{user.email}</p>
          </div>

          <div className="h-px bg-slate-100 mx-5 my-3" />

          {[
            { label: "Edit Profile",         href: "/profile/edit",    icon: "✏️" },
            { label: "Notification Settings", href: "/settings",       icon: "🔔" },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span>{item.icon}</span>
                <span className="font-semibold text-slate-700 text-sm">{item.label}</span>
              </div>
              <span className="text-slate-300 text-lg">›</span>
            </a>
          ))}

          <div className="h-px bg-slate-100 mx-5" />

          {/* Logout button — client component */}
          <div className="px-5 py-4">
            <LogoutButton />
          </div>
        </div>

        <p className="text-center text-slate-400 text-xs pb-2">SparkBid v0.1</p>
      </div>

      <NavBar role={profile?.role ?? "ec"} />
    </div>
  );
}
