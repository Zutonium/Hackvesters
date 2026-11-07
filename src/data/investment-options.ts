/**
 * Investment options and the risk library behind the £1.5M planner.
 * The recommended plan and candidate-site figures come from dashboard.json; the extra
 * "improve a current café" ideas below are planning estimates the CEO can overwrite.
 */
import type { PlanGroup, PlanItem } from "@/lib/models";
import type { DashboardData } from "@/lib/types";

export type RiskLevel = "Low" | "Medium" | "High";
export type RiskProfile = {
  level: RiskLevel;
  shortTerm: string[];
  longTerm: string[];
  mitigations: string[];
  watch: string[];
};

export const GROUP_LABELS: Record<PlanGroup, string> = {
  "new-site": "New café",
  "existing-store": "Improve a current café",
  "chain-wide": "All current cafés",
  reserve: "Reserve",
};

export const CATEGORY_CHOICES: { label: string; group: PlanGroup }[] = [
  { label: "Improve a current café", group: "existing-store" },
  { label: "Across all current cafés", group: "chain-wide" },
  { label: "New café", group: "new-site" },
  { label: "Reserve / other", group: "reserve" },
];

/** Ideas for improving current locations that are not in the recommended plan (estimates). */
export const EXISTING_STORE_IDEAS: {
  id: string;
  storeId?: string;
  name: (storeName: string) => string;
  amount: number;
  ebitda: number;
  rationale: string;
  group: PlanGroup;
}[] = [
  {
    id: "S03-refresh",
    storeId: "S03",
    name: (s) => `${s}: weekend seating & menu refresh`,
    amount: 70_000,
    ebitda: 26_000,
    rationale:
      "Win back regulars lost to Trinity: add weekend seats, refresh the counter and reset food prep levels that haven't changed since last year.",
    group: "existing-store",
  },
  {
    id: "S06-lunch",
    storeId: "S06",
    name: (s) => `${s}: grab-and-go lunch counter`,
    amount: 60_000,
    ebitda: 32_000,
    rationale:
      "Office workers have 30-minute lunch breaks and sandwiches sell out by 1:15pm. A chilled grab-and-go fridge and app pre-order lane stops people turning round at the door.",
    group: "existing-store",
  },
  {
    id: "S12-turnaround",
    storeId: "S12",
    name: (s) => `${s}: turnaround plan`,
    amount: 45_000,
    ebitda: 20_000,
    rationale:
      "The newest café is underperforming. Local office marketing, an afternoon menu and a tighter rota to lift sales without taking more from Briggate.",
    group: "existing-store",
  },
  {
    id: "S11-format",
    storeId: "S11",
    name: (s) => `${s}: term-time format`,
    amount: 20_000,
    ebitda: 9_000,
    rationale:
      "Match opening hours and staffing to the university calendar, with a smaller menu outside term to cut waste.",
    group: "existing-store",
  },
  {
    id: "energy",
    name: () => "Energy-saving equipment in every café",
    amount: 85_000,
    ebitda: 21_000,
    rationale:
      "Efficient espresso machines, fridges and smart meters across the 12 cafés to bring utility bills down and avoid emergency breakdowns.",
    group: "chain-wide",
  },
];

const tag = (name: string) => /\((CS\d+|S\d+)\)/.exec(name)?.[1];

function recommendedKey(name: string, category: string) {
  const t = tag(name);
  if (t?.startsWith("CS")) return t;
  if (t === "S04") return "S04-refit";
  if (t === "S07") return "S07-hatch";
  if (t === "S10") return "S10-refurb";
  if (/digital|app/i.test(name)) return "digital";
  if (/staff|retention/i.test(name)) return "people";
  if (/contingency/i.test(category)) return "reserve";
  return undefined;
}

function recommendedGroup(name: string, category: string): PlanGroup {
  const t = tag(name);
  if (t?.startsWith("CS") || /new store/i.test(category)) return "new-site";
  if (/contingency|reserve/i.test(category)) return "reserve";
  if (t?.startsWith("S")) return "existing-store";
  return "chain-wide";
}

export function recommendedPlan(data: DashboardData): PlanItem[] {
  return data.budget_plan.categories.map((b, i) => {
    const t = tag(b.name);
    return {
      id: `rec-${i}`,
      name: b.name,
      category: b.category,
      group: recommendedGroup(b.name, b.category),
      amount: b.allocated_gbp,
      ebitda: b.projected_annual_ebitda,
      returnRate: b.allocated_gbp > 0 ? b.projected_annual_ebitda / b.allocated_gbp : 0,
      included: true,
      source: "recommended",
      rationale: b.rationale,
      riskKey: recommendedKey(b.name, b.category),
      storeId: t && !t.startsWith("CS") ? t : undefined,
    };
  });
}

