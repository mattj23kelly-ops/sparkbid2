"use client";

import { useState, useRef, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/ui/PageHeader";

const ACCEPTED = {
  "application/pdf": "PDF",
  "image/png":       "PNG",
  "image/jpeg":      "JPG",
  "image/jpg":       "JPG",
  "image/webp":      "WebP",
};

const STEPS = [
  { key: "upload",   label: "Upload plans" },
  { key: "takeoff",  label: "Review take-off" },
  { key: "estimate", label: "Price estimate" },
  { key: "save",     label: "Save & share" },
];

export default function EstimatorPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(0);
  const [error, setError] = useState("");

  // Step 1 — upload
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Step 2 — take-off
  const [takeoff, setTakeoff] = useState(null);   // { title, location, quantities: {...}, ... }

  // Step 3 — estimate
  const [params, setParams] = useState({ labor_rate: 95, overhead_pct: 12, profit_pct: 10, contingency_pct: 5 });
  const [generating, setGenerating] = useState(false);
  const [estimate, setEstimate] = useState(null); // { line_items, totals, ... }

  // Step 4 — save
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(null);

  /* ── file handling ─────────────────────────────────────── */
  function onPickFile(e)     { const f = e.target.files?.[0];    if (f) loadFile(f); }
  function onDrop(e)         { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) loadFile(f); }

  function loadFile(f) {
    setError("");
    if (!ACCEPTED[f.type]) return setError("Unsupported file. Use PDF, PNG, JPG, or WebP.");
    if (f.size > 20 * 1024 * 1024) return setError("File must be under 20 MB.");
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  async function analyze() {
    if (!file) return;
    setAnalyzing(true);
    setError("");
    try {
      const base64 = await toBase64(file);
      const res = await fetch("/api/analyze-blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: base64, mediaType: file.type, fileName: file.name }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error ?? "Analysis failed");
      }
      setTakeoff(json.takeoff);
      setStep(1);
    } catch (err) {
      setError(err.message || "Analysis failed. Check your ANTHROPIC_API_KEY.");
    } finally {
      setAnalyzing(false);
    }
  }

  /* ── estimate generation ───────────────────────────────── */
  async function generate() {
    if (!takeoff) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/generate-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ takeoff, ...params }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Failed to generate estimate");
      setEstimate(json);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  /* ── save ─────────────────────────────────────────────── */
  async function save() {
    if (!estimate || !takeoff) return;
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Insert takeoff
    const { data: toRow, error: toErr } = await supabase
      .from("takeoffs")
      .insert({
        owner_id:       user.id,
        source_file_name: file?.name ?? null,
        title:          takeoff.title,
        location:       takeoff.location,
        project_type:   takeoff.project_type,
        square_footage: takeoff.square_footage,
        stories:        takeoff.stories,
        scope_summary:  takeoff.scope_summary,
        quantities:     takeoff.quantities,
        ai_confidence:  takeoff.confidence,
        ai_model:       takeoff.ai_model,
        ai_notes:       takeoff.notes,
      })
      .select()
      .single();

    if (toErr) { setError(toErr.message); setSaving(false); return; }

    // 2. Insert estimate
    const t = estimate.totals;
    const { data: estRow, error: estErr } = await supabase
      .from("estimates")
      .insert({
        owner_id:          user.id,
        takeoff_id:        toRow.id,
        title:             takeoff.title ?? "Untitled Estimate",
        status:            "ready",
        materials_total:   t.materials_total,
        labor_hours:       t.labor_hours,
        labor_rate:        t.labor_rate,
        labor_total:       t.labor_total,
        overhead_pct:      t.overhead_pct,
        overhead_total:    t.overhead_total,
        profit_pct:        t.profit_pct,
        profit_total:      t.profit_total,
        contingency_pct:   t.contingency_pct,
        contingency_total: t.contingency_total,
        grand_total:       t.grand_total,
        assumptions:       estimate.assumptions ?? [],
      })
      .select()
      .single();

    if (estErr) { setError(estErr.message); setSaving(false); return; }

    // 3. Insert line items
    if (estimate.line_items?.length) {
      const rows = estimate.line_items.map((li) => ({
        estimate_id:    estRow.id,
        category:       li.category,
        item_key:       li.item_key,
        description:    li.description,
        quantity:       li.quantity,
        unit:           li.unit,
        material_cost:  li.material_cost,
        labor_hours:    li.labor_hours,
        line_material:  li.line_material,
        line_labor_hrs: li.line_labor_hrs,
        sort_order:     li.sort_order,
      }));
      const { error: liErr } = await supabase.from("estimate_line_items").insert(rows);
      if (liErr) { setError(liErr.message); setSaving(false); return; }
    }

    setSavedId(estRow.id);
    setSaving(false);
    setStep(3);
  }

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-8 py-8">
      <PageHeader
        title="New Estimate"
        subtitle="Upload plans, review the AI take-off, and produce a priced estimate in minutes."
      />

      <StepProgress step={step} />

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6">
        {step === 0 && (
          <UploadStep
            file={file} preview={preview} fileInputRef={fileInputRef}
            onPickFile={onPickFile} onDrop={onDrop}
            onRemove={() => { setFile(null); setPreview(null); }}
            analyzing={analyzing}
            onAnalyze={analyze}
          />
        )}

        {step === 1 && takeoff && (
          <TakeoffStep
            takeoff={takeoff}
            onChange={setTakeoff}
            onBack={() => setStep(0)}
            onNext={generate}
            generating={generating}
          />
        )}

        {step === 2 && estimate && (
          <EstimateStep
            takeoff={takeoff}
            estimate={estimate}
            params={params}
            onParamsChange={(next) => setParams(next)}
            onRecalc={generate}
            generating={generating}
            onBack={() => setStep(1)}
            onSave={save}
            saving={saving}
          />
        )}

        {step === 3 && (
          <SavedStep savedId={savedId} router={router} />
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════ */

function StepProgress({ step }) {
  return (
    <ol className="flex items-center gap-2 md:gap-4 text-sm">
      {STEPS.map((s, i) => {
        const state = i < step ? "done" : i === step ? "current" : "todo";
        return (
          <li key={s.key} className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
            <div className={`flex items-center gap-2 ${state === "todo" ? "text-slate-400" : "text-slate-900"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                state === "done"    ? "bg-brand-600 text-white"
                : state === "current" ? "bg-brand-100 text-brand-700 ring-2 ring-brand-600"
                : "bg-slate-100 text-slate-400"
              }`}>
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className="hidden md:inline font-medium truncate">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px ${state === "done" ? "bg-brand-500" : "bg-slate-200"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ── Step 1: upload ─────────────────────────────────────── */
function UploadStep({ file, preview, fileInputRef, onPickFile, onDrop, onRemove, analyzing, onAnalyze }) {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => !file && fileInputRef.current?.click()}
          className={`card p-10 text-center cursor-pointer transition-colors ${
            file ? "border-brand-300 bg-brand-50/30" : "hover:border-brand-300 hover:bg-brand-50/20"
          }`}
        >
          <input ref={fileInputRef} type="file"
                 accept=".pdf,.png,.jpg,.jpeg,.webp"
                 onChange={onPickFile} className="hidden" />
          {!file ? (
            <>
              <div className="mx-auto w-12 h-12 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center mb-4">
                <UploadIcon />
              </div>
              <p className="font-semibold text-slate-900">Drop a blueprint or plan sheet</p>
              <p className="text-sm text-slate-500 mt-1">or click to browse — PDF, PNG, JPG up to 20 MB</p>
            </>
          ) : (
            <div className="space-y-3">
              {preview
                ? <img src={preview} alt="preview" className="max-h-64 mx-auto rounded-lg" />
                : <div className="mx-auto w-12 h-12 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center"><FileIcon /></div>}
              <p className="font-medium text-slate-900">{file.name}</p>
              <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB · {ACCEPTED[file.type]}</p>
              <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-xs font-semibold text-slate-500 hover:text-red-600">
                Remove file
              </button>
            </div>
          )}
        </div>

        {file && (
          <button
            onClick={onAnalyze}
            disabled={analyzing}
            className="btn btn-primary w-full mt-4 !py-3"
          >
            {analyzing ? (
              <><Spinner /> Analyzing plans…</>
            ) : (
              <>Run AI take-off →</>
            )}
          </button>
        )}
      </div>

      <div className="md:col-span-1">
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">What you&apos;ll get</p>
          <ul className="space-y-3 text-sm text-slate-700">
            <li className="flex gap-2"><Bullet /> Device, fixture & panel counts</li>
            <li className="flex gap-2"><Bullet /> Conduit & wire footage estimates</li>
            <li className="flex gap-2"><Bullet /> Priced line items from your catalog</li>
            <li className="flex gap-2"><Bullet /> Materials, labor hours, O&amp;P rollup</li>
            <li className="flex gap-2"><Bullet /> Editable before you save</li>
          </ul>
          <p className="text-xs text-slate-500 mt-4 leading-relaxed">
            The AI flags anything it can&apos;t see clearly. You always review counts
            and unit prices before saving.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Step 2: takeoff review ─────────────────────────────── */
function TakeoffStep({ takeoff, onChange, onBack, onNext, generating }) {
  const q = takeoff.quantities ?? {};

  function updateMeta(field, value) { onChange({ ...takeoff, [field]: value }); }
  function updateQty(cat, idx, field, value) {
    const next = { ...q, [cat]: [...(q[cat] ?? [])] };
    next[cat][idx] = { ...next[cat][idx], [field]: value };
    onChange({ ...takeoff, quantities: next });
  }
  function removeRow(cat, idx) {
    const next = { ...q, [cat]: (q[cat] ?? []).filter((_, i) => i !== idx) };
    onChange({ ...takeoff, quantities: next });
  }
  function addRow(cat) {
    const defaults = cat === "panels"
      ? { name: "New panel", amps: 100, phases: 1, spaces: 20 }
      : cat === "conduit" || cat === "wire"
      ? { type: "New run", feet: 0 }
      : { type: "New item", count: 0 };
    const next = { ...q, [cat]: [...(q[cat] ?? []), defaults] };
    onChange({ ...takeoff, quantities: next });
  }

  return (
    <div className="space-y-6">
      {/* Project meta */}
      <div className="card p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Project</p>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Title">
            <input className="input" value={takeoff.title ?? ""}
                   onChange={(e) => updateMeta("title", e.target.value)} />
          </Field>
          <Field label="Location">
            <input className="input" value={takeoff.location ?? ""}
                   onChange={(e) => updateMeta("location", e.target.value)} />
          </Field>
          <Field label="Type">
            <select className="input" value={takeoff.project_type ?? ""}
                    onChange={(e) => updateMeta("project_type", e.target.value)}>
              <option value="">—</option>
              <option value="commercial">Commercial</option>
              <option value="residential">Residential</option>
              <option value="industrial">Industrial</option>
              <option value="institutional">Institutional</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Sq Ft">
              <input type="number" className="input" value={takeoff.square_footage ?? ""}
                     onChange={(e) => updateMeta("square_footage", parseInt(e.target.value) || null)} />
            </Field>
            <Field label="Stories">
              <input type="number" className="input" value={takeoff.stories ?? ""}
                     onChange={(e) => updateMeta("stories", parseInt(e.target.value) || null)} />
            </Field>
          </div>
        </div>
        {takeoff.scope_summary && (
          <div className="mt-4">
            <Field label="Scope summary">
              <textarea className="input min-h-[80px]" rows={3}
                        value={takeoff.scope_summary}
                        onChange={(e) => updateMeta("scope_summary", e.target.value)} />
            </Field>
          </div>
        )}
        {takeoff.confidence != null && (
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <span className="chip">AI confidence {Math.round(takeoff.confidence)}%</span>
            {takeoff.ai_model && <span>· model {takeoff.ai_model}</span>}
          </div>
        )}
        {takeoff.notes && (
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            <strong>AI note:</strong> {takeoff.notes}
          </div>
        )}
      </div>

      {/* Quantities */}
      <QtyTable
        title="Devices"            cat="devices"  rows={q.devices ?? []}
        columns={[
          { key: "type",     label: "Type",      flex: 2 },
          { key: "count",    label: "Count",     type: "number", flex: 1 },
          { key: "notes",    label: "Notes",     flex: 2 },
        ]}
        onUpdate={(i, f, v) => updateQty("devices", i, f, v)}
        onRemove={(i) => removeRow("devices", i)}
        onAdd={() => addRow("devices")}
      />

      <QtyTable
        title="Fixtures"           cat="fixtures" rows={q.fixtures ?? []}
        columns={[
          { key: "type",  label: "Type",  flex: 2 },
          { key: "count", label: "Count", type: "number", flex: 1 },
          { key: "notes", label: "Notes", flex: 2 },
        ]}
        onUpdate={(i, f, v) => updateQty("fixtures", i, f, v)}
        onRemove={(i) => removeRow("fixtures", i)}
        onAdd={() => addRow("fixtures")}
      />

      <QtyTable
        title="Panels / gear"      cat="panels"  rows={q.panels ?? []}
        columns={[
          { key: "name",   label: "Name",   flex: 2 },
          { key: "amps",   label: "Amps",   type: "number", flex: 1 },
          { key: "phases", label: "Phases", type: "number", flex: 1 },
          { key: "spaces", label: "Spaces", type: "number", flex: 1 },
        ]}
        onUpdate={(i, f, v) => updateQty("panels", i, f, v)}
        onRemove={(i) => removeRow("panels", i)}
        onAdd={() => addRow("panels")}
      />

      <QtyTable
        title="Conduit"            cat="conduit" rows={q.conduit ?? []}
        columns={[
          { key: "type", label: "Type", flex: 2 },
          { key: "feet", label: "Feet", type: "number", flex: 1 },
        ]}
        onUpdate={(i, f, v) => updateQty("conduit", i, f, v)}
        onRemove={(i) => removeRow("conduit", i)}
        onAdd={() => addRow("conduit")}
      />

      <QtyTable
        title="Wire"               cat="wire"     rows={q.wire ?? []}
        columns={[
          { key: "type", label: "Type", flex: 2 },
          { key: "feet", label: "Feet", type: "number", flex: 1 },
        ]}
        onUpdate={(i, f, v) => updateQty("wire", i, f, v)}
        onRemove={(i) => removeRow("wire", i)}
        onAdd={() => addRow("wire")}
      />

      {(q.systems?.length > 0 || q.assumptions?.length > 0) && (
        <div className="grid md:grid-cols-2 gap-6">
          {q.systems?.length > 0 && (
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Special systems</p>
              <div className="flex flex-wrap gap-2">
                {q.systems.map((s, i) => <span key={i} className="chip">{s}</span>)}
              </div>
            </div>
          )}
          {q.assumptions?.length > 0 && (
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Assumptions</p>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {q.assumptions.map((a, i) => <li key={i} className="flex gap-2"><Bullet /> {a}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <button onClick={onBack} className="btn btn-ghost">← Back</button>
        <button onClick={onNext} disabled={generating} className="btn btn-primary">
          {generating ? <><Spinner /> Pricing…</> : <>Price this estimate →</>}
        </button>
      </div>
    </div>
  );
}

function QtyTable({ title, rows, columns, onUpdate, onRemove, onAdd }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
        <p className="text-sm font-semibold text-slate-900">{title} <span className="text-slate-400 font-normal">({rows.length})</span></p>
        <button onClick={onAdd} className="btn btn-ghost !py-1 !px-2 text-xs">+ Add row</button>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-6 text-sm text-slate-400 italic">None detected. Add rows manually if needed.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="text-left font-medium text-slate-500 px-4 py-2 text-xs uppercase tracking-wider">
                    {c.label}
                  </th>
                ))}
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <Fragment key={i}>
                  <tr className="border-t border-slate-100">
                    {columns.map((c) => (
                      <td key={c.key} className="px-3 py-1.5 align-top">
                        <input
                          type={c.type === "number" ? "number" : "text"}
                          value={row[c.key] ?? ""}
                          onChange={(e) => onUpdate(i, c.key, c.type === "number" ? (parseInt(e.target.value) || 0) : e.target.value)}
                          className="w-full px-2 py-1.5 rounded-md border border-transparent hover:border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none text-sm"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right align-top">
                      <button onClick={() => onRemove(i)} className="text-slate-300 hover:text-red-500 text-sm p-1" aria-label="Remove">
                        ×
                      </button>
                    </td>
                  </tr>
                  {row.source_note && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={columns.length + 1} className="px-5 pb-2 pt-0 text-[11px] italic text-slate-500">
                        <span className="text-slate-400">From plan:</span> {row.source_note}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Step 3: estimate ───────────────────────────────────── */
function EstimateStep({ takeoff, estimate, params, onParamsChange, onRecalc, generating, onBack, onSave, saving }) {
  const t = estimate.totals;
  const misses = estimate.catalog_misses ?? [];

  const byCategory = useMemo(() => {
    const groups = {};
    for (const li of estimate.line_items) {
      (groups[li.category] ??= []).push(li);
    }
    return groups;
  }, [estimate.line_items]);

  const CATEGORY_LABELS = {
    device:   "Devices",
    fixture:  "Fixtures",
    panel:    "Panels / gear",
    conduit:  "Conduit",
    wire:     "Wire",
    other:    "Other",
    labor:    "Labor",
  };

  function updateParam(field, value) {
    onParamsChange({ ...params, [field]: Number(value) });
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {misses.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>{misses.length} line{misses.length !== 1 ? "s" : ""} need{misses.length === 1 ? "s" : ""} pricing.</strong>{" "}
            These items weren&apos;t in your catalog. They&apos;re shown below with $0 — add prices in your Catalog settings for faster future estimates.
          </div>
        )}

        {Object.entries(byCategory).map(([cat, lines]) => (
          <div key={cat} className="card overflow-hidden">
            <p className="px-5 py-3 text-sm font-semibold text-slate-900 border-b border-slate-200 bg-slate-50">
              {CATEGORY_LABELS[cat] ?? cat}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-slate-500">
                    <th className="text-left font-medium px-4 py-2">Description</th>
                    <th className="text-right font-medium px-4 py-2">Qty</th>
                    <th className="text-right font-medium px-4 py-2">Unit</th>
                    <th className="text-right font-medium px-4 py-2">Mat $/u</th>
                    <th className="text-right font-medium px-4 py-2">Hrs/u</th>
                    <th className="text-right font-medium px-4 py-2">Ext mat</th>
                    <th className="text-right font-medium px-4 py-2">Ext hrs</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((li, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-900">
                        {li.description}
                        {!li.priced && <span className="ml-2 chip bg-amber-100 text-amber-800">needs price</span>}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{li.quantity}</td>
                      <td className="px-4 py-2 text-right text-slate-500">{li.unit}</td>
                      <td className="px-4 py-2 text-right tabular-nums">${li.material_cost.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{li.labor_hours.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">${li.line_material.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">{li.line_labor_hrs.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar: totals & params */}
      <div className="lg:col-span-1">
        <div className="sticky top-6 space-y-4">
          <div className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Totals</p>
            <TotalsRow label="Materials"    value={t.materials_total} />
            <TotalsRow label={`Labor (${t.labor_hours.toFixed(1)} hrs × $${t.labor_rate}/hr)`} value={t.labor_total} />
            <Divider />
            <TotalsRow label={`Overhead (${t.overhead_pct}%)`}       value={t.overhead_total} muted />
            <TotalsRow label={`Profit (${t.profit_pct}%)`}           value={t.profit_total}   muted />
            <TotalsRow label={`Contingency (${t.contingency_pct}%)`} value={t.contingency_total} muted />
            <Divider />
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-semibold text-slate-900">Grand total</span>
              <span className="text-2xl font-bold tabular-nums text-slate-900">${t.grand_total.toLocaleString()}</span>
            </div>
          </div>

          <div className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Parameters</p>
            <div className="space-y-3">
              <SmallField label="Labor rate ($/hr)">
                <input type="number" step="1" className="input" value={params.labor_rate}
                       onChange={(e) => updateParam("labor_rate", e.target.value)} />
              </SmallField>
              <SmallField label="Overhead %">
                <input type="number" step="0.5" className="input" value={params.overhead_pct}
                       onChange={(e) => updateParam("overhead_pct", e.target.value)} />
              </SmallField>
              <SmallField label="Profit %">
                <input type="number" step="0.5" className="input" value={params.profit_pct}
                       onChange={(e) => updateParam("profit_pct", e.target.value)} />
              </SmallField>
              <SmallField label="Contingency %">
                <input type="number" step="0.5" className="input" value={params.contingency_pct}
                       onChange={(e) => updateParam("contingency_pct", e.target.value)} />
              </SmallField>
              <button onClick={onRecalc} disabled={generating} className="btn btn-secondary w-full">
                {generating ? <><Spinner /> Recalculating…</> : "Recalculate"}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={onBack} className="btn btn-ghost flex-1">← Back</button>
            <button onClick={onSave} disabled={saving} className="btn btn-primary flex-1">
              {saving ? <><Spinner /> Saving…</> : "Save estimate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TotalsRow({ label, value, muted }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={`text-sm ${muted ? "text-slate-500" : "text-slate-700"}`}>{label}</span>
      <span className={`text-sm tabular-nums ${muted ? "text-slate-500" : "font-medium text-slate-900"}`}>
        ${Number(value).toLocaleString()}
      </span>
    </div>
  );
}

function Divider() { return <div className="h-px bg-slate-100 my-2" />; }

/* ── Step 4: saved ──────────────────────────────────────── */
function SavedStep({ savedId, router }) {
  return (
    <div className="card p-10 text-center max-w-lg mx-auto">
      <div className="mx-auto w-12 h-12 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mb-4">
        <CheckIcon />
      </div>
      <h2 className="text-xl font-bold text-slate-900">Estimate saved</h2>
      <p className="text-sm text-slate-500 mt-1">Your estimate is stored and ready to share with the GC.</p>
      <div className="mt-6 flex gap-2 justify-center">
        <button onClick={() => router.push(`/estimates/${savedId}`)} className="btn btn-primary">
          View estimate
        </button>
        <button onClick={() => router.push("/estimates")} className="btn btn-secondary">
          All estimates
        </button>
      </div>
    </div>
  );
}

/* ── atoms ──────────────────────────────────────────────── */
function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function SmallField({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Bullet() {
  return <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />;
}

function Spinner() {
  return (
    <svg className="animate-spin -ml-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
function UploadIcon() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>; }
function FileIcon()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>; }
function CheckIcon()  { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>; }

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
