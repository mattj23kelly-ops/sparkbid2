"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Fetch role and redirect
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    router.push(profile?.role === "gc" ? "/gc" : "/ec");
    router.refresh();
  }

  async function handleGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="min-h-screen bg-[#0F2B46] flex flex-col">
      {/* Header */}
      <div className="flex flex-col items-center pt-16 pb-8">
        <div className="w-14 h-14 bg-amber-400 rounded-2xl flex items-center justify-center text-2xl mb-4">
          ⚡
        </div>
        <h1 className="font-display text-4xl font-black text-white">SparkBid</h1>
        <p className="text-slate-400 mt-1">Win more work. Bid smarter.</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-t-3xl flex-1 px-6 pt-8 pb-12">
        <h2 className="text-2xl font-black text-slate-800 mb-1">Welcome back</h2>
        <p className="text-slate-400 text-sm mb-8">Log in to your account</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm text-amber-500 font-semibold hover:text-amber-600">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-400 text-[#0F2B46] font-bold py-4 rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400 font-medium">or</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full border border-slate-200 text-slate-700 font-semibold py-4 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-lg">G</span> Continue with Google
        </button>

        <p className="text-center mt-8 text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-amber-500 font-bold hover:text-amber-600">
            Sign up free
          </Link>
        </p>
      </div>
    </main>
  );
}
