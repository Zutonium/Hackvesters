import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A horizontal row of tabs/chips with left and right scroll buttons that appear
 * whenever the row is wider than the screen.
 */
export function ScrollRow({
  children,
  className,
  innerClassName,
  label = "tabs",
  tone = "light",
  activeKey,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  label?: string;
  tone?: "light" | "dark";
  /** when this changes, the element marked data-active="true" is scrolled into view */
  activeKey?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure]);

  useEffect(() => {
    const active = ref.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeKey]);

  const scroll = (dir: -1 | 1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.7), behavior: "smooth" });
  };

  const btn = cn(
    "absolute top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full border shadow-md transition",
    tone === "dark"
      ? "border-sidebar-border bg-sidebar text-sidebar-accent-foreground hover:bg-sidebar-accent"
      : "bg-card text-foreground hover:border-brand hover:text-brand",
  );

  return (
    <div className={cn("relative", className)}>
      {canLeft && (
        <button type="button" aria-label={`Scroll ${label} left`} onClick={() => scroll(-1)} className={cn(btn, "left-0")}>
          <ChevronLeft className="size-4" />
        </button>
      )}
      <div
        ref={ref}
        className={cn(
          "flex gap-2 overflow-x-auto scroll-smooth px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          innerClassName,
        )}
      >
        {children}
      </div>
      {canRight && (
        <button type="button" aria-label={`Scroll ${label} right`} onClick={() => scroll(1)} className={cn(btn, "right-0")}>
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}
