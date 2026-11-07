import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from "recharts";

import {
  axisProps,
  Briefing,
  BriefingPoint,
  chartTooltipStyle,
  Kpi,
  PageHeader,
  Panel,
  ChartFrame,
} from "@/components/dash/primitives";
import { Slider } from "@/components/ui/slider";
import { useDashboard } from "@/lib/data-context";
import { gbp, gbpPence, gbpShort, n, pct } from "@/lib/format";
import { deliveryEconomics, type DeliveryInputs } from "@/lib/models";

export const Route = createFileRoute("/delivery")({
  head: () => ({
    meta: [
      { title: "Delivery — Grind and Crumb" },
      {
        name: "description",
        content:
          "Why small delivery orders lose money, how RushEats and Dashly compare, and a pricing calculator to protect margin.",
      },
      { property: "og:title", content: "Grind and Crumb — Delivery Economics" },
      { property: "og:description", content: "Delivery partner costs and a pricing calculator." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeliveryPage,
});

const SLIDERS: {
  key: keyof DeliveryInputs;
  label: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
}[] = [
  { key: "minBasket", label: "Minimum basket before a fee applies", min: 0, max: 15, step: 0.5, fmt: gbpPence },
  { key: "smallOrderFee", label: "Small-order fee", min: 0, max: 3, step: 0.25, fmt: gbpPence },
  { key: "commissionPct", label: "Platform commission", min: 20, max: 35, step: 0.5, fmt: (v) => pct(v) },
  { key: "markupPct", label: "Delivery menu markup", min: 0, max: 30, step: 1, fmt: (v) => pct(v, 0) },
];

function DeliveryPage() {
  const { data } = useDashboard();
  const c = data.chain;
  const b = data.delivery_summary.orders_by_bracket;
  const partners = data.delivery_summary.partner_summary;
  const totalSample = b.under_8 + b["8_to_15"] + b["15_to_25"] + b.over_25;
  const partnerTotal = Object.values(partners).reduce((a, p) => a + p.count, 0);
  const [inputs, setInputs] = useState<DeliveryInputs>({
    minBasket: 8,
    smallOrderFee: 1.5,
    commissionPct: 28.5,
    markupPct: 10,
  });
  const result = deliveryEconomics(inputs);

  const brackets = [
    { label: "Under £8", value: b.under_8, color: "var(--negative)" },
    { label: "£8–15", value: b["8_to_15"], color: "var(--chart-1)" },
    { label: "£15–25", value: b["15_to_25"], color: "var(--chart-3)" },
    { label: "Over £25", value: b.over_25, color: "var(--chart-4)" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Delivery"
        title="Delivery statistics"
        description="Delivery sales, partner fees and order sizes across all cafés, plus a calculator to test pricing rules."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Kpi label="Delivery sales" value={gbpShort(c.delivery_revenue)} sub={`${pct((c.delivery_revenue / c.total_revenue) * 100)} of revenue`} />
        <Kpi label="Fees paid" value={gbpShort(c.total_delivery_costs)} sub={`${pct((c.total_delivery_costs / c.delivery_revenue) * 100)} of delivery sales`} tone="negative" />
        <Kpi label="Orders under £8" value={pct((b.under_8 / totalSample) * 100)} sub="Lose money after costs" tone="warning" />
        <Kpi label="Dashly commission" value="33%" sub="Up from 27% on 1 April" tone="negative" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Order size mix" subtitle={`Sample of ${n(totalSample)} delivery orders`} className="lg:col-span-3">
          <div className="h-64">
            <ChartFrame>
              <BarChart data={brackets}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} width={44} />
                <Tooltip {...chartTooltipStyle} formatter={(v: number) => [n(v), "Orders"]} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {brackets.map((x) => (
                    <Cell key={x.label} fill={x.color} />
                  ))}
                </Bar>
              </BarChart>
            </ChartFrame>
          </div>
        </Panel>
        <div className="grid gap-4 lg:col-span-2">
          {Object.entries(partners).map(([name, p]) => (
            <div key={name} className="surface p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl">{name}</h3>
                <span className="num text-sm font-semibold text-muted-foreground">
                  {name === "Dashly" ? "33% commission" : "30% commission"}
                </span>
              </div>
              <div className="num mt-3 text-2xl font-semibold">{pct((p.count / partnerTotal) * 100)}</div>
              <div className="text-xs text-muted-foreground">
                of sampled orders · {n(p.count)} orders · {pct((p.under_8 / p.count) * 100)} under £8
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={name === "Dashly" ? "h-full bg-negative" : "h-full bg-chart-1"}
                  style={{ width: `${(p.count / partnerTotal) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Panel title="Delivery pricing calculator" subtitle="Test pricing rules and see the profit on an average order">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="grid gap-6">
            {SLIDERS.map((s) => (
              <div key={s.key}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">{s.label}</span>
                  <span className="num font-semibold text-brand">{s.fmt(inputs[s.key])}</span>
                </div>
                <Slider
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={[inputs[s.key]]}
                  onValueChange={([v]) => v !== undefined && setInputs((i) => ({ ...i, [s.key]: v }))}
                  aria-label={s.label}
                />
              </div>
            ))}
          </div>
          <div className="surface-ink grid content-start gap-5 p-6">
            <div>
              <div className="eyebrow text-sidebar-primary">Profit per average order</div>
              <div className="num mt-1 text-3xl font-semibold">{gbpPence(result.netPerOrder)}</div>
              <div className="text-sm text-ink-foreground/75">
                on an average basket of {gbpPence(result.effectiveAov)}
              </div>
            </div>
            <div>
              <div className="eyebrow text-sidebar-primary">Delivery margin</div>
              <div className="num mt-1 text-2xl font-semibold">{pct(result.netMarginPct)}</div>
            </div>
            <div className="rounded-lg bg-ink-foreground/10 p-4">
              <div className="eyebrow text-sidebar-primary">Extra chain profit per year</div>
              <div className="num mt-1 text-2xl font-semibold">+{gbp(result.annualUplift)}</div>
              <div className="text-xs text-ink-foreground/70">vs today's ~£2.80 profit per order, across ~111,000 orders</div>
            </div>
          </div>
        </div>
      </Panel>

      <Briefing title="Fixing the delivery margin leak" question="Should we bring in an £8 minimum basket on delivery?">
        <div className="grid gap-4 md:grid-cols-2">
          <BriefingPoint title="The under-£8 problem">
            A single £3.50 Americano on Dashly: commission takes £1.16, packaging £0.45, ingredients
            £0.56 and four minutes of barista time £0.87. That leaves £0.46 before rent — and it blocks
            the queue for walk-in customers.
          </BriefingPoint>
          <BriefingPoint title="Partner strategy">
            RushEats carries most of the volume at a fixed 30% for 12 months and is recommending an £8
            minimum or £1.50 small-order fee — partners who did it saw average orders rise 18–25%. Use
            that to push Dashly back down.
          </BriefingPoint>
        </div>
      </Briefing>
    </>
  );
}
