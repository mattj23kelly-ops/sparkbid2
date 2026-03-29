// Root page — redirects logged-in users to their dashboard,
// or shows a landing page for visitors
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Get their role and redirect to the right dashboard
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "gc") redirect("/gc");
    else redirect("/ec");
  }

  // Not logged in — show landing page
  return (
    <main className="min-h-screen bg-[#0F2B46] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 bg-amber-400 rounded-2xl flex items-center justify-center mb-6 text-3xl">
        ⚡
      </div>
      <h1 className="font-display text-5xl font-black text-white mb-3">SparkBid</h1>
      <p className="text-slate-400 text-lg mb-10">Win more work. Bid smarter.</p>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
        <Link
          href="/login"
          className="flex-1 bg-amber-400 text-[#0F2B46] font-bold py-4 rounded-xl text-center hover:bg-amber-300 transition-colors"
        >
          Log In
        </Link>
        <Link
          href="/signup"
          className="flex-1 border border-slate-600 text-white font-bold py-4 rounded-xl text-center hover:bg-slate-800 transition-colors"
        >
          Sign Up Free
        </Link>
      </div>

      <p className="text-slate-600 text-sm mt-8">
        For electrical contractors &amp; general contractors
      </p>
    </main>
  );
}
