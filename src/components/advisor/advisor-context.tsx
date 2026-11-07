import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

type AdvisorCtx = ReturnType<typeof useChat> & {
  open: boolean;
  setOpen: (v: boolean) => void;
  ask: (question: string) => void;
  newConversation: () => void;
};

const Ctx = createContext<AdvisorCtx | null>(null);

export function AdvisorProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const chat = useChat({
    transport,
    onError: (err) => {
      const msg = err.message?.trim();
      toast.error(
        msg && !msg.startsWith("{") ? msg : "The chatbot couldn't be reached. Check your connection and try again.",
      );
    },
  });

  const { sendMessage, status, setMessages, stop } = chat;
  const ask = useCallback(
    (question: string) => {
      setOpen(true);
      if (status === "submitted" || status === "streaming") return;
      void sendMessage({ text: question });
    },
    [sendMessage, status],
  );
  const newConversation = useCallback(() => {
    void stop();
    setMessages([]);
  }, [setMessages, stop]);

  return (
    <Ctx.Provider value={{ ...chat, open, setOpen, ask, newConversation }}>{children}</Ctx.Provider>
  );
}

export function useAdvisor() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdvisor must be used inside AdvisorProvider");
  return c;
}
