/**
 * In-browser CSV re-import. An uploaded file replaces the full-year figures for every
 * store it contains, then chain totals and trends are re-derived the same way the
 * original Python pipeline (build_full_dataset.py) built them.
 */
import type { DashboardData, MonthPoint, Store } from "./types";

export type UploadKind = "sales" | "waste" | "rota" | "costs";

export const UPLOAD_FORMATS: Record<
  UploadKind,
  { label: string; file: string; columns: string[] }
> = {
  sales: {
    label: "Daily store sales",
    file: "daily_store_sales.csv",
    columns: [
      "date",
      "store_id",
      "receipts_instore",
      "receipts_app",
      "receipts_delivery",
      "net_sales_instore_gbp",
      "net_sales_app_gbp",
      "net_sales_delivery_gbp",
    ],
  },
  waste: {
    label: "Food waste log",
    file: "waste_log.csv",
    columns: [
      "date",
      "store_id",
      "category",
      "units_prepared",
      "units_wasted",
      "est_cost_wasted_gbp",
    ],
  },
  rota: {
    label: "Weekly staff rota",
    file: "staff_rota_weekly.csv",
    columns: ["week_start", "store_id", "daypart", "scheduled_hours", "avg_hourly_wage_gbp"],
  },
  costs: {
    label: "Monthly store costs",
    file: "store_costs_monthly.csv",
    columns: [
      "month",
      "store_id",
      "rent_gbp",
      "business_rates_gbp",
      "utilities_gbp",
      "repairs_maintenance_gbp",
      "other_opex_gbp",
    ],
  },
};

