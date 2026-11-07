import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";

import {
  axisProps,
  Briefing,
  BriefingPoint,
  chartTooltipStyle,
  PageHeader,
  Panel,
  ChartFrame,
} from "@/components/dash/primitives";
import { useDashboard } from "@/lib/data-context";
import { gbp, gbpShort, n, pct } from "@/lib/format";

export const Route = createFileRoute("/waste")({
  head: () => ({
    meta: [
      { title: "Food Waste — Grind and Crumb" },
      {
        name: "description",
        content:
          "How much food each Grind and Crumb café bins, which categories cost most, and three ways to cut it.",
      },
      { property: "og:title", content: "Grind and Crumb — Food Waste" },
      { property: "og:description", content: "Food waste by store and category, with fixes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WastePage,
});

const PIE_COLORS = [
  "var(--chart-2)",
  "var(--chart-1)",
  "var(--chart-4)",
  "var(--chart-3)",
  "var(--chart-5)",
  "var(--negative)",
  "var(--warning)",
  "var(--positive)",
  "var(--brand-soft)",
  "var(--muted-foreground)",
  "var(--sidebar-accent)",
  "var(--accent)",
];

function WastePage() {
  const { data } = useDashboard();
  const stores = [...data.stores].sort((a, b) => b.waste.cost_wasted - a.waste.cost_wasted);

  const cats: Record<string, { prep: number; wasted: number; cost: number }> = {};
  for (const s of data.stores) {
    for (const [k, v] of Object.entries(s.waste.by_category)) {
      cats[k] ??= { prep: 0, wasted: 0, cost: 0 };
      cats[k].prep += v.prep;
      cats[k].wasted += v.wasted;
      cats[k].cost += v.cost;
    }
  }
  const categories = Object.entries(cats)
    .map(([name, v]) => ({ name, ...v, pct: v.prep ? (v.wasted / v.prep) * 100 : 0 }))
    .sort((a, b) => b.cost - a.cost);
  const total = data.chain.total_waste_cost;
  const storeTotal = stores.reduce((a, s) => a + s.waste.cost_wasted, 0);
  const pie = stores.map((s, i) => ({
    id: s.store_id,
    name: s.store_name,
    cost: Math.round(s.waste.cost_wasted),
    share: storeTotal ? (s.waste.cost_wasted / storeTotal) * 100 : 0,
    color: PIE_COLORS[i % PIE_COLORS.length]!,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Food waste"
        title="Food Waste"
        description="How much food each café prepares and throws away, by store and by category."
      />

      <div className="grid gap-3 md:grid-cols-3 md:gap-4">
        {categories.map((c) => (
          <div key={c.name} className="surface p-5">
            <div className="eyebrow text-muted-foreground">{c.name}</div>
            <div className="num mt-2 text-2xl font-semibold text-warning-foreground">{gbp(c.cost)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {n(c.wasted)} items binned · {pct(c.pct)} of what was prepared
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-warning" style={{ width: `${(c.cost / total) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <Panel title="Share of waste by store" subtitle="Each café's slice of the total cost of food binned">
        <div className="grid items-center gap-6 md:grid-cols-2">
          <div className="h-80">
            <ChartFrame>
              <PieChart>
                <Pie
                  data={pie}
                  dataKey="cost"
                  nameKey="name"
                  innerRadius="50%"
                  outerRadius="88%"
                  paddingAngle={1.2}
                  stroke="var(--card)"
                >
                  {pie.map((x) => (
                    <Cell key={x.id} fill={x.color} />
                  ))}
                </Pie>
                <Tooltip {...chartTooltipStyle} formatter={(v: number) => [gbp(v), "Wasted"]} />
              </PieChart>
            </ChartFrame>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
            {pie.map((x) => (
              <li key={x.id} className="flex items-center gap-2 text-sm">
                <span className="size-3 shrink-0 rounded-sm" style={{ background: x.color }} />
                <span className="min-w-0 flex-1 truncate">{x.name}</span>
                <span className="num text-xs text-muted-foreground">{pct(x.share)}</span>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <Panel title="Waste cost by store" subtitle="Annual cost of food binned" className="lg:col-span-3">
          <div className="h-80">
            <ChartFrame>
              <BarChart data={stores.map((s) => ({ id: s.store_id, name: s.store_name, cost: Math.round(s.waste.cost_wasted) }))}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="id" {...axisProps} />
                <YAxis {...axisProps} width={48} tickFormatter={(v) => gbpShort(v)} />
                <Tooltip
                  {...chartTooltipStyle}
                  labelFormatter={(id) => stores.find((s) => s.store_id === id)?.store_name ?? id}
                  formatter={(v: number) => [gbp(v), "Wasted"]}
                />
                <Bar dataKey="cost" fill="var(--warning)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartFrame>
          </div>
        </Panel>
        <Panel title="Store breakdown" className="lg:col-span-2" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Store</th>
                  <th className="px-3 py-3 text-right font-semibold">Waste %</th>
                  <th className="px-4 py-3 text-right font-semibold">Cost</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <tr key={s.store_id} className="border-b last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold">{s.store_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {n(s.waste.units_wasted)} of {n(s.waste.units_prepared)} items
                      </div>
                    </td>
                    <td className="num px-3 py-2.5 text-right">{pct(s.waste.waste_pct)}</td>
                    <td className="num px-4 py-2.5 text-right font-semibold text-warning-foreground">
                      {gbp(s.waste.cost_wasted)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Briefing title="Cutting the waste bill" question="How do we reduce waste at Leeds Briggate?">
        <div className="grid gap-4 md:grid-cols-3">
          <BriefingPoint title="1 · Smart prep levels">
            Set daily prep from a 3-day weather and footfall forecast instead of last year's fixed
            numbers — worth around £40k a year.
          </BriefingPoint>
          <BriefingPoint title="2 · 3pm app markdowns">
            A 40% "happy hour" on bakery items in the app moves stock that would otherwise be binned.
          </BriefingPoint>
          <BriefingPoint title="3 · Surplus bags">
            Sell what's left through Too Good To Go to recover at least the ingredient cost.
          </BriefingPoint>
        </div>
        <p className="text-sm text-ink-foreground/75">
          Store habits matter too: Briggate's manager kept last year's prep after Trinity opened, and
          Hull's manager over-orders "to be safe".
        </p>
      </Briefing>
    </>
  );
}
