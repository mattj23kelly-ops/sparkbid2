"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);          // do we have a valid recovery session?
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState("");

  // When the user lands from the email link, Supabase exchanges the token and
  // puts the session into storage. We just listen for it.
  useEffect(() => {
    const supabase = createClient();

    // If the URL hash contains recovery tokens, Supabase's detectSessionInUrl
    // (enabled by default) handles them and emits PASSWORD_RECOVERY.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          setReady(true);
        }
      }
    );

    // Also check if we already have a session (user came from email and state loaded)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
    setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <main className="min-h-screen bg-[#0F2B46] flex flex-col">
      <div className="flex flex-col items-center pt-16 pb-8">
        <div className="w-14 h-14 bg-amber-400 rounded-2xl flex items-center justify-center text-2xl mb-4">
          ⚡
        </div>
        <h1 className="font-display text-4xl font-black text-white">SparkBid</h1>
        <p className="text-slate-400 mt-1">Set a new password</p>
      </div>

      <div className="bg-white rounded-t-3xl flex-1 px-6 pt-8 pb-12">
        <div className="max-w-sm mx-auto">
          {done ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4 text-2xl">
                ✓
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-2">Password updated</h2>
              <p className="text-slate-500 text-sm">Taking you to the login page…</p>
            </div>
          ) : !ready ? (
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm">
                Verifying your reset link…
              </p>
              <p className="text-slate-400 text-xs mt-4">
                If this keeps loading, the link may have expired.{" "}
                <Link href="/forgot-password" className="text-amber-500 font-semibold hover:text-amber-600">
                  Request a new one
                </Link>.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-black text-slate-800 mb-1">New password</h2>
              <p className="text-slate-400 text-sm mb-8">Choose something you haven&apos;t used before.</p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">New password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Confirm password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber-400 text-[#0F2B46] font-bold py-4 rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? "Updating…" : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
