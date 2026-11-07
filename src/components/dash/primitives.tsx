import type { LucideIcon } from "lucide-react";
import { MessageCircleQuestion } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { ResponsiveContainer } from "recharts";

import { useAdvisor } from "@/components/advisor/advisor-context";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="animate-rise flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow && <p className="eyebrow mb-2 text-brand">{eyebrow}</p>}
        <h1 className="text-3xl leading-tight font-medium md:text-[2.6rem]">{title}</h1>
        {description && (
          <p className="mt-3 text-base text-muted-foreground md:text-lg">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2 md:shrink-0">{actions}</div>}
    </header>
  );
}

type Tone = "neutral" | "positive" | "negative" | "warning" | "brand";
const toneText: Record<Tone, string> = {
  neutral: "text-foreground",
  positive: "text-positive",
  negative: "text-negative",
  warning: "text-warning-foreground",
  brand: "text-brand",
};

export function Kpi({
  label,
  value,
  sub,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
}) {
  return (
    <div className="surface flex flex-col gap-2 p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow text-muted-foreground">{label}</span>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </div>
      <div className={cn("num text-2xl font-semibold md:text-[1.7rem]", toneText[tone])}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("surface overflow-hidden", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            {title && <h2 className="text-xl font-medium">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Dark "briefing" card carrying the AI diagnosis for a section. */
export function Briefing({
  label = "Advisor briefing",
  title,
  children,
  question,
}: {
  label?: string;
  title: ReactNode;
  children: ReactNode;
  question?: string;
}) {
  return (
    <section className="surface-ink animate-rise relative overflow-hidden p-6 md:p-8">
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-gradient-brand opacity-20 blur-3xl" />
      <p className="eyebrow text-sidebar-primary">{label}</p>
      <h2 className="mt-2 max-w-3xl text-2xl leading-snug md:text-3xl">{title}</h2>
      <div className="mt-5 grid gap-4 text-[0.95rem] leading-relaxed text-ink-foreground/85">
        {children}
      </div>
      {question && <AskChip question={question} className="mt-6" inverted />}
    </section>
  );
}

export function BriefingPoint({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="border-l-2 border-sidebar-primary/70 pl-4">
      <p className="font-semibold text-ink-foreground">{title}</p>
      <p className="mt-1">{children}</p>
    </div>
  );
}

export function AskChip({
  question,
  className,
  inverted,
}: {
  question: string;
  className?: string;
  inverted?: boolean;
}) {
  const { ask } = useAdvisor();
  return (
    <button
      type="button"
      onClick={() => ask(question)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
        inverted
          ? "border-ink-foreground/25 text-ink-foreground hover:bg-ink-foreground/10"
          : "border-border bg-card hover:border-brand hover:text-brand",
        className,
      )}
    >
      <MessageCircleQuestion className="size-4" />
      {question}
    </button>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls = s.includes("well")
    ? "bg-positive-soft text-positive"
    : s.includes("under")
      ? "bg-negative-soft text-negative"
      : "bg-warning-soft text-warning-foreground";
  const label = s.includes("well") ? "Performing well" : s.includes("under") ? "Underperforming" : "Middle";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", cls)}>
      {label}
    </span>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const cls: Record<Tone, string> = {
    neutral: "bg-secondary text-secondary-foreground",
    positive: "bg-positive-soft text-positive",
    negative: "bg-negative-soft text-negative",
    warning: "bg-warning-soft text-warning-foreground",
    brand: "bg-brand-soft text-brand",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", cls[tone])}>
      {children}
    </span>
  );
}

export function Money({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("num", value < 0 && "text-negative", className)}>
      {value < 0 ? "-" : ""}£{Math.abs(Math.round(value)).toLocaleString("en-GB")}
    </span>
  );
}

export const chartTooltipStyle = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    fontSize: 12,
    boxShadow: "var(--shadow-card)",
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 600 },
  itemStyle: { color: "var(--foreground)" },
};

export const axisProps = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

/** Charts render only in the browser: Recharts' generated ids differ between server and client. */
export function ChartFrame({ children }: { children: ReactElement }) {
  return (
    <ClientOnly fallback={<div className="h-full w-full animate-pulse rounded-lg bg-muted" />}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </ClientOnly>
  );
}
