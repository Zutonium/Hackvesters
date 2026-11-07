/**
 * Day-by-day store figures for the timeline. Daily sales, orders, door counts and food waste
 * come from the original CSVs (bundled as src/data/daily.json). Profit is estimated per day so
 * that each month adds up exactly to that store's monthly profit in the dashboard data:
 * ingredients and delivery fees move with the day's sales, and the rest of the month's costs
 * (rent, rates, labour, utilities…) is spread evenly over the days the store traded.
 */
import type { DashboardData, Store } from "./types";
import { parseCsv } from "./upload";

export type DailySeries = {
  si: number[]; // in-store sales £
  sa: number[]; // app sales £
  sd: number[]; // delivery sales £
  ri: number[]; // in-store receipts
  ra: number[]; // app receipts
  rd: number[]; // delivery receipts
  ff: number[]; // door count
  wc: number[]; // food waste cost £
  wu: number[]; // units wasted
  wp: number[]; // units prepared
};
export type DailyData = { start: string; days: number; stores: Record<string, DailySeries> };

export type Granularity = "day" | "week" | "month" | "year" | "overall";
export type Period = { key: string; label: string; short: string; from: number; to: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dayDate(daily: DailyData, i: number) {
  const d = new Date(`${daily.start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + i);
  return d;
}
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function dayIndex(daily: DailyData, iso: string) {
  const ms = Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${daily.start}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtShort = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;

/** Every period of the chosen length across the financial year, in order. */
export function periods(daily: DailyData, g: Granularity): Period[] {
  const last = daily.days - 1;
  if (g === "overall") {
    const a = dayDate(daily, 0);
    const b = dayDate(daily, last);
    return [
      {
        key: "all",
        label: `Whole year · ${fmtShort(a)} ${a.getUTCFullYear()} – ${fmtShort(b)} ${b.getUTCFullYear()}`,
        short: "FY",
        from: 0,
        to: last,
      },
    ];
  }
  const out: Period[] = [];
  if (g === "day") {
    for (let i = 0; i <= last; i++) {
      const d = dayDate(daily, i);
      out.push({ key: isoDay(d), label: fmtDay(d), short: fmtShort(d), from: i, to: i });
    }
    return out;
  }
  const keyOf = (d: Date) => {
    if (g === "month") return isoDay(d).slice(0, 7);
    if (g === "year") return String(d.getUTCFullYear());
    // week: Monday start
    const m = new Date(d);
    m.setUTCDate(m.getUTCDate() - ((m.getUTCDay() + 6) % 7));
    return isoDay(m);
  };
  for (let i = 0; i <= last; i++) {
    const d = dayDate(daily, i);
    const k = keyOf(d);
    const cur = out.at(-1);
    if (cur && cur.key === k) cur.to = i;
    else out.push({ key: k, label: "", short: "", from: i, to: i });
  }
  for (const p of out) {
    const a = dayDate(daily, p.from);
    const b = dayDate(daily, p.to);
    if (g === "month") {
      p.label = `${a.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" })} ${a.getUTCFullYear()}`;
      p.short = `${MONTHS[a.getUTCMonth()]} ${String(a.getUTCFullYear()).slice(2)}`;
    } else if (g === "year") {
      p.label = `${p.key} (${MONTHS[a.getUTCMonth()]}–${MONTHS[b.getUTCMonth()]})`;
      p.short = p.key;
    } else {
      p.label = `Week of ${fmtShort(new Date(`${p.key}T00:00:00Z`))} ${a.getUTCFullYear()} (${fmtShort(a)} – ${fmtShort(b)})`;
      p.short = fmtShort(a);
    }
  }
  return out;
}

/** Estimated profit for each day of one store (see file header). */
export function dailyProfit(daily: DailyData, store: Store): number[] {
  const s = daily.stores[store.store_id];
  if (!s) return [];
  const c = store.costs;
  const variableRate =
    store.sales.total > 0
      ? (c.cogs_ingredients + c.delivery_commission + c.delivery_packaging) / store.sales.total
      : 0;
  const sales = s.si.map((v, i) => v + (s.sa[i] ?? 0) + (s.sd[i] ?? 0));
  const monthOf = (i: number) => isoDay(dayDate(daily, i)).slice(0, 7);
  const tradingDays: Record<string, number> = {};
  sales.forEach((v, i) => {
    if (v > 0) tradingDays[monthOf(i)] = (tradingDays[monthOf(i)] ?? 0) + 1;
  });
  const fixedPerDay: Record<string, number> = {};
  for (const m of store.monthly_trend) {
    const fixed = m.expenses - variableRate * m.sales;
    fixedPerDay[m.month] = tradingDays[m.month] ? fixed / tradingDays[m.month]! : 0;
  }
  return sales.map((v, i) => (v > 0 ? v - variableRate * v - (fixedPerDay[monthOf(i)] ?? 0) : 0));
}

export type PeriodStats = {
  sales: number;
  instore: number;
  app: number;
  delivery: number;
  orders: number;
  footfall: number;
  conversionPct: number;
  avgBasket: number;
  wasteCost: number;
  wastePct: number;
  profit: number;
  marginPct: number;
  tradingDays: number;
};

const sumRange = (arr: number[] | undefined, from: number, to: number) => {
  let t = 0;
  if (!arr) return 0;
  for (let i = from; i <= to; i++) t += arr[i] ?? 0;
  return t;
};

export function periodStats(
  daily: DailyData,
  profits: Record<string, number[]>,
  storeIds: string[],
  from: number,
  to: number,
): PeriodStats {
  let instore = 0,
    app = 0,
    delivery = 0,
    orders = 0,
    footfall = 0,
    wasteCost = 0,
    wu = 0,
    wp = 0,
    profit = 0;
  const trading = new Set<number>();
  for (const id of storeIds) {
    const s = daily.stores[id];
    if (!s) continue;
    instore += sumRange(s.si, from, to);
    app += sumRange(s.sa, from, to);
    delivery += sumRange(s.sd, from, to);
    orders += sumRange(s.ri, from, to) + sumRange(s.ra, from, to) + sumRange(s.rd, from, to);
    footfall += sumRange(s.ff, from, to);
    wasteCost += sumRange(s.wc, from, to);
    wu += sumRange(s.wu, from, to);
    wp += sumRange(s.wp, from, to);
    profit += sumRange(profits[id], from, to);
    for (let i = from; i <= to; i++) if ((s.si[i] ?? 0) + (s.sa[i] ?? 0) + (s.sd[i] ?? 0) > 0) trading.add(i);
  }
  const sales = instore + app + delivery;
  const instoreOrders = storeIds.reduce((a, id) => a + sumRange(daily.stores[id]?.ri, from, to), 0);
  return {
    sales,
    instore,
    app,
    delivery,
    orders,
    footfall,
    conversionPct: footfall > 0 ? (instoreOrders / footfall) * 100 : 0,
    avgBasket: orders > 0 ? sales / orders : 0,
    wasteCost,
    wastePct: wp > 0 ? (wu / wp) * 100 : 0,
    profit,
    marginPct: sales > 0 ? (profit / sales) * 100 : 0,
    tradingDays: trading.size,
  };
}

export function profitsFor(daily: DailyData, data: DashboardData) {
  return Object.fromEntries(data.stores.map((s) => [s.store_id, dailyProfit(daily, s)]));
}

/** % change, or null when there is nothing to compare against. */
export function change(now: number, before: number) {
  if (!before) return null;
  return ((now - before) / Math.abs(before)) * 100;
}

/**
 * Apply an uploaded sales or waste CSV to the daily figures, replacing the year for every
 * store in the file (matching what applyUpload does to the yearly totals).
 */
export function applyDailyUpload(daily: DailyData, csvText: string): DailyData | null {
  const rows = parseCsv(csvText);
  const h = new Set(Object.keys(rows[0] ?? {}));
  const isSales = ["date", "store_id", "net_sales_instore_gbp"].every((c) => h.has(c));
  const isWaste = ["date", "store_id", "est_cost_wasted_gbp", "units_prepared"].every((c) => h.has(c));
  if (!isSales && !isWaste) return null;
  const next: DailyData = structuredClone(daily);
  const keys: (keyof DailySeries)[] = isSales ? ["si", "sa", "sd", "ri", "ra", "rd"] : ["wc", "wu", "wp"];
  const cleared = new Set<string>();
  const num = (v: string | undefined) => {
    const x = parseFloat(v ?? "");
    return Number.isFinite(x) ? x : 0;
  };
  for (const r of rows) {
    const s = next.stores[r["store_id"] ?? ""];
    if (!s) continue;
    if (!cleared.has(r["store_id"]!)) {
      for (const k of keys) s[k] = s[k].map(() => 0);
      cleared.add(r["store_id"]!);
    }
    let iso = (r["date"] ?? "").trim();
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(iso);
    if (m) iso = `${m[3]}-${m[2]}-${m[1]}`;
    const i = dayIndex(next, iso);
    if (!(i >= 0 && i < next.days)) continue;
    if (isSales) {
      s.si[i]! += num(r["net_sales_instore_gbp"]);
      s.sa[i]! += num(r["net_sales_app_gbp"]);
      s.sd[i]! += num(r["net_sales_delivery_gbp"]);
      s.ri[i]! += num(r["receipts_instore"]);
      s.ra[i]! += num(r["receipts_app"]);
      s.rd[i]! += num(r["receipts_delivery"]);
    } else {
      s.wc[i]! += num(r["est_cost_wasted_gbp"]);
      s.wu[i]! += num(r["units_wasted"]);
      s.wp[i]! += num(r["units_prepared"]);
    }
  }
  return cleared.size > 0 ? next : null;
}
