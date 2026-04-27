"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ── AI bid strategy generator (demo-grade) ─────────────────────
function generateBidData(project) {
  const midBudget = (project.budget_min + project.budget_max) / 2;

  const aggressive   = Math.round(midBudget * 0.82 / 50) * 50;
  const recommended  = Math.round(midBudget * 0.94 / 50) * 50;
  const conservative = Math.round(midBudget * 1.06 / 50) * 50;

  const materials = Math.round(recommended * 0.42);
  const labor     = Math.round(recommended * 0.38);
  const overhead  = Math.round(recommended * 0.12);
  const profit    = recommended - materials - labor - overhead;

  const baseConfidence = 80 + Math.floor(Math.random() * 12);
  const baseWinChance  = 55 + Math.floor(Math.random() * 18);

  const tipSets = {
    commercial: [
      "Include your commercial license number prominently in your proposal.",
      "Mention similar-sized commercial projects you've completed.",
      "GCs prioritize reliability — offer a detailed timeline.",
      "Adding a material escalation clause protects your margin.",
    ],
    residential: [
      "Homeowner GCs value clear communication above price.",
      "Offer a 1-year workmanship warranty to stand out.",
      "Mention how you'll protect finished areas during work.",
      "A start date within 2 weeks strengthens your bid.",
    ],
    industrial: [
      "Highlight 3-phase and motor control experience.",
      "Industrial clients care deeply about safety certifications.",
      "Include OSHA-10 or OSHA-30 certification if you have it.",
      "Propose a commissioning and startup support plan.",
    ],
    institutional: [
      "Public projects require prevailing wage — factor that in.",
      "Bond and insurance requirements are stricter — confirm yours are current.",
      "Include a schedule showing minimal disruption to operations.",
      "Reference similar institutional or public-sector experience.",
    ],
  };

  const tips = (tipSets[project.project_type] ?? tipSets.commercial)
    .sort(() => 0.5 - Math.random()).slice(0, 3);

  return {
    strategies: {
      aggressive:   { amount: aggressive,   label: "Aggressive",   desc: "Win the job, tighter margins",   accent: "text-red-600" },
      recommended:  { amount: recommended,  label: "Recommended",  desc: "Balanced price & profit",        accent: "text-green-600" },
      conservative: { amount: conservative, label: "Conservative", desc: "Higher margins, fewer wins",     accent: "text-brand-600" },
    },
    breakdown: { materials, labor, overhead, profit },
    confidence: baseConfidence,
    winChance: baseWinChance,
    tips,
  };
}

