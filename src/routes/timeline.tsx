import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Tooltip, XAxis, YAxis } from "recharts";

import { AskChip, axisProps, chartTooltipStyle, ChartFrame, Kpi, PageHeader, Panel } from "@/components/dash/primitives";
import { ScrollRow } from "@/components/dash/ScrollRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import bundledDaily from "@/data/daily.json";
import { useDashboard } from "@/lib/data-context";
import { gbp, gbpPence, gbpShort, n, pct } from "@/lib/format";
import {
  change,
  dayDate,
  dayIndex,
  isoDay,
  periods as buildPeriods,
  periodStats,
  profitsFor,
  type DailyData,
  type Granularity,
} from "@/lib/timeline";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/timeline")({
  head: () => ({
    meta: [
      { title: "Store Timeline — Grind and Crumb" },
      {
        name: "description",
        content:
          "Step through Grind and Crumb's year day by day, week by week or month by month to see each café's sales, profit, footfall and food waste.",
      },
      { property: "og:title", content: "Grind and Crumb — Store Timeline" },
      {
        property: "og:description",
        content: "Daily, weekly, monthly and yearly results for every café.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TimelinePage,
});

const GRANULARITIES: { id: Granularity; label: string; noun: string }[] = [
  { id: "day", label: "Day", noun: "day" },
  { id: "week", label: "Week", noun: "week" },
  { id: "month", label: "Month", noun: "month" },
  { id: "year", label: "Year", noun: "year" },
  { id: "overall", label: "Overall", noun: "period" },
];

function Delta({ now, before, noun, invert }: { now: number; before?: number | undefined; noun: string; invert?: boolean }) {
  if (before === undefined) return null;
  const c = change(now, before);
  if (c === null) return <span>No earlier {noun} to compare</span>;
  const good = invert ? c < 0 : c > 0;
  return (
    <span className={cn("font-semibold", good ? "text-positive" : c === 0 ? "" : "text-negative")}>
      {c > 0 ? "▲" : c < 0 ? "▼" : "•"} {pct(Math.abs(c))} vs previous {noun}
    </span>
  );
}

function TimelinePage() {
  const { data, dailyOverride } = useDashboard();
  const daily = (dailyOverride ?? bundledDaily) as DailyData;
  const profits = useMemo(() => profitsFor(daily, data), [daily, data]);

  const [g, setG] = useState<Granularity>("month");
  const [store, setStore] = useState<string>("all");
  const [anchor, setAnchor] = useState(daily.days - 1);

  const list = useMemo(() => buildPeriods(daily, g), [daily, g]);
  const idx = Math.max(0, list.findIndex((p) => anchor >= p.from && anchor <= p.to));
  const period = list[idx]!;
  const prev = idx > 0 ? list[idx - 1] : undefined;
  const ids = store === "all" ? data.stores.map((s) => s.store_id) : [store];
  const noun = GRANULARITIES.find((x) => x.id === g)!.noun;

  const stats = periodStats(daily, profits, ids, period.from, period.to);
  const before = prev ? periodStats(daily, profits, ids, prev.from, prev.to) : undefined;

  const chart = useMemo(
    () =>
      (g === "overall" ? buildPeriods(daily, "month") : list).map((p) => {
        const s = periodStats(daily, profits, ids, p.from, p.to);
        return { key: p.key, short: p.short, label: p.label, sales: Math.round(s.sales), profit: Math.round(s.profit) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [daily, profits, list, g, store, data],
  );

  const ranking = data.stores
    .map((s) => {
      const st = periodStats(daily, profits, [s.store_id], period.from, period.to);
      const pv = prev ? periodStats(daily, profits, [s.store_id], prev.from, prev.to) : undefined;
      return { s, st, salesChange: pv ? change(st.sales, pv.sales) : null };
    })
    .sort((a, b) => b.st.profit - a.st.profit);

  const storeName = store === "all" ? "All 12 cafés" : (data.stores.find((s) => s.store_id === store)?.store_name ?? store);
  const go = (d: number) => {
    const next = list[idx + d];
    if (next) setAnchor(next.from);
  };
  const mix = stats.sales > 0 ? stats : null;

  return (
    <>
      <PageHeader
        eyebrow="Timeline"
        title="Store results, day by day"
        description="Pick a café and a time length, then step through the year to see sales, profit, visitors and food waste for any single day, week, month or year."
        actions={<AskChip question={`What stands out in ${storeName}'s results for ${period.label}?`} />}
      />

      <section className="surface grid grid-cols-1 gap-4 p-4 md:p-5">
        <div>
          <div className="eyebrow mb-2 text-muted-foreground">Café</div>
          <ScrollRow label="cafés" activeKey={store}>
            {[{ id: "all", name: "All cafés" }, ...data.stores.map((s) => ({ id: s.store_id, name: s.store_name }))].map((x) => (
              <button
                key={x.id}
                type="button"
                data-active={store === x.id}
                onClick={() => setStore(x.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition",
                  store === x.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-brand hover:text-brand",
                )}
              >
                {x.name}
              </button>
            ))}
          </ScrollRow>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="eyebrow mb-2 text-muted-foreground">Time length</div>
            <ScrollRow label="time lengths" activeKey={g}>
              <div role="tablist" className="flex shrink-0 gap-1 rounded-full bg-muted p-1">
                {GRANULARITIES.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    role="tab"
                    aria-selected={g === x.id}
                    data-active={g === x.id}
                    onClick={() => setG(x.id)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-semibold transition",
                      g === x.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
            </ScrollRow>
          </div>
          {g === "day" && (
            <div>
              <div className="eyebrow mb-2 text-muted-foreground">Jump to a date</div>
              <Input
                type="date"
                aria-label="Jump to a date"
                min={daily.start}
                max={isoDay(dayDate(daily, daily.days - 1))}
                value={isoDay(dayDate(daily, anchor))}
                onChange={(e) => {
                  const i = dayIndex(daily, e.target.value);
                  if (i >= 0 && i < daily.days) setAnchor(i);
                }}
                className="w-44 bg-card"
              />
            </div>
          )}
        </div>

        {g !== "overall" && (
          <div className="grid gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => go(-1)} disabled={idx === 0} aria-label={`Previous ${noun}`}>
                <ChevronLeft className="size-4" />
              </Button>
              <div className="min-w-0 flex-1 text-center">
                <div className="truncate font-display text-xl md:text-2xl">{period.label}</div>
                <div className="text-xs text-muted-foreground">
                  {idx + 1} of {list.length} {noun}s · {stats.tradingDays} trading day{stats.tradingDays === 1 ? "" : "s"}
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => go(1)}
                disabled={idx === list.length - 1}
                aria-label={`Next ${noun}`}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            {list.length > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="eyebrow text-muted-foreground">Choose a {noun}</span>
                <Select value={String(idx)} onValueChange={(v) => setAnchor(list[Number(v)]!.from)}>
                  <SelectTrigger className="w-72 bg-card" aria-label={`Choose a ${noun}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {list.map((p, i) => (
                      <SelectItem key={p.key} value={String(i)}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
        {g === "overall" && <div className="font-display text-xl md:text-2xl">{period.label}</div>}
      </section>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Sales" value={gbpShort(stats.sales)} sub={<Delta now={stats.sales} before={before?.sales} noun={noun} />} />
        <Kpi
          label="Profit (est.)"
          value={gbpShort(stats.profit)}
          tone={stats.profit < 0 ? "negative" : "positive"}
          sub={
            <>
              {pct(stats.marginPct)} margin · <Delta now={stats.profit} before={before?.profit} noun={noun} />
            </>
          }
        />
        <Kpi label="Orders" value={n(stats.orders)} sub={`${gbpPence(stats.avgBasket)} average order`} />
        <Kpi
          label="Visitors"
          value={n(stats.footfall)}
          sub={`${pct(stats.conversionPct)} bought in store`}
        />
        <Kpi
          label="Food waste"
          value={gbp(stats.wasteCost)}
          tone="warning"
          sub={
            <>
              {pct(stats.wastePct)} of food made · <Delta now={stats.wasteCost} before={before?.wasteCost} noun={noun} invert />
            </>
          }
        />
        <Kpi
          label="Sales by channel"
          value={mix ? pct((mix.instore / mix.sales) * 100, 0) : "—"}
          sub={
            mix
              ? `in-store · app ${pct((mix.app / mix.sales) * 100, 0)} · delivery ${pct((mix.delivery / mix.sales) * 100, 0)}`
              : "No trading"
          }
        />
      </div>

      <Panel
        title={`${storeName}: ${g === "overall" ? "month by month" : `every ${noun}`}`}
        subtitle={g === "overall" ? "Sales bars and estimated profit line" : `Tap a bar to jump to that ${noun}. The highlighted bar is the one shown above.`}
      >
        <div className="h-72">
          <ChartFrame>
            <ComposedChart data={chart} margin={{ left: 0, right: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="short" {...axisProps} minTickGap={16} />
              <YAxis {...axisProps} width={52} tickFormatter={(v) => gbpShort(v)} />
              <Tooltip
                {...chartTooltipStyle}
                labelFormatter={(_, payload) => (payload?.[0]?.payload as { label?: string } | undefined)?.label ?? ""}
                formatter={(v, k) => [gbp(Number(v)), k]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="sales"
                name="Sales"
                radius={[3, 3, 0, 0]}
                onClick={(_, i) => {
                  const p = list[i];
                  if (g !== "overall" && p) setAnchor(p.from);
                }}
                className="cursor-pointer"
              >
                {chart.map((c, i) => (
                  <Cell key={c.key} fill={g !== "overall" && i === idx ? "var(--brand)" : "var(--chart-4)"} />
                ))}
              </Bar>
              <Line dataKey="profit" name="Profit (est.)" stroke="var(--chart-2)" strokeWidth={2} dot={g === "day" ? false : { r: 2 }} />
            </ComposedChart>
          </ChartFrame>
        </div>
      </Panel>

      <Panel
        title={`Every café · ${period.label}`}
        subtitle="Ranked by estimated profit. Tap a café to focus the timeline on it."
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Café</th>
                <th className="px-3 py-2.5 text-right font-medium">Sales</th>
                <th className="px-3 py-2.5 text-right font-medium">vs previous</th>
                <th className="px-3 py-2.5 text-right font-medium">Profit (est.)</th>
                <th className="px-3 py-2.5 text-right font-medium">Margin</th>
                <th className="px-3 py-2.5 text-right font-medium">Orders</th>
                <th className="px-5 py-2.5 text-right font-medium">Food waste</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map(({ s, st, salesChange }) => (
                <tr
                  key={s.store_id}
                  onClick={() => setStore(s.store_id)}
                  className={cn("cursor-pointer border-b transition hover:bg-muted/60", store === s.store_id && "bg-brand-soft")}
                >
                  <td className="px-5 py-2.5 font-medium">
                    <span className="num mr-2 text-xs text-muted-foreground">{s.store_id}</span>
                    {s.store_name}
                  </td>
                  <td className="num px-3 py-2.5 text-right">{gbp(st.sales)}</td>
                  <td
                    className={cn(
                      "num px-3 py-2.5 text-right",
                      salesChange === null ? "text-muted-foreground" : salesChange >= 0 ? "text-positive" : "text-negative",
                    )}
                  >
                    {salesChange === null ? "—" : `${salesChange >= 0 ? "+" : ""}${pct(salesChange)}`}
                  </td>
                  <td className={cn("num px-3 py-2.5 text-right font-semibold", st.profit < 0 && "text-negative")}>
                    {st.sales > 0 ? gbp(st.profit) : "Closed"}
                  </td>
                  <td className="num px-3 py-2.5 text-right">{st.sales > 0 ? pct(st.marginPct) : "—"}</td>
                  <td className="num px-3 py-2.5 text-right">{n(st.orders)}</td>
                  <td className="num px-5 py-2.5 text-right">{gbp(st.wasteCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t px-5 py-3 text-xs text-muted-foreground">
          Sales, orders, visitors and waste are the recorded daily figures. Profit is estimated: ingredients and
          delivery fees follow each day's sales, and the rest of the month's costs (rent, staff, bills) are spread
          evenly over the days the café traded, so each month matches the monthly accounts.
        </p>
      </Panel>
    </>
  );
}