/** Options the CEO can add: unused candidate sites plus ideas for current cafés. */
export function extraOptions(data: DashboardData, inPlan: PlanItem[]): PlanItem[] {
  const used = new Set(inPlan.map((i) => i.riskKey));
  const sites: PlanItem[] = data.candidate_sites
    .filter((s) => !used.has(s.site_id))
    .map((s) => ({
      id: `opt-${s.site_id}`,
      name: `New site: ${s.site_name} (${s.site_id})`,
      category: "New Store Expansion",
      group: "new-site" as const,
      amount: s.est_fitout_gbp,
      ebitda: Math.round(s.projected_ebitda_gbp),
      returnRate: s.est_fitout_gbp > 0 ? s.projected_ebitda_gbp / s.est_fitout_gbp : 0,
      included: true,
      source: "option" as const,
      rationale: s.recommendation,
      riskKey: s.site_id,
    }));
  const ideas: PlanItem[] = EXISTING_STORE_IDEAS.filter((x) => !used.has(x.id)).map((x) => {
    const store = data.stores.find((s) => s.store_id === x.storeId);
    return {
      id: `opt-${x.id}`,
      name: x.name(store?.store_name ?? "Store"),
      category: x.group === "chain-wide" ? "All current cafés" : "Store improvement",
      group: x.group,
      amount: x.amount,
      ebitda: x.ebitda,
      returnRate: x.ebitda / x.amount,
      included: true,
      source: "option",
      rationale: `${x.rationale} (Planning estimate — edit the figures to your own.)`,
      riskKey: x.id,
      storeId: x.storeId,
    };
  });
  return [...ideas, ...sites];
}

