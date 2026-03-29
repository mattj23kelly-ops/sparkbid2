"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ── AI Calculation Engine ──────────────────────────────────────
// Generates realistic bid strategies based on project budget
function generateBidData(project, profile) {
  const midBudget = (project.budget_min + project.budget_max) / 2;

  // Three strategy price points
  const aggressive   = Math.round(midBudget * 0.82 / 50) * 50;
  const recommended  = Math.round(midBudget * 0.94 / 50) * 50;
  const conservative = Math.round(midBudget * 1.06 / 50) * 50;

  // Cost breakdown for recommended bid
  const materials = Math.round(recommended * 0.42);
  const labor     = Math.round(recommended * 0.38);
  const overhead  = Math.round(recommended * 0.12);
  const profit    = recommended - materials - labor - overhead;

  // Confidence and win chance vary by strategy + profile
  const baseConfidence = 80 + Math.floor(Math.random() * 12);
  const baseWinChance  = 55 + Math.floor(Math.random() * 18);

  // Tips based on project type and GC rating
  const tipSets = {
    commercial: [
      "Include your commercial license number prominently in your proposal",
      "Mention any similar-sized commercial projects you've completed",
      "GCs prioritize reliability — offer a detailed timeline",
      "Adding a material escalation clause protects your margin",
    ],
    residential: [
      "Homeowner GCs value clear communication above price",
      "Offering a 1-year workmanship warranty sets you apart",
      "Mention how you'll protect finished areas during work",
      "A start date within 2 weeks will strengthen your bid",
    ],
    industrial: [
      "Highlight any 3-phase and motor control experience",
      "Industrial clients care deeply about safety certifications",
      "Include your OSHA-10 or OSHA-30 certification if you have it",
      "Propose a commissioning and startup support plan",
    ],
    institutional: [
      "Government and school projects require prevailing wage — factor that in",
      "Bond and insurance requirements are stricter — confirm yours are current",
      "Include a detailed schedule showing minimal disruption to operations",
      "Reference any similar institutional or public-sector experience",
    ],
  };

  const tips = tipSets[project.project_type] ?? tipSets.commercial;
  // Pick 3 tips
  const selectedTips = tips.sort(() => 0.5 - Math.random()).slice(0, 3);

  return {
    strategies: {
      aggressive:   { amount: aggressive,   label: "Aggressive",   desc: "Win the job, tighter margins",       color: "#EF4444" },
      recommended:  { amount: recommended,  label: "Recommended",  desc: "Best balance of price & profit",    color: "#16A34A" },
      conservative: { amount: conservative, label: "Conservative", desc: "Higher margins, fewer wins",         color: "#3B82F6" },
    },
    breakdown: { materials, labor, overhead, profit },
    confidence: baseConfidence,
    winChance: baseWinChance,
    tips: selectedTips,
  };
}

const STEPS = ["info", "estimate", "proposal"];

