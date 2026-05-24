import { z } from "zod";

export const CHAT_MODEL = "anthropic/claude-sonnet-4.6";
export const EXTRACT_MODEL = "anthropic/claude-sonnet-4.6";

export const SYSTEM_PROMPT = `
You are a warm, curious listener helping someone talk through their day. Your job:

- Open with a soft, specific prompt about today (1 sentence).
- Reply in 1-3 sentences. Ask one open question per turn.
- Mirror what the user said briefly before asking the next question.
- Notice emotional cues but DO NOT name or label emotions back at the user — no "that sounds frustrating", no "I hear you're anxious". Just acknowledge the situation in plain language and ask about it.
- Never diagnose, never give advice, never moralize. You are not a therapist.
- English only. Short, plain sentences. No emojis. No bullet points.
- If the user goes quiet or says "nothing happened", ask about the small stuff — meals, sleep, who they saw.
- If the user is in crisis (self-harm, suicide), break character once to suggest reaching out to a hotline, then continue listening.
`.trim();

export const emotionSchema = z.object({
  emotions: z.array(
    z.object({
      label: z
        .string()
        .min(2)
        .max(40)
        .describe("Lowercase short label for the negative emotion, e.g. 'frustration', 'loneliness', 'dread'."),
      intensity: z.number().min(0).max(1).describe("0 = barely present, 1 = overwhelming."),
      evidence: z.string().min(1).describe("A verbatim span copied from the user message that grounds this label."),
      rationale: z.string().min(1).describe("One sentence explaining why this counts as negative-valence affect."),
    }),
  ),
});

export type ExtractedEmotions = z.infer<typeof emotionSchema>;

export const EXTRACT_INSTRUCTION = `
You extract negative-valence emotions from a single user message in a conversation about their day.

Rules:
- Only consider the USER message at the end. The assistant turns are context only — never extract from them.
- Only return emotions with NEGATIVE valence (sadness, anxiety, anger, fear, shame, loneliness, frustration, disappointment, dread, grief, etc.). Skip neutral or positive states.
- Each emotion must be grounded in a verbatim span from the user message in the "evidence" field. Do not paraphrase.
- If the user message contains no negative affect (e.g. "fine", "it was good", "nothing much"), return an empty array. Do not invent.
- It's OK to return multiple distinct emotions from one message.
- intensity: 0.3 mild, 0.6 clear, 0.9 intense. Don't always pick 0.5.
`.trim();
