import raw from "@/data/dashboard.json";
import type { DashboardData } from "@/lib/types";

const data = raw as unknown as DashboardData;

const STAKEHOLDER_NOTES = `
STAKEHOLDER INTERVIEWS (May-June 2026)
- Anna Whitfield, CEO: sales up every year since 2017 but profit flat. Proud of Leeds Trinity. Wants to keep opening; likes Kelham Island (Sheffield) and Wellington Place (Leeds) — "Leeds has been good to us". Wants delivery at 30% of sales. Thinks oat milk surcharge complaints are normal moaning. Only sees profit at month end ("by the time I see a problem it's six weeks old").
- Ollie Brent, Manager, Manchester Piccadilly: assumes biggest store = most profitable; rent "head office's problem". Lunch 12-1 queue >5 deep → commuters walk to station kiosks. Turnover relentless; concourse chain pays 50p/hr more. Asked for 2 extra lunch shifts, refused. Delivery tablets ping constantly, half are a single americano.
- Jordan, Barista, Piccadilly: 3 on lunch when should be 5; riders for single flat whites jam a 12-person queue; app v3 orders/stamps vanish; thinking of leaving.
- Grace Okafor, Manager, Leeds Briggate: thinks city centre is quieter; regulars moved to the new Trinity store; par levels unchanged from last year; bins more than before; weekend seating tight.
- Marcus Dyer, Manager, Hull Paragon: over-orders to be safe; cleaner left in October not replaced; dishwasher broke 3 times, boiler old, engineers always in; Hull is price-sensitive.
- Sam Kowalski, Manager, Manchester Spinningfields: lunch is everything (offices), weekends dead; 30-min lunch windows, people turn round at the door; lost 4 baristas in spring; sells out of sandwiches by 1:15pm.
- Rohan Mehta, Head of Digital: App v3.0 launched 2 Mar 2026; stamp migration bug and checkout freeze on older phones; v3.1 on 13 Apr fixed most; tracks downloads (+20%) not click & collect orders; wants budget for v4.

MARKET NOTES
- 14 Jan 2026: rival Bean Social scrapped its 45p plant-milk charge across 40 northern sites.
- Mar 2026: arabica prices well above 5-year average; expected to ease late 2026.
- Feb 2026: Wellington Place adds 2,000 office workers in autumn 2026; two national chains in talks for units there.
- Apr 2026: Kelham Island is Sheffield's fastest-growing neighbourhood; few daytime cafés.
- May 2026: Hull city centre footfall ~8% below 2019.
- Jun 2026: Piccadilly station passenger numbers at a record; concourse outlets report long lunch queues.
- National Living Wage rose ~6.7% from 1 Apr 2026.
- Delivery is ~15% of sales for an average UK café chain; small delivery orders often lose money.

DELIVERY PARTNERS
- Dashly commission 27% → 33% from 1 Apr 2026 (finance accepted without negotiating). Optional "Boost" +4%.
- RushEats commission 30% fixed for 12 months; recommends £8 minimum basket or £1.50 small-order fee (partners saw AOV +18-25%). Packaging £0.45/order borne by Grind & Crumb.

BUSINESS EVENTS
- Leeds Trinity opened 15 Sep 2025, 0.4 miles from Briggate.
- £0.40 oat milk surcharge introduced 12 Jan 2026 (to recover ~£40k/yr).
- App v3.0 2 Mar 2026; v3.1 hotfix 13 Apr 2026.
- National Living Wage rise 1 Apr 2026.

PROMOTIONS: Pastry BOGO (Sep-Oct 2025, £4.5k), Lunch Meal Deal £7.50 (Nov 2025-Jan 2026, 6 stores, £6k), Festive Menu (£8k), App Double Stamps (Feb 2026, £3.5k), Student 20% off at S11, Matcha launch (Feb 2026, £7k).
`;

const r = (v: number) => Math.round(v).toLocaleString("en-GB");