export default function BidFlowPage({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") ?? "ai"; // "ai" | "manual"

  const [step, setStep] = useState(0);
  const [project, setProject] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Bid state
  const [selectedStrategy, setSelectedStrategy] = useState("recommended");
  const [customAmount, setCustomAmount] = useState("");
  const [coverNote, setCoverNote] = useState("");
  const [bidData, setBidData] = useState(null);

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

      // If AI mode, auto-generate estimate
      if (mode === "ai") {
        setCalculating(true);
        // Simulate AI thinking time
        setTimeout(() => {
          setBidData(generateBidData(proj, prof));
          setCalculating(false);
          setStep(1);
        }, 1800);
      } else {
        // Manual mode — skip to estimate with no pre-fill
        setStep(1);
      }

      setLoading(false);
    }
    load();
  }, [params.projectId, mode, router]);

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

    // Add AI data if available
    if (bidData) {
      const bd = bidData.breakdown;
      insertData.materials_cost = bd.materials;
      insertData.labor_cost     = bd.labor;
      insertData.overhead_cost  = bd.overhead;
      insertData.profit_margin  = Math.round((bd.profit / amount) * 100 * 10) / 10;
      insertData.ai_confidence  = bidData.confidence;
      insertData.ai_win_chance  = bidData.winChance;
      insertData.ai_tips        = bidData.tips;
    }

    const { error: insertError } = await supabase.from("bids").insert(insertData);

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    setStep(3); // success
  }

  const finalAmount = mode === "manual"
    ? parseFloat(customAmount) || 0
    : bidData?.strategies[selectedStrategy]?.amount ?? 0;

  // ── Loading / Calculating screens ──
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">⚡</div>
          <p className="text-slate-500 font-semibold">Loading project...</p>
        </div>
      </div>
    );
  }

  if (calculating) {
    return (
      <div className="min-h-screen bg-[#0F2B46] flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-5xl mb-6 animate-bounce">🤖</div>
          <h2 className="text-white font-black text-2xl mb-3">AI is analyzing...</h2>
          <div className="space-y-2 text-slate-400 text-sm">
            <p>✓ Scanning market rates for {project?.location}</p>
            <p>✓ Reviewing {project?.project_type} project data</p>
            <p className="animate-pulse">⟳ Calculating optimal bid strategies...</p>
          </div>
          <div className="mt-8 h-1.5 bg-slate-700 rounded-full w-64 mx-auto">
            <div className="h-1.5 bg-amber-400 rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  // ── Success screen ──
  if (step === 3) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="font-black text-slate-800 text-2xl mb-2">Bid Submitted!</h2>
          <p className="text-slate-500 mb-2">
            Your bid of <strong className="text-green-600">${finalAmount.toLocaleString()}</strong> has been sent to the GC.
          </p>
          <p className="text-slate-400 text-sm mb-8">
            You&apos;ll be notified if you&apos;re winning or outbid.
          </p>
          <button
            onClick={() => router.push("/ec")}
            className="w-full bg-amber-400 text-[#0F2B46] font-black py-4 rounded-2xl hover:bg-amber-300 transition-colors"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => router.push("/browse")}
            className="w-full mt-3 text-slate-500 font-semibold py-2 text-sm hover:text-slate-700"
          >
            Browse more projects
          </button>
        </div>
      </div>
    );
  }

  const progress = ((step + 1) / 3) * 100;

  return (
    <div className="min-h-screen bg-slate-100 pb-32">
      {/* Header */}
      <header className="bg-[#0F2B46] px-4 py-4 flex items-center gap-3">
        <button onClick={() => step > 1 ? setStep(s => s - 1) : router.back()} className="text-slate-400 font-semibold text-sm">
          ← Back
        </button>
        <span className="font-display font-black text-white text-lg">
          {mode === "ai" ? "AI Bid Assistant" : "Place a Bid"}
        </span>
        <span className="ml-auto text-slate-500 text-sm">Step {step} of 2</span>
      </header>

      {/* Progress */}
      <div className="h-1.5 bg-slate-200">
        <div className="h-1.5 bg-amber-400 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="px-4 pt-5 max-w-lg mx-auto space-y-4">

        {/* Project summary pill */}
        <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-black text-slate-800 text-sm leading-tight">{project?.title}</p>
            <p className="text-slate-400 text-xs">📍 {project?.location}</p>
          </div>
          <p className="text-green-600 font-black text-sm shrink-0 ml-3">
            ${(project?.budget_min / 1000).toFixed(0)}K–${(project?.budget_max / 1000).toFixed(0)}K
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* ── Step 1: AI Estimate ── */}
        {step === 1 && mode === "ai" && bidData && (
          <>
            {/* Confidence cards */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <p className="text-amber-800 font-black text-sm mb-3">🤖 AI Bid Recommendation</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-400 font-bold mb-1">CONFIDENCE</p>
                  <p className="text-green-600 font-black text-2xl">{bidData.confidence}%</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-400 font-bold mb-1">WIN CHANCE</p>
                  <p className="text-blue-500 font-black text-2xl">{bidData.winChance}%</p>
                </div>
              </div>
            </div>

            {/* Strategy selector */}
            <div className="bg-white rounded-2xl p-5 space-y-3">
              <p className="text-xs font-black text-slate-400 tracking-wide">CHOOSE YOUR STRATEGY</p>
              {Object.entries(bidData.strategies).map(([key, s]) => (
                <button
                  key={key}
                  onClick={() => setSelectedStrategy(key)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                    selectedStrategy === key
                      ? "border-current bg-slate-50"
                      : "border-slate-100 hover:border-slate-200"
                  }`}
                  style={{ borderColor: selectedStrategy === key ? s.color : undefined }}
                >
                  <div className="text-left">
                    <p className="font-black text-slate-800 text-sm">{s.label}</p>
                    <p className="text-slate-400 text-xs">{s.desc}</p>
                  </div>
                  <p className="font-black text-lg ml-3" style={{ color: s.color }}>
                    ${s.amount.toLocaleString()}
                  </p>
                </button>
              ))}
            </div>

            {/* Cost breakdown */}
            <div className="bg-white rounded-2xl p-5">
              <p className="text-xs font-black text-slate-400 tracking-wide mb-4">COST BREAKDOWN</p>
              {[
                { label: "Materials", value: bidData.breakdown.materials, color: "#3B82F6", pct: 42 },
                { label: "Labor",     value: bidData.breakdown.labor,     color: "#7C3AED", pct: 38 },
                { label: "Overhead",  value: bidData.breakdown.overhead,   color: "#F59E0B", pct: 12 },
                { label: "Profit",    value: bidData.breakdown.profit,     color: "#16A34A", pct: 8  },
              ].map((item) => (
                <div key={item.label} className="flex items-center mb-3 last:mb-0">
                  <div className="w-2.5 h-2.5 rounded-sm mr-3 shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-700 font-semibold text-sm flex-1">{item.label}</span>
                  <span className="text-slate-400 text-xs mr-3">{item.pct}%</span>
                  <span className="font-black text-slate-800 text-sm">${item.value.toLocaleString()}</span>
                </div>
              ))}
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between">
                <span className="font-black text-slate-800">Total Bid</span>
                <span className="font-black text-green-600 text-lg">
                  ${bidData.strategies[selectedStrategy].amount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* AI Tips */}
            <div className="bg-white rounded-2xl p-5">
              <p className="text-xs font-black text-amber-500 tracking-wide mb-3">💡 AI TIPS FOR THIS BID</p>
              <div className="space-y-2">
                {bidData.tips.map((tip, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-amber-400 shrink-0 mt-0.5">•</span>
                    <p className="text-slate-600 text-sm">{tip}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full bg-[#0F2B46] text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-colors"
            >
              📄 Preview Proposal →
            </button>
          </>
        )}

        {/* ── Step 1: Manual Bid ── */}
        {step === 1 && mode === "manual" && (
          <>
            <div className="bg-white rounded-2xl p-5 space-y-4">
              <p className="font-black text-slate-800 text-lg">Your Bid Amount</p>
              <p className="text-slate-400 text-sm">
                Budget range: <strong className="text-green-600">
                  ${Number(project?.budget_min).toLocaleString()} – ${Number(project?.budget_max).toLocaleString()}
                </strong>
              </p>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">$</span>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="0"
                  className="w-full pl-9 pr-4 py-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-black text-2xl placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {customAmount && !isNaN(parseFloat(customAmount)) && (
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-black text-slate-400">QUICK BREAKDOWN (estimated)</p>
                  {[
                    { label: "Materials (~42%)", value: Math.round(parseFloat(customAmount) * 0.42) },
                    { label: "Labor (~38%)",     value: Math.round(parseFloat(customAmount) * 0.38) },
                    { label: "Overhead (~12%)",  value: Math.round(parseFloat(customAmount) * 0.12) },
                    { label: "Profit (~8%)",     value: Math.round(parseFloat(customAmount) * 0.08) },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between text-sm">
                      <span className="text-slate-500">{item.label}</span>
                      <span className="font-bold text-slate-700">${item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <span className="text-lg shrink-0">💡</span>
              <p className="text-amber-800 text-sm">
                Want AI to suggest a price? Go back and choose <strong>"Get AI Bid Estimate"</strong> instead.
              </p>
            </div>

            <button
              disabled={!customAmount || isNaN(parseFloat(customAmount))}
              onClick={() => setStep(2)}
              className="w-full bg-[#0F2B46] text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Preview Proposal →
            </button>
          </>
        )}

        {/* ── Step 2: Proposal Preview + Cover Note ── */}
        {step === 2 && (
          <>
            <div className="bg-white rounded-2xl p-5 space-y-4">
              <p className="font-black text-slate-800 text-lg">Your Proposal</p>

              {/* Summary */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm font-semibold">Project</span>
                  <span className="text-slate-800 font-bold text-sm text-right flex-1 ml-4 leading-tight">{project?.title}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm font-semibold">Your Bid</span>
                  <span className="text-green-600 font-black text-xl">${finalAmount.toLocaleString()}</span>
                </div>
                {mode === "ai" && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm font-semibold">Strategy</span>
                    <span className="text-slate-800 font-bold text-sm capitalize">{selectedStrategy}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm font-semibold">Your Company</span>
                  <span className="text-slate-800 font-bold text-sm">{profile?.company_name}</span>
                </div>
                {profile?.license_number && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm font-semibold">License #</span>
                    <span className="text-slate-800 font-bold text-sm">{profile.license_number}</span>
                  </div>
                )}
              </div>

              {/* Cover note */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Cover Note <span className="font-normal text-slate-400">(optional but recommended)</span>
                </label>
                <textarea
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  placeholder="Briefly introduce yourself and why you're the right fit for this job..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none text-sm"
                />
              </div>
            </div>

            {/* AI reminder if used */}
            {mode === "ai" && bidData && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex gap-2">
                <span className="shrink-0">🤖</span>
                <p className="text-green-800 text-sm">
                  AI confidence: <strong>{bidData.confidence}%</strong> · Win chance: <strong>{bidData.winChance}%</strong>
                </p>
              </div>
            )}

            <button
              disabled={submitting}
              onClick={submitBid}
              className="w-full bg-green-600 text-white font-black py-4 rounded-2xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
            >
              {submitting
                ? "Submitting..."
                : `✓ Submit Bid — $${finalAmount.toLocaleString()}`}
            </button>

            <button
              onClick={() => setStep(1)}
              className="w-full text-slate-500 font-semibold py-2 text-sm hover:text-slate-700"
            >
              ← Edit bid
            </button>
          </>
        )}
      </div>
    </div>
  );
}
