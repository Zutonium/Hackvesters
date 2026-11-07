/**
 * Decision models carried over from the original Grind & Crumb dashboard.
 * Pure functions so the numbers the CEO sees are testable.
 */
import type { BudgetItem } from "./types";

export const TOTAL_BUDGET = 1_500_000;

// ---------- Cost savings simulator ----------
export type CostLever = { id: string; label: string; detail: string; saving: number };

export const COST_LEVERS: CostLever[] = [
  {
    id: "dashly",
    label: "Renegotiate Dashly commission",
    detail: "Back to 28% from 33%, using RushEats exclusivity as leverage",
    saving: 22_500,
  },
  {
    id: "small-order",
    label: "£8 delivery minimum or £1.50 small-order fee",
    detail: "Stops single-coffee delivery orders that lose money",
    saving: 38_000,
  },
  {
    id: "par-waste",
    label: "Smart prep levels for food",
    detail: "Forecast prep from weather and footfall, cutting ~30% of waste",
    saving: 40_140,
  },
  {
    id: "boiler",
    label: "Replace Hull boiler & dishwasher",
    detail: "Ends repeated emergency engineer callouts",
    saving: 8_000,
  },
  {
    id: "consumables",
    label: "One national supplier for consumables",
    detail: "Cups, chemicals & napkins on a single bulk contract",
    saving: 15_000,
  },
];

export function costSavings(selected: string[]) {
  return COST_LEVERS.filter((l) => selected.includes(l.id)).reduce((s, l) => s + l.saving, 0);
}

export function marginAfterSavings(revenue: number, profit: number, savings: number) {
  return ((profit + savings) / revenue) * 100;
}

// ---------- Delivery pricing calculator ----------
export const DELIVERY_BASE = {
  avgOrderValue: 12.67,
  packaging: 0.45,
  cogsRate: 0.274,
  baristaTime: 0.87,
  smallOrderShare: 0.29,
  currentNetPerOrder: 2.8,
  annualOrders: 111_000,
};

export type DeliveryInputs = {
  minBasket: number;
  smallOrderFee: number;
  commissionPct: number;
  markupPct: number;
};

/** Share of delivery orders below the minimum basket; 29% of orders sit under £8. */
export function shareUnderMinimum(minBasket: number) {
  return Math.min(0.6, Math.max(0, (DELIVERY_BASE.smallOrderShare * minBasket) / 8));
}

export function deliveryEconomics(i: DeliveryInputs) {
  const b = DELIVERY_BASE;
  const markup = i.markupPct / 100;
  const effectiveAov =
    b.avgOrderValue * (1 + markup * 0.5) + i.smallOrderFee * shareUnderMinimum(i.minBasket);
  const commission = effectiveAov * (i.commissionPct / 100);
  const cogs = effectiveAov * b.cogsRate;
  const netPerOrder = effectiveAov - commission - b.packaging - cogs - b.baristaTime;
  const netMarginPct = (netPerOrder / effectiveAov) * 100;
  const annualUplift = Math.max(0, netPerOrder - b.currentNetPerOrder) * b.annualOrders;
  return { effectiveAov, netPerOrder, netMarginPct, annualUplift };
}

// ---------- £1.5M capital allocation ----------
export type PlanGroup = "new-site" | "existing-store" | "chain-wide" | "reserve";

export type PlanItem = {
  id: string;
  name: string;
  category: string;
  group: PlanGroup;
  /** £ invested */
  amount: number;
  /** extra profit (EBITDA) per year once running */
  ebitda: number;
  /** return per £1 invested, used when the amount is edited */
  returnRate: number;
  included: boolean;
  source: "recommended" | "option" | "custom";
  rationale: string;
  /** key into the risk library */
  riskKey?: string | undefined;
  storeId?: string | undefined;
};

export function budgetPortfolio(items: BudgetItem[], selected: boolean[], budget = TOTAL_BUDGET) {
  let spent = 0;
  let ebitda = 0;
  items.forEach((it, i) => {
    if (selected[i]) {
      spent += it.allocated_gbp;
      ebitda += it.projected_annual_ebitda;
    }
  });
  const remaining = budget - spent;
  const paybackYears = ebitda > 0 ? spent / ebitda : null;
  return { spent, ebitda, remaining, paybackYears, overBudget: remaining < 0 };
}

/** Totals for the planner. Only ticked items count. */
export function planPortfolio(items: PlanItem[], budget = TOTAL_BUDGET, years = 5) {
  const on = items.filter((i) => i.included);
  const spent = on.reduce((s, i) => s + i.amount, 0);
  const ebitda = on.reduce((s, i) => s + i.ebitda, 0);
  const existing = on
    .filter((i) => i.group === "existing-store" || i.group === "chain-wide")
    .reduce((s, i) => s + i.amount, 0);
  const newSites = on.filter((i) => i.group === "new-site").reduce((s, i) => s + i.amount, 0);
  const remaining = budget - spent;
  return {
    spent,
    ebitda,
    remaining,
    overBudget: remaining < 0,
    paybackYears: ebitda > 0 ? spent / ebitda : null,
    /** profit earned over `years` minus the money spent */
    netReturn: ebitda * years - spent,
    roiPct: spent > 0 ? ((ebitda * years - spent) / spent) * 100 : 0,
    existingSharePct: spent > 0 ? (existing / spent) * 100 : 0,
    newSiteSharePct: spent > 0 ? (newSites / spent) * 100 : 0,
  };
}

/** When the amount changes, the yearly profit scales with it at the item's return rate. */
export function withAmount(item: PlanItem, amount: number): PlanItem {
  const a = Math.max(0, Math.round(amount));
  return { ...item, amount: a, ebitda: Math.round(a * item.returnRate) };
}

/** Editing the profit directly resets the return rate used for future amount changes. */
export function withEbitda(item: PlanItem, ebitda: number): PlanItem {
  const e = Math.round(ebitda);
  return { ...item, ebitda: e, returnRate: item.amount > 0 ? e / item.amount : 0 };
}

export function paybackYears(amount: number, ebitda: number) {
  return ebitda > 0 ? amount / ebitda : null;
}

/** Downside case: profit falls short and the build costs more than quoted. */
export function stressTest(amount: number, ebitda: number, profitShortfallPct = 25, overrunPct = 15) {
  const cost = amount * (1 + overrunPct / 100);
  const profit = ebitda * (1 - profitShortfallPct / 100);
  return { cost, profit, paybackYears: paybackYears(cost, profit) };
}

// ---------- Team performance ----------
type TeamStore = { store_id: string; store_name: string; profit: number; staff: { headcount: number } };

/** The café team earning the most operating profit per team member. */
export function topPerformingTeam<T extends TeamStore>(stores: T[]) {
  const ranked = stores
    .filter((s) => s.staff.headcount > 0)
    .map((s) => ({ store: s, profitPerHead: s.profit / s.staff.headcount }))
    .sort((a, b) => b.profitPerHead - a.profitPerHead);
  return ranked[0];
}

/** Total people employed across all cafés. */
export function totalStaff(stores: TeamStore[]) {
  return stores.reduce((a, s) => a + s.staff.headcount, 0);
}
