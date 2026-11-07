import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ArrowUpDown, Banknote, PoundSterling, TrendingUp, Trophy, Users } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  axisProps,
  Briefing,
  BriefingPoint,
  chartTooltipStyle,
  Kpi,
  Money,
  PageHeader,
  Panel,
  StatusBadge,
  ChartFrame,
} from "@/components/dash/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboard } from "@/lib/data-context";
import { gbp, gbpShort, monthLabel, n, pct } from "@/lib/format";
import { topPerformingTeam, totalStaff } from "@/lib/models";
import type { Store } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — Grind and Crumb" },
      {
        name: "description",
        content:
          "How all 12 Grind and Crumb cafés performed: sales, profit, the stores dragging margin down and what to fix first.",
      },
      { property: "og:title", content: "Grind and Crumb — Portfolio Overview" },
      {
        property: "og:description",
        content: "Sales, profit and the stores dragging margin down across all 12 cafés.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

const FILTERS = [
  { id: "all", label: "All stores" },
  { id: "well", label: "Performing well" },
  { id: "middle", label: "Middle" },
  { id: "under", label: "Underperforming" },
] as const;

const SORTS: { id: string; label: string; compare: (a: Store, b: Store) => number }[] = [
  { id: "profit-asc", label: "Profit: lowest first", compare: (a, b) => a.profit - b.profit },
  { id: "profit-desc", label: "Profit: highest first", compare: (a, b) => b.profit - a.profit },
  { id: "revenue-desc", label: "Revenue: highest first", compare: (a, b) => b.sales.total - a.sales.total },
  { id: "revenue-asc", label: "Revenue: lowest first", compare: (a, b) => a.sales.total - b.sales.total },
  { id: "margin-desc", label: "Margin: highest first", compare: (a, b) => b.margin - a.margin },
  { id: "margin-asc", label: "Margin: lowest first", compare: (a, b) => a.margin - b.margin },
  { id: "rent-desc", label: "Rent: highest first", compare: (a, b) => b.costs.rent - a.costs.rent },
  { id: "labour-desc", label: "Labour: highest first", compare: (a, b) => b.costs.labour - a.costs.labour },
  { id: "waste-desc", label: "Food waste: highest first", compare: (a, b) => b.waste.cost_wasted - a.waste.cost_wasted },
  { id: "name-asc", label: "Store name: A–Z", compare: (a, b) => a.store_name.localeCompare(b.store_name) },
];

const TREND_COLORS = ["var(--chart-2)", "var(--chart-1)", "var(--chart-3)", "var(--chart-5)", "var(--chart-4)"];
const EVENTS = [
  { month: "2025-09", label: "Trinity opens" },
  { month: "2026-01", label: "Oat milk charge" },
  { month: "2026-04", label: "Wage rise · Dashly 33%" },
];

function Overview() {
  const { data } = useDashboard();
  const navigate = useNavigate();
  const c = data.chain;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [sort, setSort] = useState<string>("profit-asc");
  const [trendStores, setTrendStores] = useState<string[]>(["S03", "S12", "S07", "S04"]);

  const stores = useMemo(() => {
    const opt = SORTS.find((x) => x.id === sort) ?? SORTS[0]!;
    const list = [...data.stores].sort(opt.compare);
    if (filter === "all") return list;
    return list.filter((s) => {
      const st = s.status.toLowerCase();
      if (filter === "well") return st.includes("well");
      if (filter === "under") return st.includes("under");
      return !st.includes("well") && !st.includes("under");
    });
  }, [data.stores, filter, sort]);

  const profitBars = [...data.stores]
    .sort((a, b) => b.profit - a.profit)
    .map((s) => ({ id: s.store_id, name: s.store_name, profit: Math.round(s.profit) }));

  const trend = data.chain_monthly_trend.map((m, i) => {
    const row: Record<string, number | string> = { month: m.month };
    for (const id of trendStores) {
      const s = data.stores.find((x) => x.store_id === id);
      if (s) row[id] = Math.round(s.monthly_trend[i]?.profit ?? 0);
    }
    return row;
  });

  const worst = [...data.stores].sort((a, b) => a.profit - b.profit)[0]!;
  const best = [...data.stores].sort((a, b) => b.profit - a.profit)[0]!;
  const topTeam = topPerformingTeam(data.stores);
  const staffSize = totalStaff(data.stores);
  const counts = {
    well: data.stores.filter((s) => s.status.toLowerCase().includes("well")).length,
    under: data.stores.filter((s) => s.status.toLowerCase().includes("under")).length,
  };

  return (
    <>
      <PageHeader
        title="Overview Statistics"
        actions={
          <Link
            to="/invest"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow transition hover:bg-primary/90"
          >
            Go to Investment plan <ArrowRight className="size-4" />
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
        <Kpi label="Revenue" value={gbpShort(c.total_revenue)} sub="All channels, 12 months" icon={PoundSterling} />
        <Kpi
          label="Operating profit"
          value={gbpShort(c.total_profit)}
          sub={`${pct(c.overall_margin)} margin`}
          tone="positive"
          icon={TrendingUp}
        />
        <Kpi
          label="Biggest loss"
          value={gbpShort(worst.profit)}
          sub={worst.store_name}
          tone="negative"
          icon={Banknote}
        />
        <Kpi
          label="Top performing team"
          value={<span className="text-xl md:text-2xl">{topTeam ? topTeam.store.store_name : "—"}</span>}
          sub={
            topTeam
              ? `${gbp(topTeam.profitPerHead)} profit per team member · ${topTeam.store.staff.headcount} staff`
              : "No staff data"
          }
          tone="positive"
          icon={Trophy}
        />
        <Kpi
          label="Staff size"
          value={n(staffSize)}
          sub={`Across ${c.store_count} cafés · about ${Math.round(staffSize / Math.max(1, c.store_count))} per café`}
          icon={Users}
        />
      </div>

      <Panel
        title="Store Overview"
        subtitle="Sales, costs and profit for every café. Tap a store for its full deep dive."
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-8 w-56 bg-card text-xs" aria-label="Order by">
                <ArrowUpDown className="size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Order by" />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition",
                  filter === f.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent",
                )}
              >
                {f.label}
                {f.id === "well" && ` (${counts.well})`}
                {f.id === "under" && ` (${counts.under})`}
              </button>
            ))}
          </div>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Store</th>
                <th className="px-3 py-3 text-right font-semibold">Revenue</th>
                <th className="px-3 py-3 text-right font-semibold">Rent</th>
                <th className="px-3 py-3 text-right font-semibold">Labour</th>
                <th className="px-3 py-3 text-right font-semibold">Food waste</th>
                <th className="px-3 py-3 text-right font-semibold">Profit</th>
                <th className="px-3 py-3 text-right font-semibold">Margin</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr
                  key={s.store_id}
                  onClick={() => navigate({ to: "/stores", search: { store: s.store_id } })}
                  className="cursor-pointer border-b last:border-0 transition hover:bg-accent/50"
                >
                  <td className="px-5 py-3">
                    <div className="font-semibold">{s.store_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.store_id} · {s.location_type} · {s.format}
                    </div>
                  </td>
                  <td className="num px-3 py-3 text-right">{gbp(s.sales.total)}</td>
                  <td className="num px-3 py-3 text-right">{gbp(s.costs.rent)}</td>
                  <td className="num px-3 py-3 text-right">{gbp(s.costs.labour)}</td>
                  <td className="num px-3 py-3 text-right">{gbp(s.waste.cost_wasted)}</td>
                  <td className="px-3 py-3 text-right font-semibold">
                    <Money value={s.profit} className={s.profit >= 0 ? "text-positive" : ""} />
                  </td>
                  <td className={cn("num px-3 py-3 text-right", s.margin < 0 && "text-negative")}>
                    {pct(s.margin)}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Annual profit by store" subtitle="Green makes money, red loses it">
          <div className="h-80">
            <ChartFrame>
              <BarChart data={profitBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" {...axisProps} tickFormatter={(v) => gbpShort(v)} />
                <YAxis type="category" dataKey="id" {...axisProps} width={36} />
                <Tooltip
                  {...chartTooltipStyle}
                  formatter={(v: number) => [gbp(v), "Profit"]}
                  labelFormatter={(id) => profitBars.find((p) => p.id === id)?.name ?? id}
                />
                <ReferenceLine x={0} stroke="var(--foreground)" />
                <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
                  {profitBars.map((p) => (
                    <Cell key={p.id} fill={p.profit >= 0 ? "var(--positive)" : "var(--negative)"} />
                  ))}
                </Bar>
              </BarChart>
            </ChartFrame>
          </div>
        </Panel>

        <Panel
          title="Monthly profit & the dips"
          subtitle="Pick stores to compare. Lines mark the events behind each dip."
        >
          <div className="mb-3 flex flex-wrap gap-1.5">
            {data.stores.map((s) => {
              const on = trendStores.includes(s.store_id);
              return (
                <button
                  key={s.store_id}
                  type="button"
                  title={s.store_name}
                  onClick={() =>
                    setTrendStores((t) =>
                      on ? t.filter((x) => x !== s.store_id) : [...t, s.store_id].slice(-5),
                    )
                  }
                  className={cn(
                    "num rounded-md px-2 py-0.5 text-xs font-semibold transition",
                    on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-accent",
                  )}
                >
                  {s.store_id}
                </button>
              );
            })}
          </div>
          <div className="h-72">
            <ChartFrame>
              <LineChart data={trend} margin={{ left: 0, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" {...axisProps} tickFormatter={monthLabel} />
                <YAxis {...axisProps} tickFormatter={(v) => gbpShort(v)} width={48} />
                <Tooltip
                  {...chartTooltipStyle}
                  labelFormatter={(m) => monthLabel(String(m))}
                  formatter={(v: number, id) => [gbp(v), data.stores.find((s) => s.store_id === id)?.store_name ?? id]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {EVENTS.map((e) => (
                  <ReferenceLine
                    key={e.month}
                    x={e.month}
                    stroke="var(--muted-foreground)"
                    strokeDasharray="3 3"
                    label={{ value: e.label, position: "insideTopLeft", fontSize: 10, fill: "var(--muted-foreground)" }}
                  />
                ))}
                <ReferenceLine y={0} stroke="var(--foreground)" />
                {trendStores.map((id, i) => (
                  <Line
                    key={id}
                    dataKey={id}
                    stroke={TREND_COLORS[i % TREND_COLORS.length]}
                    strokeWidth={2.2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ChartFrame>
          </div>
        </Panel>
      </div>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow text-brand">Turnaround playbook</p>
            <h2 className="mt-1 text-2xl">Getting the weakest stores back to profit</h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              n: "01",
              title: "Fix Manchester Piccadilly",
              body: "Give delivery riders their own pickup hatch (£90k), add two lunchtime baristas to stop commuter walk-outs, and renegotiate rent towards a turnover-linked lease.",
              gain: "+£115k / yr swing",
              id: "S07",
            },
            {
              n: "02",
              title: "Rebalance Leeds",
              body: "Cut Briggate's prep levels by 20% to remove ~£6k of waste. Position Trinity as grab-and-go for offices and students, and Briggate as the sit-down brunch café.",
              gain: "+£28k / yr combined",
              id: "S03",
            },
            {
              n: "03",
              title: "Repair Hull Paragon",
              body: "Replace the failing boiler and dishwasher to end emergency callouts, and rehire the part-time cleaner so baristas can focus on customers.",
              gain: "+£18k / yr",
              id: "S10",
            },
          ].map((p) => (
            <Link
              key={p.n}
              to="/stores"
              search={{ store: p.id }}
              className="surface group flex flex-col gap-3 p-5 transition hover:-translate-y-0.5 hover:border-brand"
            >
              <span className="num text-sm text-brand">{p.n}</span>
              <h3 className="text-xl">{p.title}</h3>
              <p className="flex-1 text-sm text-muted-foreground">{p.body}</p>
              <div className="flex items-center justify-between">
                <span className="num text-sm font-semibold text-positive">{p.gain}</span>
                <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-brand" />
              </div>
            </Link>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Strongest store: <strong className="text-foreground">{best.store_name}</strong> with{" "}
          {gbp(best.profit)} profit ({pct(best.margin)} margin).
        </p>
      </section>

      <Briefing
        title="Three drag factors are holding profit flat across the estate"
        question="What are the three biggest things dragging our profit down?"
      >
        <BriefingPoint title={`The Piccadilly rent trap — ${worst.store_name}`}>
          Highest sales in the chain ({gbpShort(worst.sales.total)}) yet it loses{" "}
          {gbp(Math.abs(worst.profit))}. Rent of {gbp(worst.costs.rent)} a year (
          {pct((worst.costs.rent / worst.sales.total) * 100, 0)} of sales) meets a lunchtime queue
          jammed by delivery riders, so commuters walk off to station rivals. Staff turnover is{" "}
          {pct(worst.staff.turnover_rate_pct, 0)}.
        </BriefingPoint>
        <BriefingPoint title="Leeds cannibalisation and waste">
          Opening Leeds Trinity in September 2025 pulled around 22% of sales away from Leeds Briggate,
          which kept last year's prep levels — making it the chain's highest food-waste store.
        </BriefingPoint>
        <BriefingPoint title="Delivery is squeezing margin">
          29% of delivery orders are under £8 and lose money after commission, packaging and barista
          time. Dashly also raised its commission from 27% to 33% on 1 April.
        </BriefingPoint>
      </Briefing>
    </>
  );
}
