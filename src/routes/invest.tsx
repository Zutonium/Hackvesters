import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, MessageCircleQuestion, Plus, RotateCcw, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";

import { useAdvisor } from "@/components/advisor/advisor-context";
import { AskChip, axisProps, chartTooltipStyle, ChartFrame, PageHeader, Panel, Pill } from "@/components/dash/primitives";
import { RiskDialog } from "@/components/invest/RiskDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_CHOICES, extraOptions, GROUP_LABELS, recommendedPlan, riskFor } from "@/data/investment-options";
import { useDashboard } from "@/lib/data-context";
import { gbp, gbpShort, n, pct } from "@/lib/format";
import { paybackYears, planPortfolio, withAmount, withEbitda, type PlanGroup, type PlanItem } from "@/lib/models";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/invest")({
  head: () => ({
    meta: [
      { title: "Investment Plan — Grind and Crumb" },
      {
        name: "description",
        content:
          "Build your own £1.5M investment plan for Grind and Crumb: new sites, improvements to current cafés, editable amounts and a risk review for every option.",
      },
      { property: "og:title", content: "Grind and Crumb — Investment Plan" },
      {
        property: "og:description",
        content: "Edit the plan, add your own investments and see payback and risks for each option.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvestPage,
});

const STORAGE_KEY = "gc-invest-plan-v1";

function verdict(ebitda: number, payback: number) {
  if (ebitda < 0 || payback >= 50) return { tone: "negative" as const, label: "Avoid" };
  if (payback > 8) return { tone: "warning" as const, label: "Weak" };
  if (payback <= 2.5) return { tone: "positive" as const, label: "Strong" };
  return { tone: "neutral" as const, label: "Viable" };
}

const riskTone = { Low: "positive", Medium: "warning", High: "negative" } as const;

function MoneyInput({
  value,
  onChange,
  label,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">£</span>
      <Input
        type="number"
        inputMode="numeric"
        step={1000}
        aria-label={label}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="num h-9 bg-card pl-6 text-right"
      />
    </div>
  );
}

function InvestPage() {
  const { data } = useDashboard();
  const { ask } = useAdvisor();
  const recommended = useMemo(() => recommendedPlan(data), [data]);
  const [items, setItems] = useState<PlanItem[]>(recommended);
  const [budget, setBudget] = useState(data.budget_plan.total_budget_gbp);
  const [riskItem, setRiskItem] = useState<PlanItem | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Keep the CEO's edits for this browser session.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { items: PlanItem[]; budget: number };
        if (Array.isArray(parsed.items)) setItems(parsed.items);
        if (typeof parsed.budget === "number") setBudget(parsed.budget);
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ items, budget }));
  }, [items, budget, loaded]);

  const p = planPortfolio(items, budget);
  const used = budget > 0 ? Math.min(100, (p.spent / budget) * 100) : 100;
  const growth = (p.ebitda / data.chain.total_profit) * 100;
  const options = extraOptions(data, items);

  const update = (id: string, fn: (i: PlanItem) => PlanItem) =>
    setItems((xs) => xs.map((x) => (x.id === id ? fn(x) : x)));
  const remove = (id: string) => setItems((xs) => xs.filter((x) => x.id !== id));
  const addItem = (it: PlanItem) => setItems((xs) => [...xs, { ...it, id: `${it.id}-${Date.now()}` }]);
  const reset = () => {
    setItems(recommended);
    setBudget(data.budget_plan.total_budget_gbp);
  };

  const reviewPlan = () => {
    const lines = items
      .filter((i) => i.included)
      .map((i) => `- ${i.name}: ${gbp(i.amount)}, expected ${i.ebitda >= 0 ? "+" : ""}${gbp(i.ebitda)} a year`);
    ask(
      `Please review my investment plan. Budget ${gbp(budget)}.\n${lines.join("\n")}\nTotal ${gbp(p.spent)}, expected +${gbp(p.ebitda)} a year, payback ${p.paybackYears ? p.paybackYears.toFixed(2) + " years" : "n/a"}. Are the profit estimates realistic, what are the biggest short- and long-term risks, and what would you change — including anything we should do to improve our current cafés?`,
    );
  };

  // Custom investment form
  const [cName, setCName] = useState("");
  const [cGroup, setCGroup] = useState<PlanGroup>("existing-store");
  const [cStore, setCStore] = useState<string>("none");
  const [cAmount, setCAmount] = useState(50_000);
  const [cEbitda, setCEbitda] = useState(15_000);
  const submitCustom = (e: FormEvent) => {
    e.preventDefault();
    const name = cName.trim();
    if (!name) return;
    const storeId = cGroup === "existing-store" && cStore !== "none" ? cStore : undefined;
    const store = data.stores.find((s) => s.store_id === storeId);
    addItem({
      id: "custom",
      name: store ? `${store.store_name}: ${name}` : name,
      category: CATEGORY_CHOICES.find((c) => c.group === cGroup)?.label ?? "Other",
      group: cGroup,
      amount: Math.max(0, cAmount),
      ebitda: cEbitda,
      returnRate: cAmount > 0 ? cEbitda / cAmount : 0,
      included: true,
      source: "custom",
      rationale: "Your own investment idea.",
      storeId,
    });
    setCName("");
  };

  const sites = [...data.candidate_sites].sort((a, b) => a.payback_years - b.payback_years);
  const siteChart = sites.map((s) => ({ id: s.site_id, name: s.site_name, ebitda: Math.round(s.projected_ebitda_gbp), payback: s.payback_years }));
  const worst = [...data.candidate_sites].sort((a, b) => a.projected_ebitda_gbp - b.projected_ebitda_gbp).slice(0, 2);
  const siteItem = (siteId: string): PlanItem | undefined =>
    items.find((i) => i.riskKey === siteId) ?? extraOptions(data, []).find((o) => o.riskKey === siteId);

  return (
    <>
      <PageHeader
        eyebrow={`Capital allocation · ${gbp(budget)}`}
        title="Investment plan"
        description="Start from the recommended plan, then change any amount, add your own ideas, or swap in other sites. Every option has a risk review — click it to see what could go wrong in the first year and beyond."
        actions={<AskChip question="Talk me through the recommended £1.5M plan" />}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {worst.map((s, idx) => (
          <div
            key={s.site_id}
            className={cn("surface p-5", idx === 0 ? "border-negative/40 bg-negative-soft" : "border-warning/40 bg-warning-soft")}
          >
            <div className={cn("flex items-center gap-2", idx === 0 ? "text-negative" : "text-warning-foreground")}>
              <AlertTriangle className="size-5" />
              <span className="eyebrow">Avoid · {s.site_id}</span>
            </div>
            <h3 className="mt-2 text-2xl">{s.site_name}</h3>
            <p className="mt-2 text-sm text-foreground/80">
              {gbp(s.est_fitout_gbp)} fit-out, {gbp(s.quoted_rent_gbp_month)}/month rent and{" "}
              {n(s.daily_footfall_street)} people passing a day.{" "}
              {s.projected_ebitda_gbp < 0 ? (
                <strong className="text-negative">Projected to lose {gbp(Math.abs(s.projected_ebitda_gbp))} a year.</strong>
              ) : (
                <strong>
                  Only {gbp(s.projected_ebitda_gbp)} a year — a {s.payback_years}-year payback.
                </strong>
              )}
            </p>
            <button
              type="button"
              onClick={() => setRiskItem(siteItem(s.site_id) ?? null)}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
            >
              <ShieldAlert className="size-4" /> See the risks
            </button>
          </div>
        ))}
      </div>

      <Panel
        title="Build your investment plan"
        subtitle="Tick items in or out, change any amount, or add your own. Profit scales with the amount unless you type your own figure."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={reviewPlan} className="gap-1.5">
              <MessageCircleQuestion className="size-3.5" /> Ask the chatbot to review my plan
            </Button>
            <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
              <RotateCcw className="size-3.5" /> Reset to recommended
            </Button>
          </div>
        }
      >
        <div className="grid gap-6 xl:grid-cols-5">
          <div className="grid content-start gap-5 xl:col-span-3">
            <div className="flex flex-wrap items-end gap-3 rounded-lg bg-muted p-3">
              <div className="grid gap-1">
                <Label className="text-xs">
                  Total money to invest
                </Label>
                <MoneyInput value={budget} onChange={setBudget} label="Total money to invest" className="w-44" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[1_000_000, 1_500_000, 2_000_000].map((v) => (
                  <Button key={v} type="button" size="sm" variant={budget === v ? "default" : "outline"} onClick={() => setBudget(v)}>
                    {gbpShort(v)}
                  </Button>
                ))}
              </div>
            </div>

            <ul className="grid gap-2">
              {items.map((it) => {
                const pb = paybackYears(it.amount, it.ebitda);
                const risk = riskFor(it);
                return (
                  <li
                    key={it.id}
                    className={cn("rounded-lg border bg-background p-3.5 transition", !it.included && "opacity-60")}
                  >
                    <div className="flex gap-3">
                      <Checkbox
                        checked={it.included}
                        onCheckedChange={(v) => update(it.id, (x) => ({ ...x, included: v === true }))}
                        className="mt-0.5"
                        aria-label={`Include ${it.name}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold">{it.name}</span>
                          <Pill tone={it.group === "new-site" ? "brand" : it.group === "reserve" ? "neutral" : "positive"}>
                            {GROUP_LABELS[it.group]}
                          </Pill>
                          {it.source === "custom" && <Pill>Your idea</Pill>}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{it.rationale}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-end gap-3 pl-7">
                      <div className="grid gap-1">
                        <span className="text-[0.7rem] text-muted-foreground">Amount</span>
                        <MoneyInput
                          value={it.amount}
                          onChange={(v) => update(it.id, (x) => withAmount(x, v))}
                          label={`Amount for ${it.name}`}
                          className="w-36"
                        />
                      </div>
                      {it.group !== "reserve" && (
                        <div className="grid gap-1">
                          <span className="text-[0.7rem] text-muted-foreground">Extra profit / year</span>
                          <MoneyInput
                            value={it.ebitda}
                            onChange={(v) => update(it.id, (x) => withEbitda(x, v))}
                            label={`Yearly profit for ${it.name}`}
                            className="w-36"
                          />
                        </div>
                      )}
                      <div className="grid gap-1">
                        <span className="text-[0.7rem] text-muted-foreground">Payback</span>
                        <span className="num h-9 text-sm leading-9 font-semibold">
                          {it.group === "reserve" ? "—" : pb === null || pb > 50 ? "Never" : `${pb.toFixed(1)} yrs`}
                        </span>
                      </div>
                      <div className="ml-auto flex items-center gap-1">
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRiskItem(it)}>
                          <ShieldAlert className="size-3.5" />
                          <span>Risks</span>
                          <Pill tone={riskTone[risk.level]}>{risk.level}</Pill>
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Remove ${it.name}`} onClick={() => remove(it.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
              {items.length === 0 && (
                <li className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Your plan is empty. Add options below or reset to the recommended plan.
                </li>
              )}
            </ul>

            {options.length > 0 && (
              <div>
                <h3 className="text-base font-semibold">More options to add</h3>
                <p className="text-xs text-muted-foreground">
                  Improvements to the cafés we already run, plus the candidate sites not in the plan.
                </p>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {options.map((o) => (
                    <li key={o.id} className="flex items-start gap-2 rounded-lg border border-dashed p-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{o.name}</div>
                        <div className="num text-xs text-muted-foreground">
                          {gbpShort(o.amount)} → {o.ebitda >= 0 ? "+" : ""}
                          {gbpShort(o.ebitda)}/yr · {GROUP_LABELS[o.group]}
                        </div>
                        <button
                          type="button"
                          onClick={() => setRiskItem(o)}
                          className="mt-1 text-xs font-semibold text-brand underline-offset-4 hover:underline"
                        >
                          See risks
                        </button>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => addItem(o)} aria-label={`Add ${o.name}`}>
                        <Plus className="size-3.5" /> Add
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={submitCustom} className="grid gap-3 rounded-lg border bg-muted/50 p-4">
              <h3 className="text-base font-semibold">Add your own investment</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1 sm:col-span-2">
                  <Label htmlFor="c-name" className="text-xs">
                    What is it?
                  </Label>
                  <Input
                    id="c-name"
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    placeholder="e.g. New coffee machines"
                    className="bg-card"
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={cGroup} onValueChange={(v) => setCGroup(v as PlanGroup)}>
                    <SelectTrigger className="bg-card" aria-label="Type of investment">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_CHOICES.map((c) => (
                        <SelectItem key={c.group} value={c.group}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {cGroup === "existing-store" && (
                  <div className="grid gap-1">
                    <Label className="text-xs">Which café?</Label>
                    <Select value={cStore} onValueChange={setCStore}>
                      <SelectTrigger className="bg-card" aria-label="Which café">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specific</SelectItem>
                        {data.stores.map((s) => (
                          <SelectItem key={s.store_id} value={s.store_id}>
                            {s.store_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid gap-1">
                  <Label className="text-xs">Amount</Label>
                  <MoneyInput value={cAmount} onChange={setCAmount} label="Amount for new investment" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Expected extra profit / year</Label>
                  <MoneyInput value={cEbitda} onChange={setCEbitda} label="Expected yearly profit for new investment" />
                </div>
              </div>
              <Button type="submit" className="justify-self-start gap-1.5">
                <Plus className="size-4" /> Add to plan
              </Button>
            </form>
          </div>

          <div className="xl:col-span-2">
            <div className="surface-ink sticky top-20 grid gap-5 p-6">
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="eyebrow text-sidebar-primary">Budget used</span>
                  <span className={cn("num text-sm font-semibold", p.overBudget ? "text-negative" : "text-ink-foreground/80")}>
                    {p.overBudget ? `${gbp(-p.remaining)} over` : `${gbp(p.remaining)} left`}
                  </span>
                </div>
                <div className="num mt-1 text-2xl font-semibold">
                  {gbp(p.spent)} <span className="text-base text-ink-foreground/60">/ {gbpShort(budget)}</span>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-ink-foreground/15">
                  <div
                    className={cn("h-full rounded-full transition-all", p.overBudget ? "bg-negative" : "bg-gradient-brand")}
                    style={{ width: `${used}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="eyebrow text-sidebar-primary">Extra profit per year</div>
                <div className="num mt-1 text-4xl font-semibold">
                  {p.ebitda >= 0 ? "+" : ""}
                  {gbp(p.ebitda)}
                </div>
                <div className="text-sm text-ink-foreground/75">
                  {growth >= 0 ? "+" : ""}
                  {pct(growth)} on this year's {gbpShort(data.chain.total_profit)} profit
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-ink-foreground/10 p-3">
                  <div className="eyebrow text-[0.6rem] text-sidebar-primary">Payback</div>
                  <div className="num mt-1 text-xl font-semibold">
                    {p.paybackYears ? `${p.paybackYears.toFixed(2)} yrs` : "—"}
                  </div>
                </div>
                <div className="rounded-lg bg-ink-foreground/10 p-3">
                  <div className="eyebrow text-[0.6rem] text-sidebar-primary">5-year gain</div>
                  <div className={cn("num mt-1 text-xl font-semibold", p.netReturn < 0 && "text-negative")}>
                    {gbpShort(p.netReturn)}
                  </div>
                </div>
              </div>
              <div>
                <div className="eyebrow mb-2 text-sidebar-primary">Where the money goes</div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-ink-foreground/15">
                  <div className="h-full bg-positive" style={{ width: `${p.existingSharePct}%` }} />
                  <div className="h-full bg-sidebar-primary" style={{ width: `${p.newSiteSharePct}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-ink-foreground/80">
                  <span>
                    <span className="mr-1 inline-block size-2 rounded-full bg-positive" />
                    Current cafés {pct(p.existingSharePct, 0)}
                  </span>
                  <span>
                    <span className="mr-1 inline-block size-2 rounded-full bg-sidebar-primary" />
                    New cafés {pct(p.newSiteSharePct, 0)}
                  </span>
                  <span>Reserve {pct(Math.max(0, 100 - p.existingSharePct - p.newSiteSharePct), 0)}</span>
                </div>
              </div>
              {p.overBudget && (
                <p className="rounded-lg bg-negative/20 p-3 text-sm">
                  This plan spends more than the budget. Lower some amounts or untick items.
                </p>
              )}
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Projected yearly profit by candidate site" subtitle="Profit once trading, ordered by fastest payback">
        <div className="h-72">
          <ChartFrame>
            <BarChart data={siteChart}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="id" {...axisProps} />
              <YAxis {...axisProps} width={52} tickFormatter={(v) => gbpShort(v)} />
              <Tooltip
                {...chartTooltipStyle}
                labelFormatter={(id) => siteChart.find((s) => s.id === id)?.name ?? id}
                formatter={(v: number) => [gbp(v), "Projected profit"]}
              />
              <ReferenceLine y={0} stroke="var(--foreground)" />
              <Bar dataKey="ebitda" radius={[4, 4, 0, 0]}>
                {siteChart.map((s) => {
                  const v = verdict(s.ebitda, s.payback);
                  return (
                    <Cell
                      key={s.id}
                      fill={
                        v.tone === "negative"
                          ? "var(--negative)"
                          : v.tone === "warning"
                            ? "var(--warning)"
                            : v.tone === "positive"
                              ? "var(--positive)"
                              : "var(--chart-5)"
                      }
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ChartFrame>
        </div>
      </Panel>

      <section>
        <div className="mb-4">
          <p className="eyebrow text-brand">Site appraisal</p>
          <h2 className="mt-1 text-2xl">All {data.candidate_sites.length} candidate sites</h2>
          <p className="mt-1 text-sm text-muted-foreground">Click a site to see its short- and long-term risks.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sites.map((s) => {
            const v = verdict(s.projected_ebitda_gbp, s.payback_years);
            const inPlan = items.some((i) => i.riskKey === s.site_id && i.included);
            const it = siteItem(s.site_id);
            const risk = it ? riskFor(it) : null;
            return (
              <article
                key={s.site_id}
                className="surface flex cursor-pointer flex-col gap-4 p-5 transition hover:border-brand"
                onClick={() => it && setRiskItem(it)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="num text-xs text-muted-foreground">
                      {s.site_id} · {s.city} · {s.location_type}
                    </div>
                    <h3 className="mt-1 text-xl">{s.site_name}</h3>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Pill tone={v.tone}>{v.label}</Pill>
                    {inPlan && <Pill tone="brand">In your plan</Pill>}
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {[
                    ["Fit-out", gbp(s.est_fitout_gbp)],
                    ["Rent / month", gbp(s.quoted_rent_gbp_month)],
                    ["Street footfall", `${n(s.daily_footfall_street)}/day`],
                    ["Projected sales", gbpShort(s.projected_sales_gbp)],
                    ["Projected profit", gbp(s.projected_ebitda_gbp)],
                    ["Payback", s.payback_years >= 50 ? "Never" : `${s.payback_years} yrs`],
                  ].map(([k, val]) => (
                    <div key={k}>
                      <dt className="text-xs text-muted-foreground">{k}</dt>
                      <dd className={cn("num font-semibold", k === "Projected profit" && s.projected_ebitda_gbp < 0 && "text-negative")}>
                        {val}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Cannibalisation:</strong> {s.cannibalization_risk}
                </p>
                <p className="border-t pt-3 text-sm">{s.recommendation}</p>
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ShieldAlert className="size-3.5" /> Risk deep dive
                    {risk && <Pill tone={riskTone[risk.level]}>{risk.level}</Pill>}
                  </Button>
                  {!inPlan && it && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        const existing = items.find((i) => i.riskKey === s.site_id);
                        if (existing) update(existing.id, (x) => ({ ...x, included: true }));
                        else addItem(it);
                      }}
                    >
                      <Plus className="size-3.5" /> Add to plan
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <RiskDialog item={riskItem} onOpenChange={(o) => !o && setRiskItem(null)} />
    </>
  );
}
