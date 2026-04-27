"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/reset-password`;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo }
    );

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#0F2B46] flex flex-col">
      <div className="flex flex-col items-center pt-16 pb-8">
        <div className="w-14 h-14 bg-amber-400 rounded-2xl flex items-center justify-center text-2xl mb-4">
          ⚡
        </div>
        <h1 className="font-display text-4xl font-black text-white">SparkBid</h1>
        <p className="text-slate-400 mt-1">Reset your password</p>
      </div>

      <div className="bg-white rounded-t-3xl flex-1 px-6 pt-8 pb-12">
        {sent ? (
          <div className="max-w-sm mx-auto text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4 text-2xl">
              ✓
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Check your email</h2>
            <p className="text-slate-500 text-sm mb-8">
              If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to reset your password.
              It may take a minute or two to arrive.
            </p>
            <Link
              href="/login"
              className="inline-block w-full bg-amber-400 text-[#0F2B46] font-bold py-4 rounded-xl hover:bg-amber-300 transition-colors"
            >
              Back to log in
            </Link>
          </div>
        ) : (
          <div className="max-w-sm mx-auto">
            <h2 className="text-2xl font-black text-slate-800 mb-1">Forgot password?</h2>
            <p className="text-slate-400 text-sm mb-8">
              Enter the email you used to sign up and we&apos;ll send you a reset link.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-400 text-[#0F2B46] font-bold py-4 rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="text-center mt-8 text-sm text-slate-500">
              Remember your password?{" "}
              <Link href="/login" className="text-amber-500 font-bold hover:text-amber-600">
                Log in
              </Link>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
