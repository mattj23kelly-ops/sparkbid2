import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60; // AI take-off can take longer than metadata extraction
export const runtime = "nodejs";

const MODEL = "claude-sonnet-4-6";

// JSON schema we expect the model to return. Kept here so the prompt and
// downstream consumers (/api/generate-estimate, UI) share one contract.
const TAKEOFF_SHAPE = `{
  "title": "concise project name (string)",
  "location": "city/state or full address if visible, otherwise null",
  "project_type": "one of: commercial, residential, industrial, institutional",
  "square_footage": integer or null,
  "stories": integer or null,
  "scope_summary": "3-5 sentence narrative summary of the electrical work",
  "tags": ["up to 6 from: Rewiring, Panel Upgrade, LED Retrofit, Solar / PV, EV Chargers, Fire Alarm, Generator, Low Voltage, New Construction, Tenant Buildout, Emergency"],

  "devices": [
    { "type": "Duplex Receptacle 120V", "item_key": "duplex-receptacle-120v", "count": 42, "notes": "optional — per room schedule", "source_note": "First floor plan, E-1.1 — open office + private offices" },
    { "type": "GFCI Receptacle",        "item_key": "gfci-receptacle",        "count": 6,  "notes": "kitchen + baths",              "source_note": "Sheet E-1.1, kitchenette + restroom tags" }
  ],
  "fixtures": [
    { "type": "LED 2x4 Troffer", "item_key": "led-2x4-troffer", "count": 18, "source_note": "Lighting plan E-2.1, ceiling grid" }
  ],
  "panels": [
    { "name": "MDP",  "amps": 400, "phases": 3, "spaces": 42, "item_key": "panel-400a-main", "notes": "new main distribution", "source_note": "One-line E-0.1, electrical room 112" },
    { "name": "PP-1", "amps": 100, "phases": 1, "spaces": 24, "item_key": "subpanel-100a",                                        "source_note": "Panel schedule E-2.0" }
  ],
  "conduit": [
    { "type": "EMT 3/4\\"",  "item_key": "emt-3/4", "feet": 800, "source_note": "Feeder runs traced on E-1.1" }
  ],
  "wire": [
    { "type": "#12 THHN CU", "item_key": "thhn-12-cu", "feet": 3200, "source_note": "Branch circuit homeruns, E-1.1" }
  ],
  "systems": ["Fire Alarm", "Data / Low Voltage"],
  "assumptions": ["Ceiling height assumed 10'", "Existing service remains"],
  "confidence": 78,
  "notes": "Plain-English caveats — e.g. 'Panel schedule not fully legible on sheet E2.1; counts approximate.'"
}`;

const CATALOG_KEYS = [
  // devices
  "duplex-receptacle-120v","gfci-receptacle","quad-receptacle-120v","single-pole-switch",
  "three-way-switch","dimmer-switch","occupancy-sensor","data-drop-cat6","smoke-detector-120v",
  // fixtures
  "led-2x4-troffer","led-2x2-troffer","led-highbay","led-downlight-6in","led-strip-4ft",
  "exit-sign-combo","exterior-wallpack",
  // panels
  "panel-100a-main","panel-200a-main","panel-400a-main","subpanel-100a",
  "breaker-20a-1p","breaker-20a-2p",
  // conduit
  "emt-1/2","emt-3/4","emt-1","pvc-1/2","flex-1/2","mc-cable-12-2",
  // wire
  "thhn-12-cu","thhn-10-cu","thhn-8-cu","thhn-6-cu","thhn-2-cu","thhn-4/0-cu","romex-12-2",
];

