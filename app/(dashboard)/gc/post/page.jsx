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

  const [blueprintFile, setBlueprintFile] = useState(null);
  const [blueprintPreview, setBlueprintPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [aiFilledFields, setAiFilledFields] = useState([]);
  const [aiScopeLoading, setAiScopeLoading] = useState(false);

  const [form, setForm] = useState({
    title: "", location: "", budgetMin: "", budgetMax: "",
    bidDeadline: "", projectType: "", squareFootage: "",
    stories: "", scopeOfWork: "", tags: [],
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
    if (file.type.startsWith("image/")) {
      setBlueprintPreview(URL.createObjectURL(file));
    } else {
      setBlueprintPreview(null);
    }
  }

  async function analyzeBlueprint() {
    if (!blueprintFile) return;
    setAnalyzing(true);
    setAnalyzeError("");

    try {
      const base64 = await fileToBase64(blueprintFile);
      const res = await fetch("/api/analyze-blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: base64, mediaType: blueprintFile.type, fileName: blueprintFile.name }),
      });
      const json = await res.json();

      if (!res.ok || json.error) {
        if (json.error?.includes("ANTHROPIC_API_KEY")) {
          setAnalyzeError("Add your ANTHROPIC_API_KEY to .env.local to enable AI analysis.");
        } else {
          setAnalyzeError(json.error ?? "Analysis failed. You can still fill in the form manually.");
        }
        setStep(1);
        return;
      }

      // New analyzer returns `takeoff`, legacy returned `data` — support both.
      const t = json.takeoff ?? json.data ?? {};
      const filled = [];

      setForm((prev) => {
        const next = { ...prev };
        if (t.title)           { next.title = t.title;                           filled.push("title");         }
        if (t.location)        { next.location = t.location;                     filled.push("location");      }
        if (t.project_type)    { next.projectType = capitalize(t.project_type); filled.push("projectType"); }
        if (t.square_footage)  { next.squareFootage = String(t.square_footage); filled.push("squareFootage"); }
        if (t.stories)         { next.stories = String(t.stories);               filled.push("stories");       }
        const scope = t.scope_summary ?? t.scope_of_work;
        if (scope)             { next.scopeOfWork = scope;                       filled.push("scopeOfWork");   }
        if (t.tags?.length)    { next.tags = t.tags;                             filled.push("tags");          }
        return next;
      });

      setAiFilledFields(filled);
      setStep(1);
    } catch {
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
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

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
    }, 800);
  }

  function canProceedStep1() {
    return (
      form.title.trim() && form.location.trim() && form.budgetMin &&
      form.budgetMax && form.bidDeadline && form.projectType && form.scopeOfWork.trim()
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

  const totalSteps = 3;
  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <div className="max-w-3xl mx-auto px-6 md:px-8 py-8">
      {/* Header + progress */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <button
            onClick={() => step === 0 ? router.back() : setStep(s => s - 1)}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">Post a project</h1>
          <p className="text-sm text-slate-500">Share scope &amp; budget so ECs can bid.</p>
        </div>
        <span className="text-xs text-slate-500 shrink-0">Step {step + 1} of {totalSteps}</span>
      </div>

      <div className="h-1 bg-slate-200 rounded-full overflow-hidden my-4">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
      </div>

      {error && (
        <div className="card p-4 bg-red-50 border-red-100 text-sm text-red-700 mb-5">{error}</div>
      )}

      {/* ── Step 0: Blueprint upload ── */}
      {step === 0 && (
        <div className="space-y-5">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !blueprintFile && fileInputRef.current?.click()}
            className={`relative rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
              blueprintFile
                ? "border-brand-400 bg-brand-50"
                : "border-slate-300 bg-white hover:border-brand-300 hover:bg-brand-50"
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
                <UploadIcon className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <p className="font-semibold text-slate-900">Drop your plan sheet here</p>
                <p className="text-sm text-slate-500 mt-1">or click to browse</p>
                <p className="text-xs text-slate-400 mt-2">PDF · PNG · JPG · Max 20MB</p>
              </>
            ) : (
              <div className="space-y-3">
                {blueprintPreview ? (
                  <img
                    src={blueprintPreview}
                    alt="Blueprint preview"
                    className="max-h-44 mx-auto rounded-lg object-contain"
                  />
                ) : (
                  <FileIcon className="w-10 h-10 text-brand-500 mx-auto" />
                )}
                <p className="text-sm font-medium text-brand-700">{blueprintFile.name}</p>
                <p className="text-xs text-slate-500">
                  {(blueprintFile.size / 1024 / 1024).toFixed(1)} MB · {ACCEPTED_TYPES[blueprintFile.type]}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setBlueprintFile(null);
                    setBlueprintPreview(null);
                    setAnalyzeError("");
                  }}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Remove file
                </button>
              </div>
            )}
          </div>

          {analyzeError && (
            <div className="card p-4 bg-amber-50 border-amber-100 text-sm text-amber-800">{analyzeError}</div>
          )}

          {blueprintFile && (
            <button
              onClick={analyzeBlueprint}
              disabled={analyzing}
              className="btn btn-primary w-full"
            >
              {analyzing ? "AI is reading your blueprint…" : "Analyze with AI →"}
            </button>
          )}

          <button
            onClick={() => setStep(1)}
            className="btn btn-ghost w-full"
          >
            Skip — fill in details manually
          </button>
        </div>
      )}

      {/* ── Step 1: Project details ── */}
      {step === 1 && (
        <div className="space-y-5">
          {aiFilledFields.length > 0 && (
            <div className="card p-4 bg-brand-50 border-brand-100 text-sm text-brand-800">
              AI auto-filled: {aiFilledFields.map(f => ({
                title: "title", location: "location", projectType: "project type",
                squareFootage: "sq footage", stories: "stories",
                scopeOfWork: "scope", tags: "tags"
              }[f] ?? f)).join(", ")}. Review and adjust as needed.
            </div>
          )}

          <Field label="Project title" required ai={aiFilledFields.includes("title")}>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. Office Building Rewiring — 3rd Floor"
              className={inputClass(aiFilledFields.includes("title"))}
            />
          </Field>

          <Field label="Location" required ai={aiFilledFields.includes("location")}>
            <input
              type="text"
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="e.g. Albany, NY"
              className={inputClass(aiFilledFields.includes("location"))}
            />
          </Field>

          <Field label="Budget range (USD)" required>
            <div className="flex gap-3 items-center">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  value={form.budgetMin}
                  onChange={(e) => update("budgetMin", e.target.value)}
                  placeholder="Min"
                  className="input !pl-7"
                />
              </div>
              <span className="text-slate-400">—</span>
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  value={form.budgetMax}
                  onChange={(e) => update("budgetMax", e.target.value)}
                  placeholder="Max"
                  className="input !pl-7"
                />
              </div>
            </div>
          </Field>

          <Field label="Bid deadline" required>
            <input
              type="date"
              value={form.bidDeadline}
              onChange={(e) => update("bidDeadline", e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="input"
            />
          </Field>

          <Field label="Project type" required ai={aiFilledFields.includes("projectType")}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {PROJECT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => update("projectType", type)}
                  className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${
                    form.projectType === type
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Sq footage" ai={aiFilledFields.includes("squareFootage")}>
              <input
                type="number"
                value={form.squareFootage}
                onChange={(e) => update("squareFootage", e.target.value)}
                placeholder="e.g. 5,000"
                className={inputClass(aiFilledFields.includes("squareFootage"))}
              />
            </Field>
            <Field label="Stories" ai={aiFilledFields.includes("stories")}>
              <input
                type="number"
                value={form.stories}
                onChange={(e) => update("stories", e.target.value)}
                placeholder="e.g. 2"
                className={inputClass(aiFilledFields.includes("stories"))}
              />
            </Field>
          </div>

          <Field label="Scope of work" required ai={aiFilledFields.includes("scopeOfWork")}>
            <textarea
              value={form.scopeOfWork}
              onChange={(e) => update("scopeOfWork", e.target.value)}
              placeholder="Describe the electrical work needed in detail…"
              rows={5}
              className={`${inputClass(aiFilledFields.includes("scopeOfWork"))} resize-none`}
            />
            {!aiFilledFields.includes("scopeOfWork") && (
              <button
                type="button"
                onClick={handleAiScope}
                disabled={aiScopeLoading || (!form.title && !form.projectType)}
                className="btn btn-ghost w-full mt-2 text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-100"
              >
                {aiScopeLoading ? "Writing…" : "AI: help me write the scope"}
              </button>
            )}
          </Field>

          <Field label="Tags" ai={aiFilledFields.includes("tags")}>
            <div className="flex flex-wrap gap-2">
              {COMMON_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`chip border transition-all ${
                    form.tags.includes(tag)
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </Field>

          <button
            disabled={!canProceedStep1()}
            onClick={() => setStep(2)}
            className="btn btn-primary w-full"
          >
            Review project →
          </button>
        </div>
      )}

      {/* ── Step 2: Review ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="card p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">{form.title}</h3>
              <span className="chip bg-brand-50 text-brand-700">{form.projectType}</span>
            </div>
            <p className="text-sm text-slate-500">{form.location}</p>

            <div className="flex items-end gap-8">
              <div>
                <p className="text-xs text-slate-500">Budget</p>
                <p className="text-lg font-semibold text-slate-900 tabular-nums">
                  ${Number(form.budgetMin).toLocaleString()} – ${Number(form.budgetMax).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Bid deadline</p>
                <p className="text-sm font-medium text-slate-900">
                  {new Date(form.bidDeadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            </div>

            {(form.squareFootage || form.stories) && (
              <div className="grid grid-cols-2 gap-3">
                {form.squareFootage && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Sq Ft</p>
                    <p className="font-semibold text-slate-900 tabular-nums">{Number(form.squareFootage).toLocaleString()}</p>
                  </div>
                )}
                {form.stories && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Stories</p>
                    <p className="font-semibold text-slate-900 tabular-nums">{form.stories}</p>
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Scope of work</p>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{form.scopeOfWork}</p>
            </div>

            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.tags.map((tag) => (
                  <span key={tag} className="chip bg-slate-100 text-slate-600">{tag}</span>
                ))}
              </div>
            )}

            {blueprintFile && (
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 text-xs text-slate-500">
                <FileIcon className="w-3.5 h-3.5" />
                <span>{blueprintFile.name} attached</span>
              </div>
            )}
          </div>

          <div className="card p-4 bg-brand-50 border-brand-100 text-sm text-brand-800">
            Your project will be visible to verified electricians in the area immediately.
          </div>

          <button
            disabled={loading}
            onClick={handleSubmit}
            className="btn btn-primary w-full"
          >
            {loading ? "Posting…" : "Post project"}
          </button>

          <button
            onClick={() => setStep(1)}
            className="btn btn-ghost w-full"
          >
            ← Edit details
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Atoms ─────────────────────────────────────────── */

function Field({ label, required, ai, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
        {ai && (
          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-brand-100 text-brand-700 rounded">
            AI filled
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function inputClass(isAiFilled) {
  return `input ${isAiFilled ? "!bg-brand-50 !border-brand-200" : ""}`;
}

function UploadIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function FileIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
