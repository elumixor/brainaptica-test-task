# how was your day

Conversational emotion extraction. A small case study for Brainapptica.
Talk to it about your day; it surfaces negative-valence emotions grounded in your own words.

**Live:** https://brainaptica-test-task.vercel.app
**Stack:** Next.js 16 (App Router), AI SDK v6 via Vercel AI Gateway (`anthropic/claude-sonnet-4.6`), Neon Postgres + Drizzle, Tailwind v4, Bun.

## What it does

1. Anonymous session cookie on first visit. No signup.
2. A listener model asks open questions about your day. It deliberately doesn't name your emotions back at you, because that would contaminate the extraction signal.
3. After each user turn, a second model call runs `generateText` with `Output.object` against a Zod schema and returns negative emotions detected in that single user message, each grounded in a verbatim quote span.
4. Detected emotions show up live in a side panel: label, intensity (0 to 1), the quote, and a one-sentence rationale.
5. Everything (sessions, messages, emotions) lives in Postgres so it survives reloads.

## Assumptions I made (and will defend on the call)

- **"Negative emotion" has no fixed taxonomy.** The brief says there is no right definition, so I let the model pick free-form lowercase labels (`frustration`, `loneliness`, `dread`, etc.) instead of constraining to Plutchik or Ekman. The cost is no clean aggregation across users; the upside is labels that match the user's actual experience.
- **Per-turn extraction, not post-hoc batch.** It makes "how would you know the system is working" tractable: you can see, live, whether the label and quote pairs feel grounded.
- **Grounding by verbatim span.** The schema requires `evidence` copied from the user message, and the route filters anything whose evidence isn't a substring of that message (case- and whitespace-normalized). That is the single biggest lever I had against hallucination in two days. A real version would re-prompt on drop instead of silently discarding.
- **Anonymous cookie is enough auth** for a case study. Full accounts would be ceremony.
- **One chat surface, one extraction pipeline, one side panel.** No voice, no summaries, no multi-user. Honesty over breadth.

## How I'd know it's working

- Edge cases I poke at: a clearly positive day (expect empty extraction), a one-word reply like "fine." (expect empty), a single message with two distinct negative emotions (expect both with separate evidence spans). The full set is in `eval/README.md`.
- The `evidence` field is the cheap eyeball test. If the quote isn't in the message, the system is failing.
- The next step (not in scope here) is a small labeled eval set of 20 to 30 short transcripts and an automated check on label precision plus evidence containment.

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

Configured for Vercel. The Neon Marketplace integration auto-provisions `DATABASE_URL`; `AI_GATEWAY_API_KEY` is set manually under project Settings, Environment Variables. Push to `main`, preview deploys, promote when ready.

## Schema

```
sessions(id, cookie_sid, created_at)
messages(id, session_id, role, content, parts, created_at)
emotions(id, session_id, message_id, label, intensity, evidence, rationale, created_at)
```

Emotions are foreign-keyed to the user message that triggered them, so a future view could show emotional drift over a session.

## Cost and abuse posture

The deploy uses two Claude Sonnet 4.6 calls per user turn (one stream, one structured extraction). To keep the bill honest:

- Per-session cap of 50 user messages and a 4000-char per-message ceiling, enforced in the route.
- No per-IP rate limit in code. If this saw real traffic I'd put Vercel Firewall in front of `/api/chat` or gate the demo behind a shared key. Two-day ceiling, called out rather than papered over.

## Safety

A static footer in the UI points to 988 (US) and Samaritans (UK) so someone in crisis has a real next step. The listener prompt explicitly does not diagnose, advise, or moralize. We do not auto-route to a hotline mid-conversation; interrupting the listener loop with a modal felt worse than a passive disclaimer for a case study. Defensible on the call.

## What I'd do with another week

- A real eval harness: ~50 hand-labeled transcripts, precision and recall on labels. The substring grounding check is already in `route.ts`; the wider harness isn't.
- Voice input. Push-to-talk changes how people disclose more than any other affordance I can think of in two days.
- Token-level grounding instead of free-form quotes: return character offsets so the transcript can highlight the evidence span in place.

## What's deliberately not here

- Voice / audio
- User accounts, login UI, password reset
- Multi-language (brief is English-only)
- Per-IP rate limiting beyond the session message cap
- A test suite (two-day ceiling, honesty over polish)
