"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const STEPS = ["role", "account", "company"];

const SPECIALTIES = [
  "Commercial Wiring", "Residential Wiring", "Industrial",
  "Solar / PV", "EV Chargers", "Generators", "Fire Alarm",
  "Panel Upgrades", "LED Retrofit", "Low Voltage",
];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    role: "",           // "ec" | "gc"
    email: "",
    password: "",
    fullName: "",
    companyName: "",
    licenseNumber: "",
    location: "",
    specialties: [],
  });

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleSpecialty(s) {
    setForm((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(s)
        ? prev.specialties.filter((x) => x !== s)
        : [...prev.specialties, s],
    }));
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");
    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          role: form.role,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Update profile with company info
    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        role: form.role,
        full_name: form.fullName,
        company_name: form.companyName,
        license_number: form.licenseNumber,
        location: form.location,
        specialties: form.specialties,
      });
    }

    router.push(form.role === "gc" ? "/gc" : "/ec");
    router.refresh();
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <main className="min-h-screen bg-[#0F2B46] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-10 pb-6">
        {step > 0 ? (
          <button onClick={() => setStep(s => s - 1)} className="text-slate-400 font-semibold text-sm">
            ← Back
          </button>
        ) : <div />}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center">⚡</div>
          <span className="font-display font-black text-white text-lg">SparkBid</span>
        </div>
        <div className="text-slate-500 text-sm font-medium">
          {step + 1}/{STEPS.length}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-6 mb-4">
        <div className="h-1.5 bg-slate-700 rounded-full">
          <div
            className="h-1.5 bg-amber-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-t-3xl flex-1 px-6 pt-8 pb-12">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">
            {error}
          </div>
        )}

        {/* ── Step 1: Choose Role ── */}
        {step === 0 && (
          <div>
            <h2 className="text-2xl font-black text-slate-800 mb-1">I am a...</h2>
            <p className="text-slate-400 text-sm mb-8">Choose how you&apos;ll use SparkBid</p>

            <div className="space-y-4">
              {[
                {
                  value: "ec",
                  icon: "⚡",
                  title: "Electrical Contractor",
                  desc: "I bid on jobs and win work from GCs",
                  color: "amber",
                },
                {
                  value: "gc",
                  icon: "🏗️",
                  title: "General Contractor",
                  desc: "I post projects and hire electricians",
                  color: "blue",
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update("role", opt.value)}
                  className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${
                    form.role === opt.value
                      ? opt.color === "amber"
                        ? "border-amber-400 bg-amber-50"
                        : "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="text-3xl mb-2">{opt.icon}</div>
                  <div className="font-black text-slate-800 text-lg">{opt.title}</div>
                  <div className="text-slate-500 text-sm mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>

            <button
              disabled={!form.role}
              onClick={() => setStep(1)}
              className="w-full mt-8 bg-amber-400 text-[#0F2B46] font-bold py-4 rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── Step 2: Account Info ── */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-black text-slate-800 mb-1">Create your account</h2>
            <p className="text-slate-400 text-sm mb-8">Your login credentials</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
                  placeholder="Mike Thompson"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <button
              disabled={!form.email || !form.password || !form.fullName}
              onClick={() => setStep(2)}
              className="w-full mt-8 bg-amber-400 text-[#0F2B46] font-bold py-4 rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── Step 3: Company Info ── */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-black text-slate-800 mb-1">Your company</h2>
            <p className="text-slate-400 text-sm mb-6">This builds your professional profile</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Company Name</label>
                <input
                  type="text"
                  value={form.companyName}
                  onChange={(e) => update("companyName", e.target.value)}
                  placeholder="Mike's Electrical Services"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              {form.role === "ec" && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Electrician License #
                  </label>
                  <input
                    type="text"
                    value={form.licenseNumber}
                    onChange={(e) => update("licenseNumber", e.target.value)}
                    placeholder="e.g. NY-ELC-28491"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Primary Service Area
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                  placeholder="e.g. Albany, NY"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {form.role === "ec" && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Specialties <span className="font-normal text-slate-400">(select all that apply)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SPECIALTIES.map((s) => (
                      <button
                        key={s}
                        onClick={() => toggleSpecialty(s)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                          form.specialties.includes(s)
                            ? "bg-blue-500 text-white border-blue-500"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              disabled={loading || !form.companyName}
              onClick={handleSubmit}
              className="w-full mt-8 bg-amber-400 text-[#0F2B46] font-bold py-4 rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account..." : "Create Account →"}
            </button>
          </div>
        )}

        <p className="text-center mt-6 text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="text-amber-500 font-bold hover:text-amber-600">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