export const LABOUR_ON_COST = 1.13;

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = split(lines[0] ?? "");
  return lines.slice(1).map((l) => {
    const cells = split(l);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

export function detectKind(headers: string[]): UploadKind | null {
  const h = new Set(headers);
  for (const kind of Object.keys(UPLOAD_FORMATS) as UploadKind[]) {
    if (UPLOAD_FORMATS[kind].columns.every((c) => h.has(c))) return kind;
  }
  return null;
}

const num = (v: string | undefined) => {
  const x = parseFloat(v ?? "");
  return Number.isFinite(x) ? x : 0;
};
const r2 = (v: number) => Math.round(v * 100) / 100;
const r1 = (v: number) => Math.round(v * 10) / 10;

function groupBy<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  return m;
}

function finishStore(s: Store, monthlyExpenseDelta: Record<string, number>, monthlySales?: Record<string, number>) {
  const c = s.costs;
  c.fixed_total = r2(c.rent + c.rates + c.utilities + c.repairs + c.other_opex);
  c.delivery_total = r2(c.delivery_commission + c.delivery_packaging);
  c.total_expenses = r2(c.labour + c.fixed_total + c.cogs_ingredients + c.delivery_total);
  s.profit = r2(s.sales.total - c.total_expenses);
  s.margin = s.sales.total > 0 ? r2((s.profit / s.sales.total) * 100) : 0;
  s.monthly_trend = s.monthly_trend.map((m) => {
    const sales = monthlySales?.[m.month] ?? m.sales;
    const expenses = m.expenses + (monthlyExpenseDelta[m.month] ?? 0);
    const profit = sales - expenses;
    return {
      month: m.month,
      sales: r2(sales),
      expenses: r2(expenses),
      profit: r2(profit),
      margin: sales > 0 ? r1((profit / sales) * 100) : 0,
    };
  });
}

function applySales(store: Store, rows: Record<string, string>[]) {
  const old = { ...store.sales };
  const oldOrders = { ...store.orders };
  const sales = { instore: 0, app: 0, delivery: 0, total: 0 };
  const orders = { instore: 0, app: 0, delivery: 0, total: 0 };
  const monthly: Record<string, number> = {};
  for (const r of rows) {
    const si = num(r["net_sales_instore_gbp"]);
    const sa = num(r["net_sales_app_gbp"]);
    const sd = num(r["net_sales_delivery_gbp"]);
    sales.instore += si;
    sales.app += sa;
    sales.delivery += sd;
    orders.instore += num(r["receipts_instore"]);
    orders.app += num(r["receipts_app"]);
    orders.delivery += num(r["receipts_delivery"]);
    const m = (r["date"] ?? "").slice(0, 7);
    monthly[m] = (monthly[m] ?? 0) + si + sa + sd;
  }
  sales.total = sales.instore + sales.app + sales.delivery;
  orders.total = orders.instore + orders.app + orders.delivery;

  // Variable costs move with sales: ingredients with total sales, commission with delivery
  // sales, packaging with delivery orders.
  const c = store.costs;
  const cogsRate = old.total > 0 ? c.cogs_ingredients / old.total : 0.274;
  const commRate = old.delivery > 0 ? c.delivery_commission / old.delivery : 0.3;
  const packPerOrder = oldOrders.delivery > 0 ? c.delivery_packaging / oldOrders.delivery : 0.45;
  const oldVariable = c.cogs_ingredients + c.delivery_commission + c.delivery_packaging;
  c.cogs_ingredients = r2(sales.total * cogsRate);
  c.delivery_commission = r2(sales.delivery * commRate);
  c.delivery_packaging = r2(orders.delivery * packPerOrder);

  store.sales = {
    instore: r2(sales.instore),
    app: r2(sales.app),
    delivery: r2(sales.delivery),
    total: r2(sales.total),
  };
  store.orders = orders;

  const variableRate = old.total > 0 ? oldVariable / old.total : 0;
  const delta: Record<string, number> = {};
  for (const m of store.monthly_trend) {
    const ms = monthly[m.month];
    if (ms !== undefined) delta[m.month] = (ms - m.sales) * variableRate;
  }
  finishStore(store, delta, monthly);
}

function applyWaste(store: Store, rows: Record<string, string>[]) {
  const byCat: Store["waste"]["by_category"] = {};
  let prep = 0;
  let wasted = 0;
  let cost = 0;
  for (const r of rows) {
    const cat = r["category"] || "Other";
    const b = (byCat[cat] ??= { prep: 0, wasted: 0, cost: 0, pct: 0 });
    b.prep += num(r["units_prepared"]);
    b.wasted += num(r["units_wasted"]);
    b.cost += num(r["est_cost_wasted_gbp"]);
    prep += num(r["units_prepared"]);
    wasted += num(r["units_wasted"]);
    cost += num(r["est_cost_wasted_gbp"]);
  }
  for (const k of Object.keys(byCat)) {
    const b = byCat[k]!;
    byCat[k] = {
      prep: b.prep,
      wasted: b.wasted,
      cost: r2(b.cost),
      pct: b.prep > 0 ? r1((b.wasted / b.prep) * 100) : 0,
    };
  }
  store.waste = {
    units_prepared: prep,
    units_wasted: wasted,
    cost_wasted: r2(cost),
    waste_pct: prep > 0 ? r1((wasted / prep) * 100) : 0,
    by_category: byCat,
  };
}

function applyRota(store: Store, rows: Record<string, string>[]) {
  let labour = 0;
  const hours: Record<string, number> = {};
  const monthly: Record<string, number> = {};
  for (const r of rows) {
    const h = num(r["scheduled_hours"]);
    const cost = h * num(r["avg_hourly_wage_gbp"]) * LABOUR_ON_COST;
    labour += cost;
    const dp = r["daypart"] || "Other";
    hours[dp] = (hours[dp] ?? 0) + h;
    const m = (r["week_start"] ?? "").slice(0, 7);
    monthly[m] = (monthly[m] ?? 0) + cost;
  }
  const oldLabour = store.costs.labour;
  store.costs.labour = r2(labour);
  store.staff.daypart_hours = Object.fromEntries(Object.entries(hours).map(([k, v]) => [k, r1(v)]));
  // Spread the labour change across months in proportion to the new rota.
  const delta: Record<string, number> = {};
  const months = store.monthly_trend.map((m) => m.month);
  const inRange = months.reduce((s, m) => s + (monthly[m] ?? 0), 0);
  for (const m of months) {
    delta[m] =
      inRange > 0
        ? ((monthly[m] ?? 0) / inRange) * (labour - oldLabour)
        : (labour - oldLabour) / months.length;
  }
  finishStore(store, delta);
}

function applyCosts(store: Store, rows: Record<string, string>[]) {
  const c = store.costs;
  const before: Record<string, number> = {};
  const oldFixed = c.rent + c.rates + c.utilities + c.repairs + c.other_opex;
  const t = { rent: 0, rates: 0, utilities: 0, repairs: 0, other_opex: 0 };
  for (const r of rows) {
    const rent = num(r["rent_gbp"]);
    const rates = num(r["business_rates_gbp"]);
    const util = num(r["utilities_gbp"]);
    const rep = num(r["repairs_maintenance_gbp"]);
    const op = num(r["other_opex_gbp"]);
    t.rent += rent;
    t.rates += rates;
    t.utilities += util;
    t.repairs += rep;
    t.other_opex += op;
    const mk = r["month"] ?? "";
    before[mk] = (before[mk] ?? 0) + rent + rates + util + rep + op;
  }
  Object.assign(c, {
    rent: r2(t.rent),
    rates: r2(t.rates),
    utilities: r2(t.utilities),
    repairs: r2(t.repairs),
    other_opex: r2(t.other_opex),
  });
  if (t.rent > 0) store.rent_gbp_month = r2(t.rent / Math.max(1, Object.keys(before).length));
  const newFixed = t.rent + t.rates + t.utilities + t.repairs + t.other_opex;
  const months = store.monthly_trend.map((m) => m.month);
  const oldPerMonth = oldFixed / months.length;
  const delta: Record<string, number> = {};
  for (const m of months) {
    delta[m] = before[m] !== undefined ? before[m] - oldPerMonth : (newFixed - oldFixed) / months.length;
  }
  finishStore(store, delta);
}

export function rebuildChain(data: DashboardData): DashboardData {
  const s = data.stores;
  const sum = (f: (x: Store) => number) => r2(s.reduce((a, x) => a + f(x), 0));
  const total_revenue = sum((x) => x.sales.total);
  const total_profit = sum((x) => x.profit);
  const chain = {
    ...data.chain,
    total_revenue,
    instore_revenue: sum((x) => x.sales.instore),
    app_revenue: sum((x) => x.sales.app),
    delivery_revenue: sum((x) => x.sales.delivery),
    total_labour: sum((x) => x.costs.labour),
    total_rent: sum((x) => x.costs.rent),
    total_rates: sum((x) => x.costs.rates),
    total_utilities: sum((x) => x.costs.utilities),
    total_repairs: sum((x) => x.costs.repairs),
    total_other_opex: sum((x) => x.costs.other_opex),
    total_cogs: sum((x) => x.costs.cogs_ingredients),
    total_delivery_commission: sum((x) => x.costs.delivery_commission),
    total_delivery_packaging: sum((x) => x.costs.delivery_packaging),
    total_delivery_costs: sum((x) => x.costs.delivery_total),
    total_expenses: sum((x) => x.costs.total_expenses),
    total_profit,
    overall_margin: total_revenue > 0 ? r2((total_profit / total_revenue) * 100) : 0,
    total_waste_cost: sum((x) => x.waste.cost_wasted),
    total_orders: s.reduce((a, x) => a + x.orders.total, 0),
    store_count: s.length,
  };
  const chain_monthly_trend: MonthPoint[] = data.chain_monthly_trend.map((m) => {
    const pick = (x: Store) => x.monthly_trend.find((p) => p.month === m.month);
    const sales = s.reduce((a, x) => a + (pick(x)?.sales ?? 0), 0);
    const expenses = s.reduce((a, x) => a + (pick(x)?.expenses ?? 0), 0);
    const profit = sales - expenses;
    return {
      month: m.month,
      sales: r2(sales),
      expenses: r2(expenses),
      profit: r2(profit),
      margin: sales > 0 ? r1((profit / sales) * 100) : 0,
    };
  });
  return { ...data, chain, chain_monthly_trend };
}

export type UploadResult =
  | { ok: true; kind: UploadKind; data: DashboardData; storesUpdated: string[]; rows: number }
  | { ok: false; error: string };

export function applyUpload(data: DashboardData, csvText: string): UploadResult {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return { ok: false, error: "The file is empty." };
  const kind = detectKind(Object.keys(rows[0] ?? {}));
  if (!kind) {
    return {
      ok: false,
      error:
        "We couldn't recognise this file. Use the same columns as one of the four supported files.",
    };
  }
  const next: DashboardData = structuredClone(data);
  const byStore = groupBy(rows, (r) => r["store_id"] ?? "");
  const updated: string[] = [];
  for (const [storeId, storeRows] of byStore) {
    const store = next.stores.find((x) => x.store_id === storeId);
    if (!store) continue;
    if (kind === "sales") applySales(store, storeRows);
    if (kind === "waste") applyWaste(store, storeRows);
    if (kind === "rota") applyRota(store, storeRows);
    if (kind === "costs") applyCosts(store, storeRows);
    updated.push(storeId);
  }
  if (updated.length === 0) {
    return { ok: false, error: "None of the store codes in this file match our 12 stores (S01–S12)." };
  }
  return { ok: true, kind, data: rebuildChain(next), storesUpdated: updated.sort(), rows: rows.length };
}