export default function BidFlowPage({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const estimateIdParam = searchParams.get("estimateId");
  // An estimate always implies manual mode — we have a real number.
  const mode = estimateIdParam ? "manual" : (searchParams.get("mode") ?? "ai");

  const [step, setStep] = useState(0);
  const [project, setProject] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [selectedStrategy, setSelectedStrategy] = useState("recommended");
  const [customAmount, setCustomAmount] = useState("");
  const [coverNote, setCoverNote] = useState("");
  const [bidData, setBidData] = useState(null);
  const [estimatePrefill, setEstimatePrefill] = useState(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [{ data: proj }, { data: prof }] = await Promise.all([
        supabase.from("projects").select("*").eq("id", params.projectId).single(),
        supabase.from("profiles").select("*").eq("id", user.id).single(),
      ]);

      if (!proj) { router.push("/browse"); return; }

      setProject(proj);
      setProfile(prof);

      // Optional pre-fill from a saved estimate.
      if (estimateIdParam) {
        const { data: est } = await supabase
          .from("estimates")
          .select("id, title, grand_total, materials_total, labor_total, overhead_total, profit_total, takeoff:takeoffs(scope_summary)")
          .eq("id", estimateIdParam)
          .eq("owner_id", user.id)
          .maybeSingle();

        if (est) {
          const grand    = Number(est.grand_total     ?? 0);
          const material = Number(est.materials_total ?? 0);
          const labor    = Number(est.labor_total     ?? 0);
          const overhead = Number(est.overhead_total  ?? 0);
          const profit   = Number(est.profit_total    ?? 0);
          const summary  = est.takeoff?.scope_summary ?? null;

          setEstimatePrefill({
            id:         est.id,
            title:      est.title,
            grand,
            materials:  material,
            labor,
            overhead,
            profit,
            summary,
          });
          if (grand > 0) setCustomAmount(String(Math.round(grand)));
          if (summary) {
            setCoverNote(
              `Our bid is based on a detailed take-off of your plans.\n\nScope we priced:\n${summary}`
            );
          }
        }
      }

      if (mode === "ai") {
        setCalculating(true);
        setTimeout(() => {
          setBidData(generateBidData(proj));
          setCalculating(false);
          setStep(1);
        }, 1500);
      } else {
        setStep(1);
      }

      setLoading(false);
    }
    load();
  }, [params.projectId, mode, router, estimateIdParam]);

  async function submitBid() {
    setSubmitting(true);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const amount = mode === "manual"
      ? parseFloat(customAmount)
      : bidData.strategies[selectedStrategy].amount;

    if (!amount || isNaN(amount)) {
      setError("Please enter a valid bid amount.");
      setSubmitting(false);
      return;
    }

    const insertData = {
      project_id: project.id,
      ec_id: user.id,
      amount,
      strategy: mode === "manual" ? "recommended" : selectedStrategy,
      cover_note: coverNote || null,
      status: "submitted",
    };

    if (bidData) {
      const bd = bidData.breakdown;
      insertData.materials_cost = bd.materials;
      insertData.labor_cost     = bd.labor;
      insertData.overhead_cost  = bd.overhead;
      insertData.profit_margin  = Math.round((bd.profit / amount) * 100 * 10) / 10;
      insertData.ai_confidence  = bidData.confidence;
      insertData.ai_win_chance  = bidData.winChance;
      insertData.ai_tips        = bidData.tips;
    } else if (estimatePrefill) {
      insertData.materials_cost = estimatePrefill.materials;
      insertData.labor_cost     = estimatePrefill.labor;
      insertData.overhead_cost  = estimatePrefill.overhead;
      insertData.profit_margin  = amount > 0
        ? Math.round((estimatePrefill.profit / amount) * 100 * 10) / 10
        : null;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("bids")
      .insert(insertData)
      .select("id")
      .single();
    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    // Fire-and-forget: notify the GC. Failure here doesn't block the user.
    if (inserted?.id) {
      fetch("/api/notifications/bid-submitted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bidId: inserted.id }),
      }).catch((e) => console.warn("Notification dispatch failed:", e));
    }

    setStep(3);
  }

  const finalAmount = mode === "manual"
    ? parseFloat(customAmount) || 0
    : bidData?.strategies[selectedStrategy]?.amount ?? 0;

  const isVerified = profile?.verification_status === "approved";

  // ── Loading ──
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 md:px-8 py-20 text-center">
        <Spinner />
        <p className="text-sm text-slate-500 mt-3">Loading project…</p>
      </div>
    );
  }

  // ── AI thinking ──
  if (calculating) {
    return (
      <div className="max-w-3xl mx-auto px-6 md:px-8 py-20 text-center">
        <div className="card p-8 max-w-md mx-auto">
          <Spinner />
          <h2 className="text-lg font-semibold text-slate-900 mt-4">AI is analyzing…</h2>
          <ul className="text-sm text-slate-500 mt-3 space-y-1">
            <li>Scanning market rates for {project?.location}</li>
            <li>Reviewing {project?.project_type} project data</li>
            <li>Calculating optimal bid strategies</li>
          </ul>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (step === 3) {
    return (
      <div className="max-w-3xl mx-auto px-6 md:px-8 py-20">
        <div className="card p-10 text-center max-w-md mx-auto">
          <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Bid submitted</h2>
          <p className="text-sm text-slate-600 mt-2">
            Your bid of <strong className="text-slate-900 tabular-nums">${finalAmount.toLocaleString()}</strong> is now with the GC.
          </p>
          <p className="text-xs text-slate-500 mt-1">You&apos;ll be notified if you&apos;re winning or outbid.</p>
          <div className="mt-6 space-y-2">
            <button onClick={() => router.push("/ec")} className="btn btn-primary w-full">Back to dashboard</button>
            <button onClick={() => router.push("/browse")} className="btn btn-ghost w-full">Browse more projects</button>
          </div>
        </div>
      </div>
    );
  }

  const progress = step === 1 ? 50 : 100;

  return (
    <div className="max-w-3xl mx-auto px-6 md:px-8 py-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {mode === "ai" ? "AI Bid Assistant" : "Place a Bid"}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1 truncate">{project?.title}</h1>
          <p className="text-sm text-slate-500">{project?.location}</p>
        </div>
        <span className="text-xs text-slate-500 shrink-0">Step {step} of 2</span>
      </div>

      {/* Progress */}
      <div className="h-1 bg-slate-200 rounded-full overflow-hidden my-4">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
      </div>

      {error && (
        <div className="card p-4 bg-red-50 border-red-100 text-sm text-red-700 mb-4">{error}</div>
      )}

      {estimatePrefill && (
        <div className="card p-4 bg-brand-50 border-brand-100 mb-4 flex items-start gap-3">
          <span className="text-brand-600 text-lg leading-none">⚡</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-brand-900">
              Pre-filled from estimate: {estimatePrefill.title}
            </p>
            <p className="text-xs text-brand-800 mt-0.5">
              Amount and cost breakdown come from your saved estimate. You can still edit the amount below.{" "}
              <Link href={`/estimates/${estimatePrefill.id}`} className="underline">View estimate</Link>
            </p>
          </div>
        </div>
      )}

      {!isVerified && profile?.role === "ec" && (
        <div className="card p-4 bg-amber-50 border-amber-100 mb-4">
          <p className="text-sm font-semibold text-amber-900">
            {profile?.verification_status === "rejected"
              ? "Your license couldn't be verified"
              : "License verification in progress"}
          </p>
          <p className="text-sm text-amber-800 mt-1">
            {profile?.verification_status === "rejected"
              ? (profile?.verification_notes
                  ? `Reviewer notes: ${profile.verification_notes}`
                  : "Update your license number in your profile and we'll re-review.")
              : "You can browse projects while we verify your license. Bidding unlocks as soon as you're approved."}
          </p>
        </div>
      )}

      {/* ── Step 1 · AI ── */}
      {step === 1 && mode === "ai" && bidData && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Choose your strategy</p>
              <div className="space-y-2">
                {Object.entries(bidData.strategies).map(([key, s]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedStrategy(key)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                      selectedStrategy === key
                        ? "border-brand-500 bg-brand-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{s.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
                    </div>
                    <p className={`text-lg font-bold tabular-nums ${s.accent}`}>
                      ${s.amount.toLocaleString()}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Cost breakdown (recommended)</p>
              {[
                { label: "Materials", value: bidData.breakdown.materials, pct: 42 },
                { label: "Labor",     value: bidData.breakdown.labor,     pct: 38 },
                { label: "Overhead",  value: bidData.breakdown.overhead,  pct: 12 },
                { label: "Profit",    value: bidData.breakdown.profit,    pct: 8  },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-700">{item.label}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500 tabular-nums">{item.pct}%</span>
                    <span className="text-sm font-semibold text-slate-900 tabular-nums w-20 text-right">
                      ${item.value.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 mb-3">AI tips for this bid</p>
              <ul className="space-y-2">
                {bidData.tips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className="text-brand-500 shrink-0">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="lg:col-span-1">
            <div className="sticky top-6 card p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Confidence</p>
                <p className="text-2xl font-bold text-green-600 tabular-nums">{bidData.confidence}%</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Win chance</p>
                <p className="text-2xl font-bold text-brand-600 tabular-nums">{bidData.winChance}%</p>
              </div>
              <div className="h-px bg-slate-100" />
              <div>
                <p className="text-xs text-slate-500">Your bid</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">
                  ${bidData.strategies[selectedStrategy].amount.toLocaleString()}
                </p>
              </div>
              <button onClick={() => setStep(2)} className="btn btn-primary w-full">
                Preview proposal →
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Step 1 · Manual ── */}
      {step === 1 && mode === "manual" && (
        <div className="max-w-xl mx-auto space-y-5">
          <div className="card p-5">
            <p className="text-sm text-slate-600 mb-4">
              Budget range:{" "}
              <strong className="text-slate-900 tabular-nums">
                ${Number(project?.budget_min).toLocaleString()} – ${Number(project?.budget_max).toLocaleString()}
              </strong>
            </p>

            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Your bid amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-lg">$</span>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="0"
                className="input !pl-10 !py-3.5 text-2xl font-bold tabular-nums"
              />
            </div>

            {customAmount && !isNaN(parseFloat(customAmount)) && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Approximate breakdown</p>
                {[
                  { label: "Materials (~42%)", value: Math.round(parseFloat(customAmount) * 0.42) },
                  { label: "Labor (~38%)",     value: Math.round(parseFloat(customAmount) * 0.38) },
                  { label: "Overhead (~12%)",  value: Math.round(parseFloat(customAmount) * 0.12) },
                  { label: "Profit (~8%)",     value: Math.round(parseFloat(customAmount) * 0.08) },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between text-sm">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="font-medium text-slate-900 tabular-nums">${item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!estimatePrefill && (
            <div className="card p-4 bg-brand-50 border-brand-100">
              <p className="text-sm text-brand-800">
                Want AI to suggest a price? Go back and choose{" "}
                <Link href={`/bid/${project.id}?mode=ai`} className="font-semibold underline">Get AI bid estimate</Link>.
              </p>
            </div>
          )}

          <button
            disabled={!customAmount || isNaN(parseFloat(customAmount))}
            onClick={() => setStep(2)}
            className="btn btn-primary w-full"
          >
            Preview proposal →
          </button>
        </div>
      )}

      {/* ── Step 2 · Preview ── */}
      {step === 2 && (
        <div className="max-w-xl mx-auto space-y-5">
          <div className="card p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Your proposal</p>

            <dl className="divide-y divide-slate-100">
              <Row label="Project"      value={project?.title} />
              <Row label="Your bid"     value={<span className="text-xl font-bold text-slate-900 tabular-nums">${finalAmount.toLocaleString()}</span>} />
              {mode === "ai" && <Row label="Strategy" value={<span className="capitalize">{selectedStrategy}</span>} />}
              <Row label="Company"      value={profile?.company_name ?? "—"} />
              {profile?.license_number && <Row label="License #" value={profile.license_number} />}
            </dl>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Cover note <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                value={coverNote}
                onChange={(e) => setCoverNote(e.target.value)}
                placeholder="Briefly introduce yourself and why you're the right fit…"
                rows={4}
                className="input resize-none"
              />
            </div>
          </div>

          {mode === "ai" && bidData && (
            <div className="card p-4 bg-green-50 border-green-100 text-sm text-green-800">
              AI confidence: <strong>{bidData.confidence}%</strong> · Win chance: <strong>{bidData.winChance}%</strong>
            </div>
          )}

          <button
            disabled={submitting || !isVerified}
            onClick={submitBid}
            className="btn btn-primary w-full !py-3"
          >
            {submitting
              ? "Submitting…"
              : !isVerified
                ? "Verification required to bid"
                : `Submit bid — $${finalAmount.toLocaleString()}`}
          </button>

          <button
            onClick={() => setStep(1)}
            className="btn btn-ghost w-full"
          >
            ← Edit bid
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900 text-right">{value}</dd>
    </div>
  );
}

function Spinner() {
  return (
    <div className="inline-flex">
      <svg className="animate-spin h-6 w-6 text-brand-500" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
        <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
}