export async function POST(request) {
  try {
    const { fileBase64, mediaType, fileName } = await request.json();

    if (!fileBase64 || !mediaType) {
      return Response.json({ error: "Missing file data" }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const fileContent = mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
      : { type: "image",    source: { type: "base64", media_type: mediaType,           data: fileBase64 } };

    const prompt = `You are a senior electrical estimator performing a take-off from a construction document.

Your job: extract QUANTITATIVE information an electrical contractor needs to produce a bid. Count devices, fixtures, panels, and estimate conduit/wire footage from what is visible in the plans. Do not fabricate counts — when the document doesn't show something clearly, either omit the category or flag it in "notes".

For every device/fixture/panel/conduit/wire entry, try to include an "item_key" from this canonical list so we can look up unit pricing later. Use the key that best matches the item — omit the field if nothing fits:

${CATALOG_KEYS.join(", ")}

Return ONLY one valid JSON object matching this shape (no prose, no markdown fences):

${TAKEOFF_SHAPE}

Rules:
- project_type must be exactly one of: commercial, residential, industrial, institutional.
- Counts are integers. Feet are integers. Confidence is 0-100.
- If the plan shows only part of the building (e.g. one floor), set square_footage for THAT scope and mention it in "notes".
- If no panels/fixtures/etc. are visible, return an empty array for that category — don't invent.
- Keep "assumptions" specific and useful to the estimator (things they'd want to verify).
- For EVERY device/fixture/panel/conduit/wire row, include a short "source_note" (≤ 80 chars) describing where on the plan the count came from. Reference sheet numbers, drawing titles, room names, or plan areas whenever visible (e.g. "Panel schedule E-2.0", "First floor plan, north wing"). Omit only if truly nothing on the plan can be cited.

Source file: ${fileName ?? "uploaded document"}`;

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [fileContent, { type: "text", text: prompt }],
      }],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const extracted = extractJson(text);
    if (!extracted) {
      return Response.json(
        { error: "Could not parse AI response", raw: text.slice(0, 500) },
        { status: 500 }
      );
    }

    // Shallow normalization
    const takeoff = {
      title:          extracted.title ?? null,
      location:       extracted.location ?? null,
      project_type:   normalizeType(extracted.project_type),
      square_footage: intOrNull(extracted.square_footage),
      stories:        intOrNull(extracted.stories),
      scope_summary:  extracted.scope_summary ?? null,
      tags:           Array.isArray(extracted.tags) ? extracted.tags : [],
      quantities: {
        devices:    sanitizeItems(extracted.devices),
        fixtures:   sanitizeItems(extracted.fixtures),
        panels:     sanitizePanels(extracted.panels),
        conduit:    sanitizeLinear(extracted.conduit),
        wire:       sanitizeLinear(extracted.wire),
        systems:    Array.isArray(extracted.systems)     ? extracted.systems     : [],
        assumptions:Array.isArray(extracted.assumptions) ? extracted.assumptions : [],
      },
      confidence:     numOrNull(extracted.confidence),
      notes:          extracted.notes ?? null,
      ai_model:       MODEL,
    };

    return Response.json({ success: true, takeoff });

  } catch (err) {
    console.error("Blueprint analysis error:", err);
    return Response.json(
      { error: err?.message ?? "Analysis failed" },
      { status: 500 }
    );
  }
}

/* ── helpers ────────────────────────────────────────────────── */
function extractJson(text) {
  if (!text) return null;
  // Strip markdown code fences if present
  const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function normalizeType(t) {
  if (!t) return null;
  const lower = String(t).toLowerCase().trim();
  return ["commercial","residential","industrial","institutional"].includes(lower) ? lower : null;
}

function intOrNull(v)  { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; }
function numOrNull(v)  { const n = Number(v);        return Number.isFinite(n) ? n : null; }

function sanitizeItems(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => x && (x.type || x.item_key))
    .map((x) => ({
      type:        String(x.type ?? x.item_key ?? "Item"),
      item_key:    x.item_key ?? null,
      count:       Math.max(0, intOrNull(x.count) ?? 0),
      notes:       x.notes ?? null,
      source_note: trimStr(x.source_note, 120),
    }))
    .filter((x) => x.count > 0);
}

function sanitizePanels(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => x && (x.name || x.item_key || x.amps))
    .map((x) => ({
      name:        String(x.name ?? "Panel"),
      amps:        intOrNull(x.amps),
      phases:      intOrNull(x.phases),
      spaces:      intOrNull(x.spaces),
      item_key:    x.item_key ?? null,
      notes:       x.notes ?? null,
      source_note: trimStr(x.source_note, 120),
    }));
}

function sanitizeLinear(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => x && (x.type || x.item_key))
    .map((x) => ({
      type:        String(x.type ?? x.item_key ?? "Run"),
      item_key:    x.item_key ?? null,
      feet:        Math.max(0, intOrNull(x.feet) ?? 0),
      source_note: trimStr(x.source_note, 120),
    }))
    .filter((x) => x.feet > 0);
}

function trimStr(v, max = 120) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}
