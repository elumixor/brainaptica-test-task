# Eval cases

Hand-written user messages and the extractor's output, run against
`anthropic/claude-sonnet-4.6` through the same prompt the app uses
(`EXTRACT_INSTRUCTION` in `src/lib/ai.ts`).

Two days isn't enough to build a real eval harness, but it's enough to
show the system on real input. The "expected" column is my judgment, not
ground truth — I'd want 50+ labeled transcripts and inter-rater
agreement before calling any number a metric.

The three things I watch for:

1. **Empty extraction on neutral/positive.** False positives are the
   most damaging failure here — the whole product implies "we noticed
   something you said."
2. **Evidence is a verbatim span.** Enforced in code now
   (`route.ts` filters anything that isn't `userText.includes(evidence)`).
3. **Distinct emotions get distinct evidence spans**, not the same
   quote twice with two labels.

## Cases

| # | User message | Expected | Notes |
|---|---|---|---|
| 1 | `Honestly today was great — got the promotion I'd been chasing and went out with friends after.` | `[]` | Clearly positive day. Any extraction is a false positive. |
| 2 | `fine.` | `[]` | One-word reply, no affect. Tests that the model doesn't invent. |
| 3 | `My manager skipped my 1:1 again and I'm pretty sure my deck for Thursday is going to get torn apart.` | `frustration` (skipped 1:1), `dread` / `anxiety` (deck Thursday) — two distinct spans | Two distinct negatives in one turn. |
| 4 | `Oh sure, ANOTHER all-hands where leadership "values our feedback".` | `cynicism` or `resentment` | Sarcastic positive. The literal words are neutral; the affect is in the framing. Hardest case for grounding because the "evidence" isn't a feeling word. |
| 5 | `I just don't see the point of any of it anymore.` | `hopelessness` / `despair`, possibly with a soft crisis flag | Crisis-adjacent. A static disclaimer in the UI footer points to 988/Samaritans; we do not auto-route or surface a modal mid-conversation, since interrupting the listener flow can feel performative. The extractor still labels the affect so a future product surface (e.g. moderator dashboard) could escalate. |
| 6 | `Slept maybe four hours. Woke up at 5 with that tight chest feeling and just stared at the ceiling.` | `anxiety` (tight chest), maybe `exhaustion` if treated as negative-valence | Somatic disclosure. Evidence span should be `tight chest feeling`, not a paraphrase. |
| 7 | `Nothing much. Made coffee, walked the dog, answered some emails.` | `[]` | Neutral/flat. Common pattern; must not invent affect. |
| 8 | `I miss her. Three years and it still hits at the weirdest times.` | `grief` / `longing` | Bereavement language. Evidence should be `I miss her` or `it still hits`. |
| 9 | `Job's fine. Pay's fine. I just can't shake the feeling I'm watching someone else's life from the outside.` | `dissociation` / `emptiness` / `disconnection` | Free-form-label win — none of those map cleanly to Plutchik. |
| 10 | `lol classic me, forgot my mum's birthday again` | `shame` / `guilt`, low intensity | Casual register, real affect underneath the "lol". Tests that register-flattening doesn't kill the signal. |

## What I'd run if I had another week

- Programmatic check: for each case, hit the route, assert label set and
  that every `evidence` substring-matches the message. Fail the case if
  not.
- Precision: of returned emotions, how many a human agrees with.
- Recall: of human-labeled emotions, how many the model returned.
- Hold case #4 (sarcasm) and #9 (free-form) out as the "honest hard set."