function digest(d: DashboardData) {
  const c = d.chain;
  const lines: string[] = [];
  lines.push(
    `CHAIN FY2025/26 (Jul 2025 - Jun 2026): revenue £${r(c.total_revenue)} (in-store £${r(c.instore_revenue)}, app £${r(c.app_revenue)}, delivery £${r(c.delivery_revenue)}); expenses £${r(c.total_expenses)}; operating profit £${r(c.total_profit)} (${c.overall_margin}% margin). Labour £${r(c.total_labour)}, ingredients £${r(c.total_cogs)}, rent £${r(c.total_rent)}, rates £${r(c.total_rates)}, utilities £${r(c.total_utilities)}, repairs £${r(c.total_repairs)}, other opex £${r(c.total_other_opex)}, delivery commission £${r(c.total_delivery_commission)} + packaging £${r(c.total_delivery_packaging)}. Food waste £${r(c.total_waste_cost)}. Orders ${r(c.total_orders)}, footfall ${r(c.total_footfall)}.`,
  );
  lines.push(
    "CHAIN MONTHLY (month: sales / profit / margin): " +
      d.chain_monthly_trend.map((m) => `${m.month}: £${r(m.sales)} / £${r(m.profit)} / ${m.margin}%`).join("; "),
  );
  lines.push("\nSTORES:");
  for (const s of d.stores) {
    const wc = Object.entries(s.waste.by_category)
      .map(([k, v]) => `${k} £${r(v.cost)} (${v.pct}%)`)
      .join(", ");
    lines.push(
      `- ${s.store_id} ${s.store_name} (${s.city}, ${s.format}, ${s.location_type}, opened ${s.opened_date}, ${s.seats} seats, manager ${s.store_manager}). Status: ${s.status}. Revenue £${r(s.sales.total)} (in-store £${r(s.sales.instore)}, app £${r(s.sales.app)}, delivery £${r(s.sales.delivery)}); profit £${r(s.profit)} (${s.margin}%). Costs: labour £${r(s.costs.labour)}, rent £${r(s.costs.rent)}, rates £${r(s.costs.rates)}, utilities £${r(s.costs.utilities)}, repairs £${r(s.costs.repairs)}, ingredients £${r(s.costs.cogs_ingredients)}, delivery fees £${r(s.costs.delivery_total)}. Waste £${r(s.waste.cost_wasted)} (${s.waste.waste_pct}%: ${wc}). Staff: headcount ${s.staff.headcount}, leavers ${s.staff.leavers}, turnover ${s.staff.turnover_rate_pct}%, survey ${s.staff.avg_survey_score}/10. Reviews: ${s.customer.review_count} at ${s.customer.avg_rating}★, complaints ${JSON.stringify(s.customer.complaints)}. Footfall ${r(s.footfall.annual_door_count)}, conversion ${s.footfall.conversion_rate_pct}%. Diagnosis: ${s.ai_diagnostic.headline} — ${s.ai_diagnostic.why_underperforming} Actions: ${s.ai_diagnostic.actionable_recommendations.join(" | ")}. Monthly profit: ${s.monthly_trend.map((m) => `${m.month} £${r(m.profit)}`).join(", ")}.`,
    );
  }
  lines.push("\nPRODUCTS (name, category, price, unit margin %, annual qty, annual revenue):");
  lines.push(
    d.products
      .map((p) => `${p.product_name} (${p.category}, £${p.menu_price_gbp}, ${p.margin_pct}%, ${r(p.annual_qty)}, £${r(p.annual_revenue)})`)
      .join("; "),
  );
  lines.push("\nCANDIDATE NEW SITES:");
  for (const s of d.candidate_sites) {
    lines.push(
      `- ${s.site_id} ${s.site_name} (${s.city}, ${s.location_type}, ${s.sqft} sqft): rent £${r(s.quoted_rent_gbp_month)}/mo, street footfall ${r(s.daily_footfall_street)}/day, office workers 500m ${r(s.office_workers_500m)}, students 1km ${r(s.students_1km)}, income £${r(s.median_household_income_gbp)}, competitors ${s.competitor_cafes_500m}, fit-out £${r(s.est_fitout_gbp)}, projected sales £${r(s.projected_sales_gbp)}, EBITDA £${r(s.projected_ebitda_gbp)} (${s.projected_margin_pct}%), payback ${s.payback_years} yrs. Cannibalisation: ${s.cannibalization_risk}. Verdict: ${s.recommendation}.`,
    );
  }
  lines.push(`\nRECOMMENDED £${r(d.budget_plan.total_budget_gbp)} ALLOCATION:`);
  for (const b of d.budget_plan.categories) {
    lines.push(`- ${b.name} [${b.category}]: £${r(b.allocated_gbp)} → +£${r(b.projected_annual_ebitda)}/yr EBITDA, payback ${b.payback_years} yrs. ${b.rationale}`);
  }
  const tot = d.budget_plan.categories.reduce((a, b) => a + b.projected_annual_ebitda, 0);
  lines.push(`Portfolio total: +£${r(tot)}/yr incremental EBITDA, blended payback ${(d.budget_plan.total_budget_gbp / tot).toFixed(2)} yrs.`);
  lines.push(
    `\nPAST CAPEX: ${d.capex_history.map((x) => `${x.store_name} ${x.description} ${x.month} £${r(x.capex_gbp)}`).join("; ")}.`,
  );
  const b = d.delivery_summary.orders_by_bracket;
  lines.push(
    `DELIVERY ORDER SAMPLE by basket: under £8 ${b.under_8}, £8-15 ${b["8_to_15"]}, £15-25 ${b["15_to_25"]}, over £25 ${b.over_25}. Partners: ${Object.entries(d.delivery_summary.partner_summary).map(([k, v]) => `${k} ${v.count} orders, £${r(v.sales)}, ${v.under_8} under £8`).join("; ")}.`,
  );
  lines.push(`STAFF EXIT REASONS (chain): ${JSON.stringify(d.staff_exit_reasons)}.`);
  return lines.join("\n");
}

