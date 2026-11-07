import { GripHorizontal, Maximize2, Minimize2, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import mark from "@/assets/advisor-mark-sm.png";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdvisor } from "./advisor-context";

export const STARTER_QUESTIONS = [
  "Where should I invest the £1.5M?",
  "How can we improve the cafés we already have?",
  "Why is Manchester Piccadilly losing money?",
  "Should we open Leeds Wellington Place?",
  "What are the biggest risks in the recommended plan?",
  "Which costs can we cut fastest?",
];

export function AdvisorMark({ className }: { className?: string }) {
  return <img src={mark} alt="" width={256} height={256} className={className} />;
}

type Pos = { x: number; y: number };
const MARGIN = 12;

function useIsSmall() {
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setSmall(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return small;
}

export function AdvisorPanel() {
  const { open, setOpen, messages, status, sendMessage, stop, newConversation, ask, error } =
    useAdvisor();
  const busy = status === "submitted" || status === "streaming";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const small = useIsSmall();
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const clamp = useCallback((p: Pos): Pos => {
    const el = boxRef.current;
    const w = el?.offsetWidth ?? 440;
    const h = el?.offsetHeight ?? 600;
    return {
      x: Math.min(Math.max(MARGIN, p.x), Math.max(MARGIN, window.innerWidth - w - MARGIN)),
      y: Math.min(Math.max(MARGIN, p.y), Math.max(MARGIN, window.innerHeight - h - MARGIN)),
    };
  }, []);

  // Keep the window on screen when the browser is resized or the size toggles.
  useEffect(() => {
    if (!open || small) return;
    const fit = () => setPos((p) => (p ? clamp(p) : p));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [open, small, expanded, clamp]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  useEffect(() => {
    if (open && !busy) {
      const t = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, busy]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (small || (e.target as HTMLElement).closest("button")) return;
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setPos(clamp({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }));
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleSubmit = (msg: PromptInputMessage) => {
    const text = msg.text?.trim();
    if (!text || busy) return;
    void sendMessage({ text });
  };

  if (!open) return null;

  const last = messages.at(-1);
  const waiting =
    status === "submitted" ||
    (status === "streaming" &&
      last?.role === "assistant" &&
      !last.parts.some((p) => p.type === "text" && p.text.length > 0));

  const style =
    small || !pos
      ? undefined
      : { left: pos.x, top: pos.y, right: "auto", bottom: "auto" };

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label="Chatbot"
      style={style}
      className={cn(
        "fixed z-50 flex min-w-0 flex-col overflow-hidden bg-background shadow-2xl",
        small
          ? "inset-0"
          : cn(
              "rounded-2xl border",
              !pos && "right-6 bottom-6",
              expanded
                ? "h-[min(860px,calc(100vh-24px))] w-[min(860px,calc(100vw-24px))]"
                : "h-[min(660px,calc(100vh-24px))] w-[min(440px,calc(100vw-24px))]",
            ),
      )}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          "flex shrink-0 items-center gap-2 border-b bg-card px-3 py-2.5 select-none",
          !small && "cursor-grab active:cursor-grabbing",
        )}
        title={small ? undefined : "Drag to move"}
      >
        {!small && <GripHorizontal className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        <AdvisorMark className="size-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg leading-tight">Chatbot</div>
          <div className="truncate text-[0.7rem] text-muted-foreground">Powered by Gemini · knows every store, cost and site</div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={newConversation} className="h-8 gap-1 px-2" aria-label="New chat">
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">New chat</span>
          </Button>
        )}
        {!small && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Make smaller" : "Make bigger"}
          >
            {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => setOpen(false)}
          aria-label="Close the advisor"
        >
          <X className="size-4" />
        </Button>
      </div>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-6 px-4 py-5">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-5 py-4 text-center">
              <AdvisorMark className="size-14" />
              <div>
                <h3 className="text-2xl">Ask anything</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Type any question — strategy, costs, risks, a board paper draft. Answers use FY 2025/26 sales,
                  costs, staffing, waste and the candidate sites.
                </p>
              </div>
              <div className="grid w-full gap-2">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => ask(q)}
                    className="surface px-4 py-2.5 text-left text-sm font-medium transition hover:border-brand hover:text-brand"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent
                  className={
                    m.role === "user"
                      ? "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground"
                      : "min-w-0 text-[0.92rem] leading-relaxed"
                  }
                >
                  {m.parts.map((p, i) =>
                    p.type === "text" ? (
                      m.role === "assistant" ? (
                        <MessageResponse key={i}>{p.text}</MessageResponse>
                      ) : (
                        <p key={i} className="whitespace-pre-wrap">
                          {p.text}
                        </p>
                      )
                    ) : null,
                  )}
                </MessageContent>
              </Message>
            ))
          )}
          {waiting && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>Thinking it through…</Shimmer>
              </MessageContent>
            </Message>
          )}
          {error && !busy && (
            <p className="rounded-lg bg-negative-soft px-3 py-2 text-sm text-negative">
              {error.message && !error.message.startsWith("{")
                ? error.message
                : "That answer didn't come through. Please try asking again."}
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 border-t bg-background/60 p-3">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea ref={textareaRef} placeholder="Type your question and press Enter…" />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={() => void stop()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
