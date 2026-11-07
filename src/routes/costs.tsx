import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Cell, Pie, PieChart, Tooltip } from "recharts";

import {
  Briefing,
  BriefingPoint,
  chartTooltipStyle,
  PageHeader,
  Panel,
  ChartFrame,
} from "@/components/dash/primitives";
import { Switch } from "@/components/ui/switch";
import { useDashboard } from "@/lib/data-context";
import { gbp, gbpShort, pct } from "@/lib/format";
import { COST_LEVERS, costSavings, marginAfterSavings } from "@/lib/models";

export const Route = createFileRoute("/costs")({
  head: () => ({
    meta: [
      { title: "Costs & Savings — Grind and Crumb" },
      {
        name: "description",
        content:
          "Where Grind and Crumb's £7.6M of costs go, what can be renegotiated, and a simulator for the annual savings.",
      },
      { property: "og:title", content: "Grind and Crumb — Costs & Savings" },
      { property: "og:description", content: "Cost breakdown and a savings simulator for the café chain." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CostsPage,
});

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--negative)",
  "var(--chart-5)",
  "var(--chart-3)",
  "var(--warning)",
  "var(--muted-foreground)",
];

function CostsPage() {
  const { data } = useDashboard();
  const c = data.chain;
  const [selected, setSelected] = useState<string[]>(COST_LEVERS.map((l) => l.id));
  const savings = costSavings(selected);
  const newMargin = marginAfterSavings(c.total_revenue, c.total_profit, savings);
  const capex = data.capex_history.reduce((a, x) => a + x.capex_gbp, 0);

  const costs = [
    { label: "Labour", value: c.total_labour, note: "Rota hours × wage × 1.13 on-costs" },
    { label: "Ingredients", value: c.total_cogs, note: "Food & drink cost of goods" },
    { label: "Rent", value: c.total_rent, note: "12 commercial leases" },
    { label: "Delivery fees", value: c.total_delivery_costs, note: "RushEats & Dashly commission + packaging" },
    { label: "Utilities", value: c.total_utilities, note: "Gas, electricity & water" },
    { label: "Business rates", value: c.total_rates, note: "Local council rates" },
    { label: "Other running costs", value: c.total_other_opex, note: "Cleaning, napkins, consumables" },
    { label: "Repairs", value: c.total_repairs, note: "Boilers, dishwashers, espresso machines" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Costs & savings"
        title="Spending/Costs"
        description={`${gbp(c.total_expenses)} of costs against ${gbp(c.total_revenue)} of sales. Labour, ingredients and rent make up ${pct(((c.total_labour + c.total_cogs + c.total_rent) / c.total_expenses) * 100, 0)} of the bill.`}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {costs.map((x, i) => (
          <div key={x.label} className="surface p-4">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: COLORS[i] }} />
              <span className="eyebrow text-muted-foreground">{x.label}</span>
            </div>
            <div className="num mt-2 text-xl font-semibold">{gbp(x.value)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {pct((x.value / c.total_expenses) * 100)} of costs · {x.note}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Cost structure" subtitle="Share of the year's operating costs">
          <div className="h-80">
            <ChartFrame>
              <PieChart>
                <Pie
                  data={costs}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={1.5}
                  stroke="var(--card)"
                >
                  {costs.map((x, i) => (
                    <Cell key={x.label} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip {...chartTooltipStyle} formatter={(v: number) => gbp(v)} />
              </PieChart>
            </ChartFrame>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Past refit & new-store spend (not in running costs): {gbp(capex)} —{" "}
            {data.capex_history.map((x) => `${x.store_name} ${gbpShort(x.capex_gbp)}`).join(", ")}.
          </p>
        </Panel>

        <Panel title="Savings simulator" subtitle="Switch levers on or off to see the yearly impact">
          <div className="grid gap-2">
            {COST_LEVERS.map((l) => {
              const on = selected.includes(l.id);
              return (
                <label
                  key={l.id}
                  className="flex cursor-pointer items-center gap-4 rounded-lg border bg-background p-3 transition hover:border-brand"
                >
                  <Switch
                    checked={on}
                    onCheckedChange={(v) =>
                      setSelected((s) => (v ? [...s, l.id] : s.filter((x) => x !== l.id)))
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{l.label}</div>
                    <div className="text-xs text-muted-foreground">{l.detail}</div>
                  </div>
                  <span className="num text-sm font-semibold text-positive">+{gbpShort(l.saving)}</span>
                </label>
              );
            })}
          </div>
          <div className="surface-ink mt-5 p-5">
            <div className="eyebrow text-sidebar-primary">Projected annual saving</div>
            <div className="num mt-1 text-3xl font-semibold">{gbp(savings)} / year</div>
            <div className="mt-1 text-sm text-ink-foreground/80">
              Lifts chain margin from {pct(c.overall_margin)} to{" "}
              <strong className="text-ink-foreground">{pct(newMargin)}</strong>.
            </div>
          </div>
        </Panel>
      </div>

      <Briefing
        title="Where money can be saved, renegotiated or rethought"
        question="Which cost savings should we do first, and how much will they save?"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <BriefingPoint title={`Labour (${gbpShort(c.total_labour)} · ${pct((c.total_labour / c.total_revenue) * 100)} of sales)`}>
            Don't cut total hours — move them. Trim quiet Monday/Tuesday mornings and put 4–6 hours into
            the 11:30–13:30 rush at the station and office stores.
          </BriefingPoint>
          <BriefingPoint title={`Delivery fees (${gbpShort(c.total_delivery_costs)})`}>
            Dashly raised commission from 27% to 33%. Push back to 28% using RushEats exclusivity as
            leverage — worth about £22,500 a year.
          </BriefingPoint>
          <BriefingPoint title={`Rent (${gbpShort(c.total_rent)})`}>
            Piccadilly's £366k rent is out of line with what the store captures. Open talks with the
            landlord on a base-plus-turnover lease.
          </BriefingPoint>
          <BriefingPoint title={`Repairs (${gbpShort(c.total_repairs)}) & consumables (${gbpShort(c.total_other_opex)})`}>
            Emergency callouts at Hull and Spinningfields are burning cash — replace the old kit. Put
            cups, chemicals and paper on one national contract for an 8–10% rebate.
          </BriefingPoint>
        </div>
      </Briefing>
    </>
  );
}
