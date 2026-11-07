import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
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
  PageHeader,
  Panel,
  ChartFrame,
} from "@/components/dash/primitives";
import { useDashboard } from "@/lib/data-context";
import { gbp, n, pct } from "@/lib/format";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "Staff & Rota — Grind and Crumb" },
      {
        name: "description",
        content:
          "Staff turnover, staff happiness and the reasons people leave each Grind and Crumb café.",
      },
      { property: "og:title", content: "Grind and Crumb — Staff & Rota" },
      { property: "og:description", content: "Turnover, staff happiness and exit reasons by café." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StaffPage,
});

function StaffPage() {
  const { data } = useDashboard();

  const totals = data.stores.reduce(
    (a, s) => ({ head: a.head + s.staff.headcount, leavers: a.leavers + s.staff.leavers }),
    { head: 0, leavers: 0 },
  );
  const chart = data.stores.map((s) => ({
    id: s.store_id,
    name: s.store_name,
    turnover: s.staff.turnover_rate_pct,
    score: s.staff.avg_survey_score,
  }));
  const reasons = Object.entries(data.staff_exit_reasons)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
  const worst = [...data.stores].sort((a, b) => b.staff.turnover_rate_pct - a.staff.turnover_rate_pct)[0]!;

  return (
    <>
      <PageHeader
        eyebrow="Staff & rota"
        title="Staff statistics"
        description="Team size, turnover, staff happiness and the reasons people leave, for every café."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Kpi label="Staff" value={n(totals.head)} sub="Across 12 stores" />
        <Kpi label="Leavers this year" value={n(totals.leavers)} sub={`${pct((totals.leavers / totals.head) * 100, 0)} chain turnover`} tone="negative" />
        <Kpi label="Worst turnover" value={pct(worst.staff.turnover_rate_pct, 0)} sub={worst.store_name} tone="negative" />
        <Kpi label="Labour cost" value={gbp(data.chain.total_labour)} sub={`${pct((data.chain.total_labour / data.chain.total_revenue) * 100)} of sales`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Turnover & staff happiness by store" subtitle="Bars: yearly turnover % · line: survey score out of 10" className="lg:col-span-3">
          <div className="h-80">
            <ChartFrame>
              <ComposedChart data={chart}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="id" {...axisProps} />
                <YAxis yAxisId="l" {...axisProps} width={40} tickFormatter={(v) => `${v}%`} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 10]} {...axisProps} width={28} />
                <Tooltip
                  {...chartTooltipStyle}
                  labelFormatter={(id) => chart.find((c) => c.id === id)?.name ?? id}
                  formatter={(v: number, k) => (k === "Turnover" ? pct(v, 0) : `${v.toFixed(2)} / 10`)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="l" dataKey="turnover" name="Turnover" radius={[4, 4, 0, 0]}>
                  {chart.map((c) => (
                    <Cell key={c.id} fill={c.turnover > 100 ? "var(--negative)" : "var(--chart-4)"} />
                  ))}
                </Bar>
                <Line yAxisId="r" dataKey="score" name="Staff score" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ChartFrame>
          </div>
        </Panel>
        <Panel title="Why staff leave" subtitle="Main reason in the exit survey" className="lg:col-span-2">
          <div className="h-80">
            <ChartFrame>
              <BarChart data={reasons} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="reason" {...axisProps} width={130} />
                <Tooltip {...chartTooltipStyle} formatter={(v: number) => [v, "Leavers"]} />
                <Bar dataKey="count" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartFrame>
          </div>
        </Panel>
      </div>

      <Briefing title="Stopping the churn at the transit stores" question="How do we reduce staff turnover at Manchester Piccadilly?">
        <div className="grid gap-4 md:grid-cols-3">
          <BriefingPoint title="Turnover is catastrophic at transit hubs">
            {worst.store_name} lost {worst.staff.leavers} people on a team of {worst.staff.headcount} (
            {pct(worst.staff.turnover_rate_pct, 0)}) with a staff score of {worst.staff.avg_survey_score}/10.
            Baristas leave for concourse chains paying 50p an hour more.
          </BriefingPoint>
          <BriefingPoint title="Why people leave">
            Workload and understaffing at peak times, followed by better pay elsewhere, account for the
            largest share of departures in the exit survey.
          </BriefingPoint>
          <BriefingPoint title="The fix">
            Move hours into the 11:30–13:30 peak and pay a 50p/hour lunch premium at the transit stores.
          </BriefingPoint>
        </div>
      </Briefing>
    </>
  );
}
