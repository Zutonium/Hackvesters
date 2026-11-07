import { describe, expect, it } from "vitest";

import rawDaily from "@/data/daily.json";
import raw from "@/data/dashboard.json";
import { applyDailyUpload, periods, periodStats, profitsFor, type DailyData } from "./timeline";
import type { DashboardData } from "./types";

const data = raw as unknown as DashboardData;
const daily = rawDaily as DailyData;
const profits = profitsFor(daily, data);
const all = data.stores.map((s) => s.store_id);

describe("store timeline", () => {
  it("covers every day of FY 2025/26 (365 days)", () => {
    expect(periods(daily, "day")).toHaveLength(365);
    expect(periods(daily, "month")).toHaveLength(12);
    expect(periods(daily, "year").map((p) => p.key)).toEqual(["2025", "2026"]);
    expect(periods(daily, "overall")).toHaveLength(1);
  });

  it("weeks start on Monday and cover every day once", () => {
    const w = periods(daily, "week");
    expect(w[0]!.key).toBe("2025-06-30");
    expect(w.reduce((s, p) => s + p.to - p.from + 1, 0)).toBe(365);
  });

  it("the whole year matches each store's yearly sales, footfall and waste", () => {
    for (const s of data.stores) {
      const st = periodStats(daily, profits, [s.store_id], 0, 364);
      expect(Math.abs(st.sales - s.sales.total)).toBeLessThan(400);
      expect(st.footfall).toBe(s.footfall.annual_door_count);
      expect(Math.abs(st.wasteCost - s.waste.cost_wasted)).toBeLessThan(5);
    }
  });

  it("estimated daily profit adds up to each month's profit", () => {
    const months = periods(daily, "month");
    for (const s of data.stores) {
      months.forEach((m) => {
        const st = periodStats(daily, profits, [s.store_id], m.from, m.to);
        const actual = s.monthly_trend.find((t) => t.month === m.key)?.profit ?? 0;
        if (st.sales > 0) expect(Math.abs(st.profit - actual)).toBeLessThan(250);
      });
    }
    const year = periodStats(daily, profits, all, 0, 364);
    const monthlyTotal = data.stores.reduce((a, s) => a + s.monthly_trend.reduce((b, m) => b + m.profit, 0), 0);
    expect(Math.abs(year.profit - monthlyTotal)).toBeLessThan(2000);
  });

  it("an uploaded sales file replaces that store's daily sales", () => {
    const csv =
      "date,store_id,receipts_instore,receipts_app,receipts_delivery,net_sales_instore_gbp,net_sales_app_gbp,net_sales_delivery_gbp\n2025-07-01,S01,10,0,0,100,0,0";
    const next = applyDailyUpload(daily, csv)!;
    expect(periodStats(next, profits, ["S01"], 0, 364).sales).toBe(100);
    expect(periodStats(next, profits, ["S02"], 0, 364).sales).toBe(periodStats(daily, profits, ["S02"], 0, 364).sales);
  });
});
