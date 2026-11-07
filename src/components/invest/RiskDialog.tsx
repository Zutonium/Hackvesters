import { CalendarClock, Eye, Hourglass, MessageCircleQuestion, ShieldCheck } from "lucide-react";

import { useAdvisor } from "@/components/advisor/advisor-context";
import { Pill } from "@/components/dash/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GROUP_LABELS, riskFor, type RiskLevel } from "@/data/investment-options";
import { useDashboard } from "@/lib/data-context";
import { gbp, n, pct } from "@/lib/format";
import { paybackYears, stressTest, type PlanItem } from "@/lib/models";

const levelTone: Record<RiskLevel, "positive" | "warning" | "negative"> = {
  Low: "positive",
  Medium: "warning",
  High: "negative",
};

const yrs = (v: number | null) => (v === null || v > 50 ? "Never" : `${v.toFixed(1)} yrs`);

export function RiskDialog({ item, onOpenChange }: { item: PlanItem | null; onOpenChange: (o: boolean) => void }) {
  const { data } = useDashboard();
  const { ask } = useAdvisor();
  if (!item) return null;
  const risk = riskFor(item);
  const site = data.candidate_sites.find((s) => s.site_id === item.riskKey);
  const store = data.stores.find((s) => s.store_id === item.storeId);
  const pb = paybackYears(item.amount, item.ebitda);
  const down = stressTest(item.amount, item.ebitda);

  const figures: [string, string][] = [
    ["Investment", gbp(item.amount)],
    ["Extra profit / year", item.ebitda ? gbp(item.ebitda) : "—"],
    ["Payback", item.group === "reserve" ? "—" : yrs(pb)],
    ["Downside payback", item.group === "reserve" ? "—" : yrs(down.paybackYears)],
  ];

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto rounded-xl p-0">
        <DialogHeader className="border-b px-6 pt-6 pb-4 text-left">
          <div className="flex flex-wrap items-center gap-2 pr-6">
            <Pill tone={levelTone[risk.level]}>{risk.level} risk</Pill>
            <Pill>{GROUP_LABELS[item.group]}</Pill>
          </div>
          <DialogTitle className="mt-2 font-display text-2xl leading-snug">{item.name}</DialogTitle>
          <DialogDescription>{item.rationale}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 px-6 pb-6">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {figures.map(([k, v]) => (
              <div key={k} className="rounded-lg bg-muted p-3">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="num mt-0.5 font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          {item.group !== "reserve" && (
            <p className="-mt-3 text-xs text-muted-foreground">
              Downside case: profit 25% lower than planned ({gbp(down.profit)}/yr) and costs 15% over budget (
              {gbp(down.cost)}).
            </p>
          )}

          {site && (
            <div className="rounded-lg border p-4 text-sm">
              <div className="eyebrow mb-2 text-muted-foreground">Site facts</div>
              <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                <span>Rent: {gbp(site.quoted_rent_gbp_month)}/month</span>
                <span>Street footfall: {n(site.daily_footfall_street)}/day</span>
                <span>Competing cafés within 500m: {site.competitor_cafes_500m}</span>
                <span>Projected margin: {pct(site.projected_margin_pct)}</span>
              </div>
              <p className="mt-2 text-muted-foreground">
                <strong className="text-foreground">Stealing from our own cafés:</strong> {site.cannibalization_risk}
              </p>
            </div>
          )}
          {store && (
            <div className="rounded-lg border p-4 text-sm">
              <div className="eyebrow mb-2 text-muted-foreground">Where {store.store_name} is today</div>
              <p>
                Profit {gbp(store.profit)} on {gbp(store.sales.total)} sales ({pct(store.margin)} margin) ·{" "}
                {pct(store.staff.turnover_rate_pct, 0)} staff turnover · {store.customer.avg_rating.toFixed(2)}★
                reviews.
              </p>
              <p className="mt-1 text-muted-foreground">{store.ai_diagnostic.headline}</p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-lg border border-warning/40 bg-warning-soft p-4">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <Hourglass className="size-4" /> Short term · first 12 months
              </h3>
              <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-sm">
                {risk.shortTerm.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
            <section className="rounded-lg border border-negative/30 bg-negative-soft p-4">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <CalendarClock className="size-4" /> Long term · years 2–5
              </h3>
              <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-sm">
                {risk.longTerm.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <section>
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <ShieldCheck className="size-4 text-positive" /> How to reduce the risk
              </h3>
              <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-sm">
                {risk.mitigations.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <Eye className="size-4 text-brand" /> What to watch
              </h3>
              <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-sm">
                {risk.watch.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          </div>

          <Button
            variant="outline"
            className="justify-self-start gap-2"
            onClick={() => {
              onOpenChange(false);
              ask(
                `Give me a deeper risk review of investing ${gbp(item.amount)} in "${item.name}" (expected +${gbp(item.ebitda)} a year). Split it into short-term (first 12 months) and long-term (years 2–5) risks, how likely each is, and how to reduce them.`,
              );
            }}
          >
            <MessageCircleQuestion className="size-4" /> Ask the chatbot for a deeper review
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
