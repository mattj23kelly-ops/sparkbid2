// POST /api/generate-estimate
// Body: { takeoff: {...}, labor_rate?: number, overhead_pct?: number,
//         profit_pct?: number, contingency_pct?: number }
//
// Reads the caller's price catalog (catalog entries with owner_id = current user,
// plus the global defaults with owner_id = null), builds line items from the
// take-off quantities, and computes totals.
//
// Returns: { line_items: [...], totals: {...}, assumptions: [...], catalog_misses: [...] }

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const { takeoff, labor_rate, overhead_pct, profit_pct, contingency_pct } = body ?? {};

    if (!takeoff || typeof takeoff !== "object") {
      return Response.json({ error: "Missing takeoff" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Pull all catalog entries visible to this user (global + their own).
    // RLS on price_catalog already restricts this, but we still filter in case.
    const catalogQuery = supabase
      .from("price_catalog")
      .select("item_key, category, display_name, unit, material_cost, labor_hours, owner_id");

    const { data: catalogRows, error: catErr } = user
      ? await catalogQuery.or(`owner_id.is.null,owner_id.eq.${user.id}`)
      : await catalogQuery.is("owner_id", null);

    if (catErr) {
      return Response.json({ error: catErr.message }, { status: 500 });
    }

    // Prefer user's overrides over global defaults. Key by item_key.
    const catalog = new Map();
    for (const row of catalogRows ?? []) {
      const existing = catalog.get(row.item_key);
      if (!existing || (row.owner_id && !existing.owner_id)) {
        catalog.set(row.item_key, row);
      }
    }

    const q = takeoff.quantities ?? {};
    const lineItems = [];
    const misses = [];
    let sort = 0;

    const push = (category, quantity, unit, key, fallbackDesc) => {
      if (!quantity || quantity <= 0) return;
      const cat = catalog.get(key);
      if (!cat) {
        misses.push({ category, item_key: key ?? null, description: fallbackDesc, quantity, unit });
        // Still add the row with zeroed pricing so the estimator sees it and can price manually
        lineItems.push({
          sort_order: sort++,
          category,
          item_key:   key ?? null,
          description: fallbackDesc,
          quantity,
          unit,
          material_cost: 0,
          labor_hours:   0,
          line_material: 0,
          line_labor_hrs: 0,
          priced: false,
        });
        return;
      }
      const line_material  = round2(quantity * Number(cat.material_cost));
      const line_labor_hrs = round2(quantity * Number(cat.labor_hours));
      lineItems.push({
        sort_order: sort++,
        category:       cat.category,
        item_key:       cat.item_key,
        description:    cat.display_name,
        quantity,
        unit:           cat.unit,
        material_cost:  Number(cat.material_cost),
        labor_hours:    Number(cat.labor_hours),
        line_material,
        line_labor_hrs,
        priced: true,
      });
    };

    // Devices
    for (const d of q.devices ?? [])  push("device",  d.count, "ea", d.item_key, d.type ?? "Device");
    // Fixtures
    for (const f of q.fixtures ?? []) push("fixture", f.count, "ea", f.item_key, f.type ?? "Fixture");
    // Panels — one per entry
    for (const p of q.panels ?? []) {
      const key = p.item_key ?? inferPanelKey(p.amps);
      push("panel", 1, "ea", key, `${p.name ?? "Panel"}${p.amps ? ` ${p.amps}A` : ""}${p.phases ? ` ${p.phases}ph` : ""}`);
    }
    // Conduit
    for (const c of q.conduit ?? []) push("conduit", c.feet, "ft", c.item_key, c.type ?? "Conduit");
    // Wire
    for (const w of q.wire ?? [])    push("wire",    w.feet, "ft", w.item_key, w.type ?? "Wire");

    // Totals
    const labor_rate_n      = numOr(labor_rate,      95);
    const overhead_pct_n    = numOr(overhead_pct,    12);
    const profit_pct_n      = numOr(profit_pct,      10);
    const contingency_pct_n = numOr(contingency_pct, 5);

    const materials_total = round2(lineItems.reduce((s, li) => s + li.line_material, 0));
    const labor_hours     = round2(lineItems.reduce((s, li) => s + li.line_labor_hrs, 0));
    const labor_total     = round2(labor_hours * labor_rate_n);
    const subtotal        = materials_total + labor_total;
    const overhead_total    = round2(subtotal * (overhead_pct_n    / 100));
    const profit_total      = round2((subtotal + overhead_total) * (profit_pct_n / 100));
    const contingency_total = round2((subtotal + overhead_total + profit_total) * (contingency_pct_n / 100));
    const grand_total       = round2(subtotal + overhead_total + profit_total + contingency_total);

    return Response.json({
      success: true,
      line_items: lineItems,
      totals: {
        materials_total,
        labor_hours,
        labor_rate:      labor_rate_n,
        labor_total,
        overhead_pct:    overhead_pct_n,
        overhead_total,
        profit_pct:      profit_pct_n,
        profit_total,
        contingency_pct: contingency_pct_n,
        contingency_total,
        grand_total,
      },
      assumptions:    q.assumptions ?? [],
      systems:        q.systems ?? [],
      catalog_misses: misses,
    });

  } catch (err) {
    console.error("Generate estimate error:", err);
    return Response.json({ error: err?.message ?? "Failed to generate estimate" }, { status: 500 });
  }
}

function round2(n) { return Math.round(n * 100) / 100; }
function numOr(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }

function inferPanelKey(amps) {
  const a = Number(amps);
  if (!Number.isFinite(a)) return null;
  if (a >= 400) return "panel-400a-main";
  if (a >= 200) return "panel-200a-main";
  if (a >= 150) return "panel-200a-main";
  if (a >= 100) return "panel-100a-main";
  return "subpanel-100a";
}
