import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bike,
  CalendarDays,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  PiggyBank,
  Receipt,
  Store,
  Trash2,
  Upload,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { AdvisorMark, AdvisorPanel } from "@/components/advisor/AdvisorPanel";
import { useAdvisor } from "@/components/advisor/advisor-context";
import { ScrollRow } from "@/components/dash/ScrollRow";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useDashboard } from "@/lib/data-context";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview", short: "Overview", icon: LayoutDashboard },
  { to: "/timeline", label: "Store Timeline", short: "Timeline", icon: CalendarDays },
  { to: "/stores", label: "Store Deep Dive", short: "Stores", icon: Store },
  { to: "/costs", label: "Costs & Savings", short: "Costs", icon: Receipt },
  { to: "/income", label: "Income & Menu", short: "Income", icon: UtensilsCrossed },
  { to: "/delivery", label: "Delivery", short: "Delivery", icon: Bike },
  { to: "/staff", label: "Staff & Rota", short: "Staff", icon: Users },
  { to: "/waste", label: "Food Waste", short: "Waste", icon: Trash2 },
  { to: "/upload", label: "Upload Data", short: "Upload", icon: Upload },
  { to: "/invest", label: "Investment plan", short: "Investment plan", icon: PiggyBank, highlight: true },
] as const;

const isActive = (path: string, to: string) => (to === "/" ? path === "/" : path.startsWith(to));

function Brand() {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-3">
      <AdvisorMark className="size-9 shrink-0" />
      <div className="min-w-0 leading-tight">
        <div className="truncate font-display text-lg text-sidebar-accent-foreground">Grind and Crumb</div>
      </div>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = isActive(path, item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              "highlight" in item && !active && "text-sidebar-primary",
            )}
          >
            <Icon className={cn("size-4", active && "text-sidebar-primary")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Section tabs shown under the top bar on phones and tablets, with scroll buttons. */
function TabStrip() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <ScrollRow tone="dark" label="sections" activeKey={path} className="px-2 pb-2.5" innerClassName="gap-1.5 py-0.5">
      {NAV.map((item) => {
        const active = isActive(path, item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            data-active={active}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "bg-sidebar-accent/60 text-sidebar-accent-foreground hover:bg-sidebar-accent",
            )}
          >
            <Icon className="size-3.5" />
            {item.short}
          </Link>
        );
      })}
    </ScrollRow>
  );
}

function SidebarFooter() {
  const { setOpen } = useAdvisor();
  const { isModified } = useDashboard();
  return (
    <div className="mt-auto flex flex-col gap-3">
      {isModified && (
        <div className="rounded-lg bg-sidebar-accent px-3 py-2 text-xs text-sidebar-foreground">
          Showing your uploaded data for this session.
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex items-center gap-3 rounded-xl bg-gradient-brand p-3 text-left text-brand-foreground shadow-lg transition hover:brightness-110"
      >
        <MessageSquareText className="size-5" />
        <div>
          <div className="text-sm font-semibold">Chatbot</div>
          <div className="text-xs opacity-85">Powered by Gemini</div>
        </div>
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { open, setOpen } = useAdvisor();

  return (
    <div className="min-h-screen lg:pl-72">
      {/* Desktop sidebar */}
      <aside className="paper-grain fixed inset-y-0 left-0 z-30 hidden w-72 flex-col gap-8 overflow-y-auto bg-sidebar p-5 lg:flex">
        <Brand />
        <NavList />
        <SidebarFooter />
      </aside>

      {/* Mobile top bar + section tabs */}
      <header className="sticky top-0 z-30 bg-sidebar lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Brand />
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Open the chatbot"
              onClick={() => setOpen(true)}
              className="text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <MessageSquareText className="size-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
              className="text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Menu className="size-5" />
            </Button>
          </div>
        </div>
        <TabStrip />
      </header>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="flex w-72 flex-col gap-8 overflow-y-auto border-sidebar-border bg-sidebar p-5">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Brand />
          <NavList onNavigate={() => setMenuOpen(false)} />
          <SidebarFooter />
        </SheetContent>
      </Sheet>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:gap-8 md:px-8 md:py-10">
        {children}
      </main>

      {/* Floating advisor button (mobile & tablet) */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-30 flex items-center gap-2 rounded-full bg-gradient-brand px-4 py-3 text-sm font-semibold text-brand-foreground shadow-lg lg:hidden"
        >
          <MessageSquareText className="size-4" /> Chatbot
        </button>
      )}

      <AdvisorPanel />
    </div>
  );
}
