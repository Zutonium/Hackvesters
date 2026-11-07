import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { z } from "zod";

import {
  AskChip,
  axisProps,
  chartTooltipStyle,
  Kpi,
  Money,
  PageHeader,
  Panel,
  Pill,
  StatusBadge,
  ChartFrame,
} from "@/components/dash/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboard } from "@/lib/data-context";
import { gbp, gbpShort, monthLabel, n, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

const searchSchema = z.object({ store: z.string().optional() });

export const Route = createFileRoute("/stores")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Store Deep Dive — Grind and Crumb" },
      {
        name: "description",
        content:
          "Full profit and loss, footfall, rota, reviews and a tailored turnaround plan for each of the 12 Grind and Crumb cafés.",
      },
      { property: "og:title", content: "Grind and Crumb — Store Deep Dive" },
      {
        property: "og:description",
        content: "Profit and loss, footfall, staffing and reviews for every café.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StoresPage,
});

const COMPLAINT_LABELS: Record<string, string> = {
  wait_time: "Long waits",
  order_accuracy: "Wrong orders",
  oat_milk: "Oat milk charge",
  app_bug: "App problems",
  cleanliness: "Cleanliness",
  staff_attitude: "Staff attitude",
  price: "Price",
};

type ReviewSort = "latest" | "oldest" | "lowest" | "highest";
const REVIEW_SORTS: { id: ReviewSort; label: string }[] = [
  { id: "latest", label: "Latest" },
  { id: "oldest", label: "Oldest" },
  { id: "lowest", label: "Lowest rating" },
  { id: "highest", label: "Highest rating" },
];

type Review = { rating: number; text: string; date: string };
function sortReviews(list: Review[], by: ReviewSort) {
  const time = (r: Review) => new Date(r.date).getTime();
  return [...list].sort((a, b) => {
    if (by === "latest") return time(b) - time(a);
    if (by === "oldest") return time(a) - time(b);
    if (by === "lowest") return a.rating - b.rating || time(b) - time(a);
    return b.rating - a.rating || time(b) - time(a);
  });
}

