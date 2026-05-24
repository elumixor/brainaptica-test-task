"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
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

export function Chat({ initialMessages, initialEmotions }: Props) {
  const { messages, sendMessage, status, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const [emotions, setEmotions] = useState<EmotionRow[]>(initialEmotions);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    <div className="grid h-dvh grid-cols-1 lg:grid-cols-[1fr_22rem]">
      <main className="flex h-dvh min-h-0 flex-col bg-white dark:bg-zinc-950">
        <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">how was your day</h1>
            <p className="mt-0.5 text-xs text-zinc-500">conversational emotion extraction · brainapptica case study</p>
          </div>
          <a
            href="https://github.com/elumixor/brainaptica-test-task"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            source ↗
          </a>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto flex max-w-2xl flex-col gap-6">
            {empty && (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                say something about your day. the model will listen and the panel on the right will surface negative
                emotions it picks up, grounded in your own words.
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className="flex flex-col gap-1">
                <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                  {m.role === "user" ? "you" : "listener"}
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
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement).requestSubmit();
                }
              }}
              placeholder={busy ? "thinking…" : "tell me about your day…"}
              rows={1}
              className="min-h-[44px] max-h-40 flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-50 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              send
            </button>
          </div>
        </form>
      </main>

      <EmotionPanel emotions={emotions} busy={busy} />
    </div>
  );
}
