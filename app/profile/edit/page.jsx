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
    setTimeout(() => router.push("/profile"), 1200);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 md:px-8 py-20 text-center text-sm text-slate-500">
        Loading profile…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 md:px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push("/profile")}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← Back to profile
          </button>
          <h1 className="text-2xl font-semibold text-slate-900 mt-2">Edit profile</h1>
          <p className="text-sm text-slate-500">Keep your details up to date for clients.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || success}
          className="btn btn-primary"
        >
          {saving ? "Saving…" : success ? "Saved" : "Save"}
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-5">

        {success && (
          <div className="card p-4 bg-green-50 border-green-100 text-sm text-green-700">
            Profile saved. Redirecting…
          </div>
        )}

        {error && (
          <div className="card p-4 bg-red-50 border-red-100 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Personal info */}
        <section className="card p-6 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Personal info</p>

          <Field label="Full name">
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              placeholder="Mike Thompson"
              className="input"
            />
          </Field>

          <Field label="Company name">
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => update("companyName", e.target.value)}
              placeholder="Mike's Electrical Services"
              className="input"
            />
          </Field>

          <Field label="Bio" hint="Optional. A short intro for clients viewing your profile.">
            <textarea
              value={form.bio}
              onChange={(e) => update("bio", e.target.value)}
              placeholder="Tell GCs a bit about your experience and what sets you apart…"
              rows={4}
              className="input resize-none"
            />
          </Field>
        </section>

        {/* Business info */}
        <section className="card p-6 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Business info</p>

          {role === "ec" && (
            <Field label="Electrician license #">
              <input
                type="text"
                value={form.licenseNumber}
                onChange={(e) => update("licenseNumber", e.target.value)}
                placeholder="e.g. NY-ELC-28491"
                className="input"
              />
            </Field>
          )}

          <Field label="Primary service area">
            <input
              type="text"
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="e.g. Albany, NY"
              className="input"
            />
          </Field>

          <Field label={
            <span>
              Service radius
              <span className="ml-2 text-brand-600 tabular-nums">{form.serviceRadius} miles</span>
            </span>
          }>
            <input
              type="range"
              min={10}
              max={200}
              step={5}
              value={form.serviceRadius}
              onChange={(e) => update("serviceRadius", Number(e.target.value))}
              className="w-full accent-brand-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>10 mi</span>
              <span>200 mi</span>
            </div>
          </Field>
        </section>

        {/* Specialties (EC only) */}
        {role === "ec" && (
          <section className="card p-6">
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Specialties</p>
              <p className="text-xs text-slate-500">{form.specialties.length} selected</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES.map((s) => {
                const active = form.specialties.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSpecialty(s)}
                    className={`chip transition-colors ${
                      active
                        ? "bg-brand-600 text-white border border-brand-600 hover:bg-brand-700"
                        : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="btn btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || success}
            className="btn btn-primary flex-[2]"
          >
            {saving ? "Saving…" : success ? "Saved" : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