export const ADVISOR_SYSTEM_PROMPT = `You are the Board Advisor for Anna Whitfield, CEO of Grind & Crumb, a 12-store specialty café chain in the North of England. The CEO has £1,500,000 to invest and wants to understand performance, costs, waste, resource use and where to put the money.

You are a full general-purpose assistant, not a menu of canned answers. Answer ANY question the CEO types — follow-ups, what-ifs, comparisons, calculations, drafting board papers, emails or staff messages, explaining finance terms, general hospitality and retail know-how, or anything else. Never reply with a stock or pre-written answer; reason about the exact question asked.

How to answer:
- Use the company data below wherever it is relevant and quote real figures in £ with thousands separators. When you use general knowledge or an assumption rather than the data, say so. If the CEO asks about something the data cannot show, say so plainly and still give your best reasoned view.
- When the CEO shares their own investment plan or amounts, evaluate those exact numbers (payback, realism of the profit estimate, risks) rather than repeating the recommended plan.
- Whenever you advise on where to invest or how to grow, always include options for improving the cafés we already run (fixing lunch bottlenecks, refits, staffing, waste, equipment, delivery terms) alongside any new sites, and compare the two.
- When asked about risks, separate short-term risks (first 12 months) from long-term risks (years 2–5) and suggest how to reduce each.
- Lead with the answer or recommendation in one or two sentences, then the evidence, then concrete next steps. Use short markdown headings and bullet lists; keep most answers under 250 words unless asked for detail.
- Be candid when the CEO's instincts conflict with the data (e.g. Wellington Place, Kelham Island, delivery growth, the oat milk surcharge).
- Write for a busy executive: plain business English, no jargon, no code.
- For comparisons use standard markdown pipe tables; never draw ASCII box tables or put answers in code blocks.

=== COMPANY DATA ===
${digest(data)}

=== CONTEXT ===
${STAKEHOLDER_NOTES}`;
