import { describe, expect, it } from "vitest";

import { baseData } from "./data-context";
import { applyUpload, detectKind } from "./upload";

describe("CSV upload", () => {
  it("recognises the daily sales file by its columns", () => {
    expect(
      detectKind([
        "date",
        "store_id",
        "receipts_instore",
        "receipts_app",
        "receipts_delivery",
        "net_sales_instore_gbp",
        "net_sales_app_gbp",
        "net_sales_delivery_gbp",
      ]),
    ).toBe("sales");
  });

  it("rejects files with unknown columns", () => {
    const r = applyUpload(baseData, "foo,bar\n1,2\n");
    expect(r.ok).toBe(false);
  });

  it("a waste upload replaces that store's waste and the chain total", () => {
    const csv = "date,store_id,category,units_prepared,units_wasted,est_cost_wasted_gbp\n2025-07-01,S03,Bakery,100,10,50\n";
    const r = applyUpload(baseData, csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s03 = r.data.stores.find((s) => s.store_id === "S03")!;
    const oldS03 = baseData.stores.find((s) => s.store_id === "S03")!;
    expect(s03.waste.cost_wasted).toBe(50);
    expect(r.data.chain.total_waste_cost).toBeCloseTo(baseData.chain.total_waste_cost - oldS03.waste.cost_wasted + 50, 1);
  });

  it("a costs upload raising rent by £12,000 cuts that store's profit by £12,000", () => {
    const s01 = baseData.stores.find((s) => s.store_id === "S01")!;
    const c = s01.costs;
    const rows = Array.from({ length: 12 }, (_, i) => {
      const m = s01.monthly_trend[i]!.month;
      return [m, "S01", c.rent / 12 + 1000, c.rates / 12, c.utilities / 12, c.repairs / 12, c.other_opex / 12].join(",");
    });
    const csv = "month,store_id,rent_gbp,business_rates_gbp,utilities_gbp,repairs_maintenance_gbp,other_opex_gbp\n" + rows.join("\n");
    const r = applyUpload(baseData, csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const after = r.data.stores.find((s) => s.store_id === "S01")!;
    expect(after.profit).toBeCloseTo(s01.profit - 12_000, 0);
    expect(r.data.chain.total_profit).toBeCloseTo(baseData.chain.total_profit - 12_000, 0);
  });
});
