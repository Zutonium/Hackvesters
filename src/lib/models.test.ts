import { describe, expect, it } from "vitest";

import raw from "@/data/dashboard.json";
import { extraOptions, recommendedPlan } from "@/data/investment-options";
import {
  budgetPortfolio,
  COST_LEVERS,
  costSavings,
  deliveryEconomics,
  planPortfolio,
  stressTest,
  TOTAL_BUDGET,
  withAmount,
  withEbitda,
} from "./models";
import type { DashboardData } from "./types";

const data = raw as unknown as DashboardData;

describe("£1.5M capital allocation", () => {
  const items = data.budget_plan.categories;

  it("the recommended plan spends exactly £1,500,000", () => {
    const p = budgetPortfolio(items, items.map(() => true));
    expect(TOTAL_BUDGET).toBe(1_500_000);
    expect(p.spent).toBe(1_500_000);
    expect(p.remaining).toBe(0);
  });

  it("the recommended plan adds £691,431 a year with a 2.17-year payback", () => {
    const p = budgetPortfolio(items, items.map(() => true));
    expect(p.ebitda).toBe(691_431);
    expect(p.paybackYears!.toFixed(2)).toBe("2.17");
  });

  it("flags a portfolio that goes over budget", () => {
    const extra = [...items, { ...items[0]!, name: "Extra", allocated_gbp: 100_000 }];
    const p = budgetPortfolio(extra, extra.map(() => true));
    expect(p.overBudget).toBe(true);
    expect(p.remaining).toBe(-100_000);
  });
});

describe("cost savings simulator", () => {
  it("all five levers save £123,640 a year", () => {
    expect(costSavings(COST_LEVERS.map((l) => l.id))).toBe(123_640);
  });
});

describe("delivery calculator", () => {
  it("a higher commission lowers profit per order", () => {
    const base = { minBasket: 8, smallOrderFee: 1.5, markupPct: 10 };
    expect(deliveryEconomics({ ...base, commissionPct: 33 }).netPerOrder).toBeLessThan(
      deliveryEconomics({ ...base, commissionPct: 28 }).netPerOrder,
    );
  });

  it("with no fee, the minimum basket changes nothing", () => {
    const a = deliveryEconomics({ minBasket: 0, smallOrderFee: 0, commissionPct: 30, markupPct: 0 });
    const b = deliveryEconomics({ minBasket: 12, smallOrderFee: 0, commissionPct: 30, markupPct: 0 });
    expect(a.netPerOrder).toBeCloseTo(b.netPerOrder, 6);
  });
});

describe("investment planner", () => {
  const plan = recommendedPlan(data);

  it("starts from the recommended plan: £1,500,000 spent for +£691,431 a year", () => {
    const p = planPortfolio(plan, 1_500_000);
    expect(p.spent).toBe(1_500_000);
    expect(p.ebitda).toBe(691_431);
    expect(p.paybackYears!.toFixed(2)).toBe("2.17");
  });

  it("doubling an item's amount doubles its yearly profit", () => {
    const york = plan.find((i) => i.riskKey === "CS4")!;
    const bigger = withAmount(york, york.amount * 2);
    expect(bigger.amount).toBe(360_000);
    expect(bigger.ebitda).toBe(Math.round(york.ebitda * 2));
  });

  it("typing a profit directly sets it, and later amount changes keep that return", () => {
    const item = withEbitda({ ...plan[0]!, amount: 100_000 }, 25_000);
    expect(item.ebitda).toBe(25_000);
    expect(withAmount(item, 200_000).ebitda).toBe(50_000);
  });

  it("a custom £100k investment over a £1.5M plan puts it £100,000 over budget", () => {
    const custom = { ...plan[0]!, id: "c", amount: 100_000, ebitda: 10_000, source: "custom" as const };
    const p = planPortfolio([...plan, custom], 1_500_000);
    expect(p.overBudget).toBe(true);
    expect(p.remaining).toBe(-100_000);
  });

  it("raising the budget to £2,000,000 leaves £500,000 unspent", () => {
    expect(planPortfolio(plan, 2_000_000).remaining).toBe(500_000);
  });

  it("unticked items don't count", () => {
    const p = planPortfolio(plan.map((i) => ({ ...i, included: false })), 1_500_000);
    expect(p.spent).toBe(0);
    expect(p.paybackYears).toBeNull();
  });

  it("the recommended plan already puts money into current cafés", () => {
    expect(planPortfolio(plan).existingSharePct).toBeGreaterThan(0);
  });

  it("extra options include improvements to current cafés and the four unused sites", () => {
    const opts = extraOptions(data, plan);
    expect(opts.some((o) => o.group === "existing-store")).toBe(true);
    expect(opts.filter((o) => o.group === "new-site").map((o) => o.riskKey).sort()).toEqual(["CS2", "CS5", "CS6", "CS7"]);
  });

  it("downside case: 25% less profit and 15% overrun lengthens payback", () => {
    const d = stressTest(100_000, 50_000);
    expect(d.cost).toBeCloseTo(115_000, 2);
    expect(d.profit).toBe(37_500);
    expect(d.paybackYears!).toBeGreaterThan(2);
  });
});
