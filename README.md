# how was your day

Conversational emotion extraction — a small case study for Brainapptica.
Talk to it about your day; it surfaces negative-valence emotions grounded in your own words.

**Live:** https://brainaptica-test-task.vercel.app
**Stack:** Next.js 16 (App Router) · AI SDK v6 via Vercel AI Gateway (`anthropic/claude-sonnet-4.6`) · Neon Postgres + Drizzle · Tailwind v4 · Bun.

## What it does

1. Anonymous session cookie on first visit — no signup.
2. A listener model asks open questions about your day (it deliberately doesn't name your emotions back at you — that would contaminate the extraction signal).
3. After each user turn, a second model call runs `generateText` with `Output.object` against a Zod schema and returns negative emotions detected in that single user message, each grounded in a verbatim quote span.
4. Detected emotions show up live in a side panel — label, intensity (0–1), the quote, and a one-sentence rationale.
5. Everything (sessions, messages, emotions) lives in Postgres so it survives reloads.

## Assumptions I made (and will defend on the call)

- **"Negative emotion" has no fixed taxonomy.** The brief says there is no right definition; I let the model pick free-form lowercase labels (`frustration`, `loneliness`, `dread`, …) instead of constraining to Plutchik / Ekman / etc. The cost is no clean aggregation across users; the upside is the labels match the user's actual experience.
- **Per-turn extraction, not post-hoc batch.** It makes "how would you know the system is working" tractable: you can see, live, whether the label/quote pairs feel grounded.
- **Grounding by verbatim span.** The schema requires `evidence` copied from the user message. That is the single biggest lever I had against hallucination in two days. The model still occasionally bends the rule — a real version would do a substring check and re-prompt.
- **Anonymous cookie is enough auth** for a case study. Full accounts would be ceremony.
- **One chat surface, one extraction pipeline, one side panel.** No voice, no summaries, no multi-user. Honesty over breadth.

## How I'd know it's working

- Edge cases I poke at: a clearly positive day (expect empty extraction), a one-word reply like "fine." (expect empty), a single message with two distinct negative emotions (expect both with separate evidence spans).
- The `evidence` field is the cheap eyeball test — if the quote isn't in the message, the system is failing.
- The next step (not in scope here) is a small labeled eval set of 20–30 short transcripts and an automated check on label precision + evidence containment.

## Run it locally

Requires Bun (`brew install bun`) and a Postgres URL (Neon free tier works).

```bash
bun install
cp .env.example .env.local        # fill in DATABASE_URL and AI_GATEWAY_API_KEY
bun run db:push                   # apply schema to your Postgres
bun run dev                       # http://localhost:3000
```

Get an `AI_GATEWAY_API_KEY` at <https://vercel.com/dashboard/ai-gateway>.

## Deploy

Configured for Vercel. The Neon Marketplace integration auto-provisions `DATABASE_URL`; `AI_GATEWAY_API_KEY` is set manually under project Settings → Environment Variables. Push to `main` → preview deploy → promote.

## Schema

```
sessions(id, cookie_sid, created_at)
messages(id, session_id, role, content, parts, created_at)
emotions(id, session_id, message_id, label, intensity, evidence, rationale, created_at)
```

Emotions are foreign-keyed to the user message that triggered them, so a future view could show emotional drift over a session.

## What I'd do with another week

- A real eval harness: ~50 hand-labeled transcripts, precision/recall on labels, the substring-check is already in code (`route.ts`) but the wider harness isn't.
- Voice input. Push-to-talk changes how people disclose more than any other affordance I can think of in two days.
- Token-level grounding instead of free-form quotes: return character offsets so the transcript can highlight the evidence span in place.

## What's deliberately not here

- Voice / audio
- User accounts, login UI, password reset
- Multi-language (brief is English-only)
- Rate limiting or abuse handling
- A test suite (two-day ceiling — honesty over polish)

---

Submission for the Brainapptica full-stack AI-first case study, May 2026.