function StoresPage() {
  const { data } = useDashboard();
  const { store: storeId } = Route.useSearch();
  const navigate = useNavigate({ from: "/stores" });
  const [reviewSort, setReviewSort] = useState<ReviewSort>("latest");
  const s = data.stores.find((x) => x.store_id === storeId) ?? data.stores.find((x) => x.store_id === "S07")!;
  const c = s.costs;

  const pnl: { label: string; value: number; strong?: boolean; indent?: boolean }[] = [
    { label: "In-store sales", value: s.sales.instore, indent: true },
    { label: "App click & collect", value: s.sales.app, indent: true },
    { label: "Delivery platforms", value: s.sales.delivery, indent: true },
    { label: "Total revenue", value: s.sales.total, strong: true },
    { label: "Ingredients", value: -c.cogs_ingredients, indent: true },
    { label: "Labour", value: -c.labour, indent: true },
    { label: "Rent", value: -c.rent, indent: true },
    { label: "Business rates", value: -c.rates, indent: true },
    { label: "Utilities", value: -c.utilities, indent: true },
    { label: "Repairs & maintenance", value: -c.repairs, indent: true },
    { label: "Other running costs", value: -c.other_opex, indent: true },
    { label: "Delivery commission", value: -c.delivery_commission, indent: true },
    { label: "Delivery packaging", value: -c.delivery_packaging, indent: true },
    { label: "Total costs", value: -c.total_expenses, strong: true },
    { label: "Operating profit", value: s.profit, strong: true },
  ];

  const dayparts = ["Morning", "Lunch", "Afternoon"].map((d) => ({
    daypart: d,
    hours: Math.round(s.staff.daypart_hours[d] ?? 0),
    visitors: s.footfall.daypart_count[d] ?? 0,
  }));
  const visitorsPerHour = dayparts.map((d) => ({
    ...d,
    perHour: d.hours > 0 ? Math.round(d.visitors / d.hours) : 0,
  }));

  const reviews = sortReviews(
    Array.from(new Map(s.customer.sample_reviews.filter((r) => r.text).map((r) => [r.text, r])).values()),
    reviewSort,
  ).slice(0, 6);
  const complaints = Object.entries(s.customer.complaints).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHeader
        eyebrow={`${s.store_id} · ${s.city} · ${s.location_type} · ${s.format}`}
        title={s.store_name}
        description={`Managed by ${s.store_manager} · opened ${new Date(s.opened_date).toLocaleDateString("en-GB", { month: "long", year: "numeric" })} · ${s.seats} seats · ${n(s.sqft)} sq ft`}
        actions={
          <Select value={s.store_id} onValueChange={(v) => navigate({ search: { store: v } })}>
            <SelectTrigger className="w-72 bg-card" aria-label="Choose a store">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {data.stores.map((x) => (
                <SelectItem key={x.store_id} value={x.store_id}>
                  {x.store_id} — {x.store_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
        <Kpi label="Revenue" value={gbpShort(s.sales.total)} sub={`${n(s.orders.total)} orders`} />
        <Kpi
          label="Profit"
          value={gbpShort(s.profit)}
          sub={`${pct(s.margin)} margin`}
          tone={s.profit < 0 ? "negative" : "positive"}
        />
        <Kpi
          label="Rent vs sales"
          value={pct((c.rent / s.sales.total) * 100)}
          sub={`${gbp(c.rent)} a year`}
          tone={c.rent / s.sales.total > 0.25 ? "negative" : "neutral"}
        />
        <Kpi
          label="Food waste"
          value={gbpShort(s.waste.cost_wasted)}
          sub={`${pct(s.waste.waste_pct)} of food prepared`}
          tone="warning"
        />
        <Kpi
          label="Staff turnover"
          value={pct(s.staff.turnover_rate_pct, 0)}
          sub={`${s.staff.leavers} leavers · ${s.staff.headcount} staff`}
          tone={s.staff.turnover_rate_pct > 100 ? "negative" : "neutral"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Profit & loss" subtitle="Full year" className="lg:col-span-2" bodyClassName="p-0">
          <table className="w-full text-sm">
            <tbody>
              {pnl.map((row) => (
                <tr key={row.label} className={row.strong ? "border-y bg-muted/50" : ""}>
                  <td className={`px-5 py-2 ${row.indent ? "pl-8 text-muted-foreground" : "font-semibold"}`}>
                    {row.label}
                  </td>
                  <td className={`px-5 py-2 text-right ${row.strong ? "font-semibold" : ""}`}>
                    <Money
                      value={row.value}
                      className={row.label === "Operating profit" && row.value > 0 ? "text-positive" : ""}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Month by month" subtitle="Sales, costs and profit" className="lg:col-span-3">
          <div className="h-80">
            <ChartFrame>
              <ComposedChart data={s.monthly_trend} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" {...axisProps} tickFormatter={monthLabel} />
                <YAxis {...axisProps} tickFormatter={(v) => gbpShort(v)} width={52} />
                <Tooltip {...chartTooltipStyle} labelFormatter={(m) => monthLabel(String(m))} formatter={(v: number) => gbp(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="sales" name="Sales" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Costs" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Line dataKey="profit" name="Profit" stroke="var(--chart-2)" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ChartFrame>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Staff hours vs customers"
          subtitle={`Door count and scheduled hours by time of day · ${pct(s.footfall.conversion_rate_pct)} of visitors buy`}
        >
          <div className="h-64">
            <ChartFrame>
              <BarChart data={visitorsPerHour}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="daypart" {...axisProps} />
                <YAxis {...axisProps} width={40} />
                <Tooltip {...chartTooltipStyle} formatter={(v: number) => n(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="perHour" name="Visitors per staff hour" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartFrame>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {visitorsPerHour.map((d) => (
              <div key={d.daypart} className="rounded-lg bg-muted p-3">
                <div className="eyebrow text-muted-foreground">{d.daypart}</div>
                <div className="num mt-1 text-sm font-semibold">{n(d.hours)} hrs</div>
                <div className="text-xs text-muted-foreground">{n(d.visitors)} visitors</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="What customers say"
          subtitle={`${n(s.customer.review_count)} reviews`}
          actions={
            <div className="flex items-center gap-1.5">
              <Star className="size-4 fill-warning text-warning" />
              <span className="num text-lg font-semibold">{s.customer.avg_rating.toFixed(2)}</span>
            </div>
          }
        >
          <div className="flex flex-wrap gap-2">
            {complaints.map(([k, v]) => (
              <Pill key={k} tone={v > 30 ? "negative" : "warning"}>
                {COMPLAINT_LABELS[k] ?? k.replace(/_/g, " ")} · {v}
              </Pill>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="eyebrow mr-1 text-muted-foreground">Sort reviews</span>
            {REVIEW_SORTS.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={reviewSort === o.id}
                onClick={() => setReviewSort(o.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition",
                  reviewSort === o.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <ul className="mt-3 grid gap-3">
            {reviews.map((r, i) => (
              <li key={i} className="rounded-lg border bg-background p-3 text-sm">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="num font-semibold text-warning-foreground">{"★".repeat(r.rating)}</span>
                  <span>{new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                “{r.text}”
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <section className="surface-ink relative overflow-hidden p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow text-sidebar-primary">Advisor diagnosis</p>
          <StatusBadge status={s.status} />
        </div>
        <h2 className="mt-2 max-w-3xl text-2xl leading-snug md:text-3xl">{s.ai_diagnostic.headline}</h2>
        <p className="mt-4 max-w-4xl text-[0.95rem] leading-relaxed text-ink-foreground/85">
          {s.ai_diagnostic.why_underperforming}
        </p>
        <ol className="mt-5 grid gap-3 md:grid-cols-2">
          {s.ai_diagnostic.actionable_recommendations.map((r, i) => (
            <li key={i} className="flex gap-3 rounded-lg bg-ink-foreground/5 p-3 text-sm text-ink-foreground/90">
              <span className="num text-sidebar-primary">{String(i + 1).padStart(2, "0")}</span>
              <span>{r}</span>
            </li>
          ))}
        </ol>
        <AskChip
          inverted
          className="mt-6"
          question={`What should we do first to improve ${s.store_name}?`}
        />
      </section>
    </>
  );
}
