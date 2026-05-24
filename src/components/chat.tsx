"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { EmotionRow } from "@/lib/load-history";
import { EmotionPanel } from "./emotion-panel";

interface Props {
  initialMessages: UIMessage[];
  initialEmotions: EmotionRow[];
}

function textOf(m: UIMessage) {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55v-1.95c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.24 3.34.95.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18.91-.25 1.89-.38 2.86-.39.97.01 1.95.14 2.86.39 2.18-1.49 3.14-1.18 3.14-1.18.63 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.05.78 2.12v3.14c0 .31.21.66.79.55C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function MobileEmotionStrip({ emotions }: { emotions: EmotionRow[] }) {
  if (emotions.length === 0) return null;
  // dedupe by label, keep peak intensity
  const map = new Map<string, number>();
  for (const e of emotions) {
    map.set(e.label, Math.max(e.intensity, map.get(e.label) ?? 0));
  }
  const items = [...map.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <div className="border-b border-zinc-200/80 px-4 py-3 lg:hidden dark:border-zinc-800/80">
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        Detected · {items.length}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(([label, intensity]) => (
          <span
            key={label}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] capitalize text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <span
              className="h-1.5 w-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100"
              style={{ opacity: 0.3 + intensity * 0.7 }}
            />
            {label}
            <span className="tabular-nums text-zinc-400">{Math.round(intensity * 100)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Chat({ initialMessages, initialEmotions }: Props) {
  const { messages, sendMessage, status, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const [emotions, setEmotions] = useState<EmotionRow[]>(initialEmotions);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Refocus the textarea when the assistant turn is done so the user can keep typing.
  useEffect(() => {
    if (status === "ready") inputRef.current?.focus();
  }, [status]);

  // Auto-grow the textarea up to a cap.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  // Auto-scroll on new content
  // biome-ignore lint/correctness/useExhaustiveDependencies: depend on messages array reference to scroll on each turn
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // After each completed turn, refresh emotions from the server.
  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/session/emotions", { cache: "no-store" });
        const j = (await r.json()) as { emotions: EmotionRow[] };
        if (!cancelled) setEmotions(j.emotions);
      } catch {
        /* swallow */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const empty = messages.length === 0;
  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-dvh flex-col lg:grid lg:grid-cols-[1fr_22rem]">
      <main className="flex min-h-0 flex-1 flex-col bg-white dark:bg-zinc-950 lg:h-dvh">
        <header className="flex items-end justify-between gap-6 border-b border-zinc-200/80 px-8 py-5 dark:border-zinc-800/80">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              How was your day?
            </h1>
            <p className="text-xs text-zinc-500">
              Conversational emotion extraction · Brainapptica case study
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                if (busy) return;
                if (!empty && !confirm("Start a new conversation? Current session will be archived.")) return;
                await fetch("/api/session/reset", { method: "POST" });
                window.location.reload();
              }}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              New chat
            </button>
            <a
              href="https://github.com/elumixor/brainaptica-test-task"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
              aria-label="View source on GitHub"
            >
              <GithubMark className="h-3.5 w-3.5" />
              Source
            </a>
          </div>
        </header>

        <MobileEmotionStrip emotions={emotions} />

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto flex max-w-2xl flex-col gap-6">
            {empty && (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-6 dark:border-zinc-800 dark:bg-zinc-900/40">
                <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">Tell me about your day.</p>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                  I'll listen. Negative emotions are surfaced as they come up — each grounded in something you
                  actually said.
                </p>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className="flex flex-col gap-1">
                <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                  {m.role === "user" ? "You" : "Listener"}
                </div>
                <div
                  className={
                    m.role === "user"
                      ? "self-end rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-3 text-sm leading-relaxed text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 max-w-[85%] whitespace-pre-wrap"
                      : "self-start rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-3 text-sm leading-relaxed text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 max-w-[85%] whitespace-pre-wrap"
                  }
                >
                  {textOf(m) || (m.role === "assistant" && busy ? "…" : "")}
                </div>
              </div>
            ))}

            {error && (
              <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                something went wrong. {error.message}
              </div>
            )}
          </div>
        </div>

        <form
          className="border-t border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950"
          onSubmit={(e) => {
            e.preventDefault();
            const text = input.trim();
            if (!text || busy) return;
            sendMessage({ text });
            setInput("");
          }}
        >
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (busy) return;
                  (e.currentTarget.form as HTMLFormElement).requestSubmit();
                }
              }}
              placeholder={busy ? "Thinking…" : "Tell me about your day…"}
              rows={1}
              className="min-h-[44px] max-h-[200px] flex-1 resize-none overflow-y-auto rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm leading-snug text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-zinc-50 transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        </form>
      </main>

      <EmotionPanel emotions={emotions} busy={busy} />
    </div>
  );
}
