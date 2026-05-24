"use client";

import type { EmotionRow } from "@/lib/load-history";

interface Props {
  emotions: EmotionRow[];
  busy: boolean;
}

function IntensityBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
      <div className="h-full bg-zinc-900 dark:bg-zinc-100" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmotionPanel({ emotions, busy }: Props) {
  // Group by label and keep the strongest evidence per label
  const groups = new Map<string, { intensity: number; evidence: string; rationale: string; count: number }>();
  for (const e of emotions) {
    const g = groups.get(e.label);
    if (!g || e.intensity > g.intensity) {
      groups.set(e.label, {
        intensity: Math.max(e.intensity, g?.intensity ?? 0),
        evidence: e.intensity > (g?.intensity ?? 0) ? e.evidence : (g?.evidence ?? e.evidence),
        rationale: e.intensity > (g?.intensity ?? 0) ? e.rationale : (g?.rationale ?? e.rationale),
        count: (g?.count ?? 0) + 1,
      });
    } else {
      g.count += 1;
    }
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].intensity - a[1].intensity);

  return (
    <aside className="hidden h-dvh min-h-0 flex-col border-l border-zinc-200 bg-zinc-50 lg:flex dark:border-zinc-800 dark:bg-zinc-900/50">
      <header className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Detected negative emotions
        </h2>
        <p className="mt-0.5 text-[11px] text-zinc-500">Extracted per user turn · grounded in a verbatim quote</p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {sorted.length === 0 ? (
          <p className="text-xs text-zinc-500">
            {busy ? "Listening…" : "Nothing extracted yet. Say something to see it light up."}
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {sorted.map(([label, g]) => (
              <li
                key={label}
                className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium capitalize text-zinc-900 dark:text-zinc-50">{label}</span>
                  <span className="text-[10px] tabular-nums text-zinc-500">
                    {g.count > 1 ? `${g.count}×  ·  ` : ""}peak {Math.round(g.intensity * 100)}%
                  </span>
                </div>
                <div className="mt-2">
                  <IntensityBar value={g.intensity} />
                </div>
                <blockquote className="mt-3 border-l-2 border-zinc-300 pl-2.5 text-xs italic text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                  “{g.evidence}”
                </blockquote>
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{g.rationale}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="border-t border-zinc-200 px-5 py-3 text-[10px] text-zinc-500 dark:border-zinc-800">
        Free-form labels · intensity 0–1 · negative valence only
      </footer>
    </aside>
  );
}
