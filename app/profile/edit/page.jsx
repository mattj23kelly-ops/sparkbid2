"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SPECIALTIES = [
  "Commercial Wiring", "Residential Wiring", "Industrial",
  "Solar / PV", "EV Chargers", "Generators", "Fire Alarm",
  "Panel Upgrades", "LED Retrofit", "Low Voltage",
];

export default function EditProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [role, setRole] = useState("ec");

  const [form, setForm] = useState({
    fullName: "",
    companyName: "",
    licenseNumber: "",
    location: "",
    bio: "",
    serviceRadius: 50,
    specialties: [],
  });

  // Load current profile on mount
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        setRole(profile.role ?? "ec");
        setForm({
          fullName:      profile.full_name      ?? "",
          companyName:   profile.company_name   ?? "",
          licenseNumber: profile.license_number ?? "",
          location:      profile.location       ?? "",
          bio:           profile.bio            ?? "",
          serviceRadius: profile.service_radius_miles ?? 50,
          specialties:   profile.specialties    ?? [],
        });
      }
      setLoading(false);
    }
    load();
  }, [router]);

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

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name:           form.fullName.trim(),
        company_name:        form.companyName.trim(),
        license_number:      form.licenseNumber.trim() || null,
        location:            form.location.trim(),
        bio:                 form.bio.trim() || null,
        service_radius_miles: form.serviceRadius,
        specialties:         form.specialties,
        updated_at:          new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSuccess(true);
    setSaving(false);

    // Redirect back to profile after short delay
    setTimeout(() => router.push("/profile"), 1200);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl animate-pulse mb-2">⚡</div>
          <p className="text-slate-400 font-semibold text-sm">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-[#0F2B46] px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.push("/profile")}
          className="text-slate-400 font-semibold text-sm"
        >
          ← Cancel
        </button>
        <span className="font-display font-black text-white text-lg">Edit Profile</span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto bg-amber-400 text-[#0F2B46] font-black text-sm px-4 py-2 rounded-xl hover:bg-amber-300 transition-colors disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </header>

      <form onSubmit={handleSave} className="px-4 py-5 max-w-lg mx-auto space-y-5 pb-20">

        {/* Success banner */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm font-semibold text-center">
            ✅ Profile saved! Redirecting...
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* ── Personal Info ── */}
        <div className="bg-white rounded-2xl p-5 space-y-4">
          <p className="text-xs font-black text-slate-400 tracking-wide">PERSONAL INFO</p>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Full Name</label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              placeholder="Mike Thompson"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Company Name</label>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => update("companyName", e.target.value)}
              placeholder="Mike's Electrical Services"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Bio <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={form.bio}
              onChange={(e) => update("bio", e.target.value)}
              placeholder="Tell GCs a bit about your experience and what sets you apart..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        {/* ── Business Info ── */}
        <div className="bg-white rounded-2xl p-5 space-y-4">
          <p className="text-xs font-black text-slate-400 tracking-wide">BUSINESS INFO</p>

          {role === "ec" && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Electrician License #
              </label>
              <input
                type="text"
                value={form.licenseNumber}
                onChange={(e) => update("licenseNumber", e.target.value)}
                placeholder="e.g. NY-ELC-28491"
                className={inputClass}
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
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">
              Service Radius: <span className="text-amber-500">{form.serviceRadius} miles</span>
            </label>
            <input
              type="range"
              min={10}
              max={200}
              step={5}
              value={form.serviceRadius}
              onChange={(e) => update("serviceRadius", Number(e.target.value))}
              className="w-full accent-amber-400"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>10 mi</span>
              <span>200 mi</span>
            </div>
          </div>
        </div>

        {/* ── Specialties (EC only) ── */}
        {role === "ec" && (
          <div className="bg-white rounded-2xl p-5">
            <p className="text-xs font-black text-slate-400 tracking-wide mb-3">
              SPECIALTIES
              <span className="font-normal ml-1">({form.specialties.length} selected)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSpecialty(s)}
                  className={`px-3 py-2 rounded-xl text-sm font-bold border transition-all ${
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

        {/* Save button */}
        <button
          type="submit"
          disabled={saving || success}
          className="w-full bg-amber-400 text-[#0F2B46] font-black py-4 rounded-2xl hover:bg-amber-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-base"
        >
          {saving ? "Saving..." : success ? "✅ Saved!" : "Save Profile"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/profile")}
          className="w-full text-slate-400 font-semibold py-2 text-sm hover:text-slate-600"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}

const inputClass = "w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm";
