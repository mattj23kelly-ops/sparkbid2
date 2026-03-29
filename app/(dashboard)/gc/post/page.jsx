"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PROJECT_TYPES = ["Commercial", "Residential", "Industrial", "Institutional"];

const COMMON_TAGS = [
  "Rewiring", "Panel Upgrade", "LED Retrofit", "Solar / PV",
  "EV Chargers", "Fire Alarm", "Generator", "Low Voltage",
  "New Construction", "Tenant Buildout", "Emergency",
];

const ACCEPTED_TYPES = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/jpg": "JPG",
  "image/webp": "WebP",
};

export default function PostProjectPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(0); // 0 = blueprint, 1 = details, 2 = review
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Blueprint state
  const [blueprintFile, setBlueprintFile] = useState(null);
  const [blueprintPreview, setBlueprintPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [aiFilledFields, setAiFilledFields] = useState([]); // track which fields AI filled

  // AI scope helper
  const [aiScopeLoading, setAiScopeLoading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    location: "",
    budgetMin: "",
    budgetMax: "",
    bidDeadline: "",
    projectType: "",
    squareFootage: "",
    stories: "",
    scopeOfWork: "",
    tags: [],
  });

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleTag(tag) {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  }

  // ── Blueprint file selection ──
  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    loadFile(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    loadFile(file);
  }

  function loadFile(file) {
    if (!ACCEPTED_TYPES[file.type]) {
      setAnalyzeError("Please upload a PDF, PNG, or JPG file.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setAnalyzeError("File must be under 20MB.");
      return;
    }
    setAnalyzeError("");
    setBlueprintFile(file);

    // Show image preview for image files
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setBlueprintPreview(url);
    } else {
      setBlueprintPreview(null);
    }
  }

  // ── AI Blueprint Analysis ──
  async function analyzeBlueprint() {
    if (!blueprintFile) return;
    setAnalyzing(true);
    setAnalyzeError("");

    try {
      // Convert file to base64
      const base64 = await fileToBase64(blueprintFile);

      const res = await fetch("/api/analyze-blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: base64,
          mediaType: blueprintFile.type,
          fileName: blueprintFile.name,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        // If no API key yet, show a friendly message
        if (json.error?.includes("ANTHROPIC_API_KEY")) {
          setAnalyzeError("Add your ANTHROPIC_API_KEY to .env.local to enable AI analysis.");
        } else {
          setAnalyzeError(json.error ?? "Analysis failed. You can still fill in the form manually.");
        }
        setStep(1);
        return;
      }

      const d = json.data;
      const filled = [];

      // Auto-fill form fields from AI response
      setForm((prev) => {
        const next = { ...prev };
        if (d.title)          { next.title = d.title;                       filled.push("title");         }
        if (d.location)       { next.location = d.location;                 filled.push("location");      }
        if (d.project_type)   { next.projectType = capitalize(d.project_type); filled.push("projectType"); }
        if (d.square_footage) { next.squareFootage = String(d.square_footage); filled.push("squareFootage"); }
        if (d.stories)        { next.stories = String(d.stories);           filled.push("stories");       }
        if (d.scope_of_work)  { next.scopeOfWork = d.scope_of_work;         filled.push("scopeOfWork");   }
        if (d.tags?.length)   { next.tags = d.tags;                         filled.push("tags");          }
        return next;
      });

      setAiFilledFields(filled);
      setStep(1);

    } catch (err) {
      setAnalyzeError("Something went wrong. You can fill in the details manually.");
      setStep(1);
    } finally {
      setAnalyzing(false);
    }
  }

  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : str;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Strip the data URL prefix (e.g. "data:image/png;base64,")
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── AI Scope helper (for manual scope writing) ──
  function handleAiScope() {
    if (!form.title && !form.projectType) return;
    setAiScopeLoading(true);
    setTimeout(() => {
      const templates = {
        commercial: `Complete electrical scope for ${form.title || "the commercial project"}. Includes: service entrance and panel upgrade, branch circuit wiring throughout, LED lighting installation with controls, emergency/exit lighting, fire alarm rough-in, and final inspections. All work to meet NEC and local code requirements.`,
        residential: `Full electrical scope for ${form.title || "the residential project"}. Includes: main panel upgrade, rewiring of living areas, kitchen and bathroom circuits, outdoor GFCI outlets, smoke/CO detector installation, and utility coordination. Permit and inspection by licensed electrician.`,
        industrial: `Industrial electrical installation for ${form.title || "the project"}. Scope: 3-phase power distribution, motor controls, panel and MCC installation, conduit and cable tray systems, LED high-bay lighting, grounding and bonding, and startup/commissioning support.`,
        institutional: `Electrical scope for ${form.title || "the institutional project"}. Includes: service upgrade, classroom/office branch circuits, LED lighting with daylight controls, emergency power system, fire alarm system, low-voltage infrastructure, and code compliance throughout.`,
      };
      const scope = templates[form.projectType?.toLowerCase()] ?? templates.commercial;
      update("scopeOfWork", scope);
      setAiScopeLoading(false);
    }, 1000);
  }

  function canProceedStep1() {
    return (
      form.title.trim() &&
      form.location.trim() &&
      form.budgetMin &&
      form.budgetMax &&
      form.bidDeadline &&
      form.projectType &&
      form.scopeOfWork.trim()
    );
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { error: insertError } = await supabase.from("projects").insert({
      gc_id: user.id,
      title: form.title.trim(),
      location: form.location.trim(),
      budget_min: parseFloat(form.budgetMin),
      budget_max: parseFloat(form.budgetMax),
      bid_deadline: form.bidDeadline,
      project_type: form.projectType.toLowerCase(),
      square_footage: form.squareFootage ? parseInt(form.squareFootage) : null,
      stories: form.stories ? parseInt(form.stories) : null,
      scope_of_work: form.scopeOfWork.trim(),
      tags: form.tags,
      status: "open",
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push("/gc");
    router.refresh();
  }

  const totalSteps = 3; // 0, 1, 2
  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-[#0F2B46] px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => step === 0 ? router.back() : setStep(s => s - 1)}
          className="text-slate-400 font-semibold text-sm"
        >
          ← Back
        </button>
        <span className="font-display font-black text-white text-lg">Post a Project</span>
        <span className="ml-auto text-slate-500 text-sm font-medium">
          Step {step + 1} of {totalSteps}
        </span>
      </header>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-200">
        <div
          className="h-1.5 bg-blue-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="px-4 py-6 pb-32 max-w-lg mx-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-5">
            {error}
          </div>
        )}

        {/* ── Step 0: Blueprint Upload ── */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-black text-slate-800">Upload Blueprint</h2>
              <p className="text-slate-400 text-sm">
                AI will read your plans and fill in the job details automatically
              </p>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => !blueprintFile && fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                blueprintFile
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-300 bg-white hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!blueprintFile ? (
                <>
                  <div className="text-5xl mb-3">📐</div>
                  <p className="font-black text-slate-700 text-base mb-1">
                    Drop your blueprint here
                  </p>
                  <p className="text-slate-400 text-sm mb-4">
                    or tap to browse files
                  </p>
                  <p className="text-slate-300 text-xs">
                    Supports PDF, PNG, JPG · Max 20MB
                  </p>
                </>
              ) : (
                <div className="space-y-3">
                  {/* Image preview */}
                  {blueprintPreview ? (
                    <img
                      src={blueprintPreview}
                      alt="Blueprint preview"
                      className="max-h-48 mx-auto rounded-xl object-contain"
                    />
                  ) : (
                    <div className="text-5xl">📄</div>
                  )}
                  <p className="font-bold text-blue-700 text-sm">{blueprintFile.name}</p>
                  <p className="text-slate-400 text-xs">
                    {(blueprintFile.size / 1024 / 1024).toFixed(1)} MB ·{" "}
                    {ACCEPTED_TYPES[blueprintFile.type]}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setBlueprintFile(null);
                      setBlueprintPreview(null);
                      setAnalyzeError("");
                    }}
                    className="text-xs text-red-400 hover:text-red-600 font-semibold"
                  >
                    Remove file
                  </button>
                </div>
              )}
            </div>

            {analyzeError && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
                ⚠️ {analyzeError}
              </div>
            )}

            {/* Analyze button */}
            {blueprintFile && (
              <button
                onClick={analyzeBlueprint}
                disabled={analyzing}
                className="w-full bg-amber-400 text-[#0F2B46] font-black py-4 rounded-2xl hover:bg-amber-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {analyzing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⟳</span> AI is reading your blueprint...
                  </span>
                ) : (
                  "🤖 Analyze Blueprint with AI →"
                )}
              </button>
            )}

            {/* Skip option */}
            <button
              onClick={() => setStep(1)}
              className="w-full text-slate-400 font-semibold py-2 text-sm hover:text-slate-600 transition-colors"
            >
              Skip — fill in details manually
            </button>

            {/* Info chips */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              {[
                { icon: "🏗️", label: "Project type" },
                { icon: "📐", label: "Square footage" },
                { icon: "📝", label: "Scope of work" },
              ].map((item) => (
                <div key={item.label} className="bg-white rounded-xl p-3 text-center border border-slate-100">
                  <div className="text-xl mb-1">{item.icon}</div>
                  <p className="text-xs text-slate-500 font-semibold">{item.label}</p>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-slate-400">
              AI extracts these fields automatically from your plans
            </p>
          </div>
        )}

        {/* ── Step 1: Project Details ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-black text-slate-800">Project Details</h2>
              <p className="text-slate-400 text-sm">
                {aiFilledFields.length > 0
                  ? `✨ AI filled in ${aiFilledFields.length} fields — review and complete the rest`
                  : "Fields marked * are required"}
              </p>
            </div>

            {/* AI filled banner */}
            {aiFilledFields.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-2">
                <span>🤖</span>
                <p className="text-amber-800 text-sm">
                  AI auto-filled: {aiFilledFields.map(f => ({
                    title: "title", location: "location", projectType: "project type",
                    squareFootage: "sq footage", stories: "stories",
                    scopeOfWork: "scope", tags: "tags"
                  }[f] ?? f)).join(", ")}. Review and adjust as needed.
                </p>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Project Title *
                {aiFilledFields.includes("title") && <AiBadge />}
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Office Building Rewiring — 3rd Floor"
                className={inputClass(aiFilledFields.includes("title"))}
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Location *
                {aiFilledFields.includes("location") && <AiBadge />}
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                placeholder="e.g. Albany, NY"
                className={inputClass(aiFilledFields.includes("location"))}
              />
            </div>

            {/* Budget */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Budget Range * <span className="font-normal text-slate-400">(in USD)</span>
              </label>
              <div className="flex gap-3 items-center">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">$</span>
                  <input
                    type="number"
                    value={form.budgetMin}
                    onChange={(e) => update("budgetMin", e.target.value)}
                    placeholder="Min"
                    className="w-full pl-7 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <span className="text-slate-400 font-bold">—</span>
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">$</span>
                  <input
                    type="number"
                    value={form.budgetMax}
                    onChange={(e) => update("budgetMax", e.target.value)}
                    placeholder="Max"
                    className="w-full pl-7 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>
            </div>

            {/* Bid Deadline */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Bid Deadline *
              </label>
              <input
                type="date"
                value={form.bidDeadline}
                onChange={(e) => update("bidDeadline", e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Project Type */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Project Type *
                {aiFilledFields.includes("projectType") && <AiBadge />}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PROJECT_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => update("projectType", type)}
                    className={`py-3 rounded-xl text-sm font-bold border transition-all ${
                      form.projectType === type
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Size */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Sq Footage
                  {aiFilledFields.includes("squareFootage") && <AiBadge />}
                </label>
                <input
                  type="number"
                  value={form.squareFootage}
                  onChange={(e) => update("squareFootage", e.target.value)}
                  placeholder="e.g. 5000"
                  className={inputClass(aiFilledFields.includes("squareFootage"))}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Stories
                  {aiFilledFields.includes("stories") && <AiBadge />}
                </label>
                <input
                  type="number"
                  value={form.stories}
                  onChange={(e) => update("stories", e.target.value)}
                  placeholder="e.g. 2"
                  className={inputClass(aiFilledFields.includes("stories"))}
                />
              </div>
            </div>

            {/* Scope of Work */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Scope of Work *
                {aiFilledFields.includes("scopeOfWork") && <AiBadge />}
              </label>
              <textarea
                value={form.scopeOfWork}
                onChange={(e) => update("scopeOfWork", e.target.value)}
                placeholder="Describe the electrical work needed in detail..."
                rows={5}
                className={`${inputClass(aiFilledFields.includes("scopeOfWork"))} resize-none`}
              />
              {!aiFilledFields.includes("scopeOfWork") && (
                <button
                  onClick={handleAiScope}
                  disabled={aiScopeLoading || (!form.title && !form.projectType)}
                  className="mt-2 w-full bg-amber-50 border border-amber-200 text-amber-800 font-bold py-3 rounded-xl text-sm hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aiScopeLoading ? "✍️ Writing scope..." : "🤖 AI: Help me write the scope"}
                </button>
              )}
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Tags
                {aiFilledFields.includes("tags") && <AiBadge />}
              </label>
              <div className="flex flex-wrap gap-2">
                {COMMON_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      form.tags.includes(tag)
                        ? "bg-slate-700 text-white border-slate-700"
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <button
              disabled={!canProceedStep1()}
              onClick={() => setStep(2)}
              className="w-full bg-blue-500 text-white font-bold py-4 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Review Project →
            </button>
          </div>
        )}

        {/* ── Step 2: Review ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-black text-slate-800">Review & Post</h2>
              <p className="text-slate-400 text-sm">Double-check before publishing</p>
            </div>

            <div className="bg-white rounded-2xl p-5 space-y-4 border border-slate-100">
              <div className="flex items-start justify-between">
                <h3 className="font-black text-slate-800 text-lg leading-tight flex-1 pr-3">
                  {form.title}
                </h3>
                <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-lg bg-blue-50 text-blue-600">
                  {form.projectType}
                </span>
              </div>

              <p className="text-slate-400 text-sm">📍 {form.location}</p>

              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-slate-400 font-semibold">BUDGET</p>
                  <p className="text-green-600 font-black text-xl">
                    ${Number(form.budgetMin).toLocaleString()} – ${Number(form.budgetMax).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold">BID DEADLINE</p>
                  <p className="font-bold text-slate-800">
                    {new Date(form.bidDeadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              </div>

              {(form.squareFootage || form.stories) && (
                <div className="flex gap-3">
                  {form.squareFootage && (
                    <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center">
                      <p className="font-black text-slate-800">{Number(form.squareFootage).toLocaleString()}</p>
                      <p className="text-xs text-slate-400">Sq Ft</p>
                    </div>
                  )}
                  {form.stories && (
                    <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center">
                      <p className="font-black text-slate-800">{form.stories}</p>
                      <p className="text-xs text-slate-400">Stories</p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <p className="text-xs text-slate-400 font-bold mb-1">SCOPE OF WORK</p>
                <p className="text-slate-600 text-sm leading-relaxed">{form.scopeOfWork}</p>
              </div>

              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.tags.map((tag) => (
                    <span key={tag} className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-600 rounded-lg">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {blueprintFile && (
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <span className="text-slate-400 text-sm">📎</span>
                  <span className="text-slate-500 text-xs">{blueprintFile.name} attached</span>
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-blue-800 text-sm font-bold mb-1">📢 What happens next?</p>
              <p className="text-blue-700 text-sm">
                Your project will be visible to all verified electricians in the area immediately.
              </p>
            </div>

            <button
              disabled={loading}
              onClick={handleSubmit}
              className="w-full bg-amber-400 text-[#0F2B46] font-black py-4 rounded-2xl hover:bg-amber-300 transition-colors disabled:opacity-50 text-base"
            >
              {loading ? "Posting..." : "🚀 Post Project Now"}
            </button>

            <button
              onClick={() => setStep(1)}
              className="w-full text-slate-500 font-semibold py-2 text-sm hover:text-slate-700"
            >
              ← Edit details
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Small "AI filled" badge shown next to label
function AiBadge() {
  return (
    <span className="ml-2 text-xs font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md">
      🤖 AI
    </span>
  );
}

// Input styling — highlighted if AI filled it
function inputClass(isAiFilled) {
  return `w-full px-4 py-3 rounded-xl border text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
    isAiFilled
      ? "border-amber-300 bg-amber-50"
      : "border-slate-200 bg-white"
  }`;
}