const RISKS: Record<string, RiskProfile> = {
  CS3: {
    level: "Low",
    shortTerm: [
      "Student footfall drops sharply in summer and holidays, so the first months' sales may look weaker than the yearly projection.",
      "Fit-out and licensing on a busy corridor can slip, delaying opening by weeks.",
      "Hiring a full team in Manchester while Piccadilly and Spinningfields already struggle to keep baristas.",
    ],
    longTerm: [
      "Rents on Oxford Road are rising as the area develops; the next rent review could squeeze the margin.",
      "National chains are targeting the same student and hospital crowd.",
      "Relies on the campus and hospital staying at today's size.",
    ],
    mitigations: [
      "Plan a holiday-season rota and smaller menu from day one.",
      "Negotiate a capped rent review in the lease.",
      "Recruit early and pay the lunch premium that Manchester baristas expect.",
    ],
    watch: ["Weekly sales vs plan in the first 12 weeks", "Staff turnover", "Term vs holiday sales split"],
  },
  CS4: {
    level: "Low",
    shortTerm: [
      "Station landlords often set strict opening hours and approval steps, which can delay launch.",
      "Rail strikes or timetable changes hit a commuter kiosk immediately.",
    ],
    longTerm: [
      "Concession fees at stations are often linked to turnover and can rise at renewal.",
      "More hybrid working would reduce weekday commuter numbers.",
      "Small kiosk has little room to grow beyond takeaway.",
    ],
    mitigations: [
      "Copy the Sheffield Station kiosk playbook (menu, rota, layout) exactly.",
      "Agree a turnover-rent cap before signing.",
      "Build a weekend leisure-traveller offer to spread risk.",
    ],
    watch: ["Morning peak sales per hour", "Queue time at 7–9am", "Station passenger numbers"],
  },
  CS1: {
    level: "Medium",
    shortTerm: [
      "Highest fit-out of the recommended sites, so any overrun costs the most.",
      "Headingley trade is student-heavy — slower in summer and at Christmas.",
      "Opening a third Leeds café while Trinity is still bedding in stretches local management.",
    ],
    longTerm: [
      "Competition on the high street is already dense; another chain could open nearby.",
      "Leeds now carries more of the chain's risk if the city's economy softens.",
    ],
    mitigations: [
      "Fixed-price fit-out contract with a penalty for delays.",
      "Appoint a manager from a strong store rather than hiring externally.",
      "Lean on the app and loyalty scheme to build regulars before students leave for summer.",
    ],
    watch: ["Weekly sales vs plan", "Briggate and Trinity sales after opening", "Summer dip size"],
  },
  CS5: {
    level: "Medium",
    shortTerm: [
      "Largest fit-out of all seven sites — the biggest single cheque.",
      "A new city for the chain: no local suppliers, managers or brand awareness yet.",
    ],
    longTerm: [
      "Running a café far from the other stores makes area management and deliveries more expensive.",
      "Bold Street is a destination street with strong independents; tastes can shift quickly.",
    ],
    mitigations: [
      "Treat it as the first step into Liverpool only if a second site is planned.",
      "Second a proven manager and set a 6-month review point.",
    ],
    watch: ["Sales ramp-up vs plan", "Cost of supplying from the nearest hub", "Review scores in the first 3 months"],
  },
  CS6: {
    level: "High",
    shortTerm: [
      "Shopping-centre footfall depends on the centre's other tenants and opening hours.",
      "Thin projected profit means a slow start could mean losses in year one.",
    ],
    longTerm: [
      "Payback takes most of a decade, which ties up money that could go elsewhere.",
      "Shopping centres nationally are losing footfall to retail parks and online.",
    ],
    mitigations: ["Only proceed with a rent-free period and a short break clause.", "Revisit if the centre's footfall improves."],
    watch: ["Centre footfall reports", "Profit per month vs break-even"],
  },
  CS2: {
    level: "High",
    shortTerm: [
      "Large fit-out on a site with low street footfall: very little profit in year one.",
      "A trendy area attracts independents with loyal followings who are hard to win from.",
    ],
    longTerm: [
      "Payback runs to decades on today's numbers — effectively money that never comes back.",
      "Area growth may come, but the chain would be paying rent while it waits.",
    ],
    mitigations: [
      "Do not open now. Revisit in 2–3 years if footfall grows.",
      "Consider a pop-up or market stall to test demand cheaply.",
    ],
    watch: ["Street footfall counts", "New office and residential completions in the area"],
  },
  CS7: {
    level: "High",
    shortTerm: [
      "Projected to lose money every year from opening.",
      "Very high rent locks in a fixed loss regardless of how well the team performs.",
    ],
    longTerm: [
      "Takes customers from Briggate and Trinity, which are within half a mile.",
      "Two national chains are in talks for units there, which would split the new office workers further.",
    ],
    mitigations: ["Avoid. If the office growth materialises, serve it from Trinity with a pre-order offer instead."],
    watch: ["Trinity and Briggate sales", "Actual office occupancy at Wellington Place"],
  },
  "S04-refit": {
    level: "Low",
    shortTerm: [
      "The refit closes or disrupts the most profitable café — a few weeks of lost sales.",
      "Tourist season timing matters: a summer refit would cost far more in lost trade.",
    ],
    longTerm: [
      "Extra seats only pay back if tourist numbers in York stay strong.",
      "A modern look needs keeping up; the next refresh will be due in 5–7 years.",
    ],
    mitigations: ["Refit in January–February, in phases, keeping takeaway open.", "Set a seat-occupancy target for the new seating."],
    watch: ["Sales during the refit weeks", "Weekend seat occupancy", "Average spend per visit"],
  },
  "S07-hatch": {
    level: "Medium",
    shortTerm: [
      "Building work in a station location needs landlord sign-off and can be delayed.",
      "Extra lunch staff cost money from day one, before the shorter queues win sales back.",
    ],
    longTerm: [
      "If staff turnover stays high, the extra hours won't be filled and walk-outs continue.",
      "Delivery commission rises (Dashly to 33%) can still erode profit on delivery orders.",
    ],
    mitigations: ["Pair the hatch with the £8 delivery minimum.", "Fund the lunch premium so new staff stay."],
    watch: ["Lunch queue length and walk-outs", "Profit per month (currently a loss)", "Staff leavers"],
  },
  "S10-refurb": {
    level: "Low",
    shortTerm: ["A day or two of closure while the boiler and dishwasher are swapped.", "Hiring a cleaner adds a cost straight away."],
    longTerm: [
      "Hull footfall is below 2019 levels; better kit fixes costs but not demand.",
      "Older building may reveal further repairs once work starts.",
    ],
    mitigations: ["Survey the building before ordering kit.", "Track repair call-outs to prove the saving."],
    watch: ["Repair bills per month", "Cleanliness complaints", "Staff survey score"],
  },
  digital: {
    level: "Medium",
    shortTerm: [
      "The last app launch (v3.0) lost loyalty stamps and froze at checkout — a repeat would damage trust.",
      "Forecasting tools need several weeks of data and staff training before waste falls.",
    ],
    longTerm: [
      "Tech projects often run over budget and need ongoing licence and support costs.",
      "Benefits depend on staff actually following the forecast prep levels.",
    ],
    mitigations: [
      "Pilot in 2–3 stores before chain-wide rollout.",
      "Measure click-and-collect orders, not downloads.",
      "Tie supplier payments to milestones.",
    ],
    watch: ["App orders per week", "Food waste % by store", "App complaint count"],
  },
  people: {
    level: "Medium",
    shortTerm: [
      "The pay premium costs money immediately; turnover falls more slowly.",
      "Staff at stores without the premium may feel left out.",
    ],
    longTerm: [
      "National Living Wage keeps rising, so today's premium may stop being competitive.",
      "Money alone won't fix turnover if lunch shifts stay understaffed.",
    ],
    mitigations: ["Combine the premium with more lunch hours on the rota.", "Review pay against local rivals every April."],
    watch: ["Leavers per month at Piccadilly and Spinningfields", "Exit survey reasons", "Agency and training spend"],
  },
  reserve: {
    level: "Low",
    shortTerm: ["Money held back earns nothing on its own."],
    longTerm: ["Holding too much reserve slows growth; too little leaves the plan exposed to overruns."],
    mitigations: ["Release it to the next best project once the new sites are open and on budget."],
    watch: ["Fit-out spend vs budget", "Cash balance"],
  },
  "S03-refresh": {
    level: "Medium",
    shortTerm: ["Work in a busy city-centre café disrupts trade.", "Regulars who moved to Trinity may not come back quickly."],
    longTerm: ["Any Briggate gain may partly come from Trinity — the chain gains less than the store does."],
    mitigations: ["Do the work midweek and overnight.", "Track Briggate and Trinity together."],
    watch: ["Weekend sales", "Food waste %", "Combined Leeds sales"],
  },
  "S06-lunch": {
    level: "Low",
    shortTerm: ["Fridge stock that doesn't sell adds to food waste.", "Needs a reliable morning delivery of sandwiches."],
    longTerm: ["Office attendance patterns (hybrid working) decide how busy weekday lunches stay."],
    mitigations: ["Start with a small range and use the forecasting tool for quantities."],
    watch: ["Sandwich sell-out time", "Lunch sales per hour", "Waste in the lunch category"],
  },
  "S12-turnaround": {
    level: "Medium",
    shortTerm: ["Marketing spend shows results slowly; the first months may not improve."],
    longTerm: ["If Trinity mainly takes trade from Briggate, the problem is location, not marketing."],
    mitigations: ["Set a 6-month target; if missed, consider merging the Leeds offer."],
    watch: ["New vs returning customers", "Monthly profit", "Briggate sales"],
  },
  "S11-format": {
    level: "Low",
    shortTerm: ["Shorter hours outside term may frustrate staff who want steady shifts."],
    longTerm: ["Student numbers and campus policies can change."],
    mitigations: ["Offer staff shifts at nearby Sheffield stores outside term."],
    watch: ["Sales in vs out of term", "Waste %"],
  },
  energy: {
    level: "Low",
    shortTerm: ["Installing kit across 12 cafés takes coordination and short closures."],
    longTerm: ["Savings depend on energy prices; if they fall, payback lengthens."],
    mitigations: ["Install in the quietest weeks and start with the stores with the highest bills."],
    watch: ["Utility bills per store", "Repair call-outs"],
  },
};

const FALLBACK: Record<PlanGroup, RiskProfile> = {
  "new-site": RISKS["CS1"]!,
  "existing-store": {
    level: "Medium",
    shortTerm: [
      "Work at a trading café disrupts sales while it happens.",
      "Benefits take a few months to show in the figures.",
    ],
    longTerm: [
      "If the store's real problem is its location or rent, improvements may not be enough.",
      "Gains at one café can come from customers of a nearby café.",
    ],
    mitigations: ["Agree a clear target and review date before spending.", "Phase the work so the café stays open."],
    watch: ["Monthly profit vs before", "Customer reviews", "Staff turnover"],
  },
  "chain-wide": {
    level: "Medium",
    shortTerm: ["Rolling out to 12 cafés at once stretches managers and suppliers."],
    longTerm: ["Savings depend on every store adopting the change and keeping it up."],
    mitigations: ["Pilot in 2–3 stores first, then roll out."],
    watch: ["Results in the pilot stores vs the rest"],
  },
  reserve: RISKS["reserve"]!,
};

export function riskFor(item: Pick<PlanItem, "riskKey" | "group">): RiskProfile {
  return (item.riskKey && RISKS[item.riskKey]) || FALLBACK[item.group];
}
