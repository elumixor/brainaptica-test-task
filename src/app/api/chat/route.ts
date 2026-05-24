import { convertToModelMessages, generateText, Output, streamText, type UIMessage } from "ai";
import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { emotions, messages as messagesTable } from "@/db/schema";
import { CHAT_MODEL, EXTRACT_INSTRUCTION, EXTRACT_MODEL, emotionSchema, SYSTEM_PROMPT } from "@/lib/ai";
import { getOrCreateSession } from "@/lib/session";

export const maxDuration = 60;

export const MAX_USER_MESSAGE_CHARS = 4000;
export const MAX_USER_MESSAGES_PER_SESSION = 50;

function textOf(m: UIMessage): string {
  return m.parts
    .filter((p): p is Extract<UIMessage["parts"][number], { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

export async function POST(req: Request) {
  const sessionId = await getOrCreateSession();
  const { messages }: { messages: UIMessage[] } = await req.json();

  if (messages.length === 0) {
    return new Response("no messages", { status: 400 });
  }

  const db = getDb();

  // Persist the latest user message (id may be client-generated; let DB assign).
  const latestUser = messages[messages.length - 1];
  let savedUserId: string | null = null;
  if (latestUser.role === "user") {
    const content = textOf(latestUser);
    if (content.length > MAX_USER_MESSAGE_CHARS) {
      return new Response("message too long", { status: 413 });
    }
    if (content.length > 0) {
      const userCount = await db
        .select({ c: count() })
        .from(messagesTable)
        .where(and(eq(messagesTable.sessionId, sessionId), eq(messagesTable.role, "user")));
      if ((userCount[0]?.c ?? 0) >= MAX_USER_MESSAGES_PER_SESSION) {
        return new Response("session message limit reached; start a new chat", { status: 429 });
      }
      const [row] = await db
        .insert(messagesTable)
        .values({ sessionId, role: "user", content, parts: latestUser.parts as unknown })
        .returning({ id: messagesTable.id });
      savedUserId = row.id;
    }
  }

  const result = streamText({
    model: CHAT_MODEL,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ messages: finalMessages }) => {
      try {
        // Save the new assistant turn (last message).
        const assistantMsg = finalMessages[finalMessages.length - 1];
        if (assistantMsg?.role === "assistant") {
          const content = textOf(assistantMsg);
          await db.insert(messagesTable).values({
            sessionId,
            role: "assistant",
            content,
            parts: assistantMsg.parts as unknown,
          });
        }

        // Extract emotions from the latest user message in context.
        if (savedUserId && latestUser.role === "user") {
          const userText = textOf(latestUser);
          if (userText.length > 0) {
            const contextWindow = finalMessages
              .slice(-6, -1)
              .map((m) => `${m.role.toUpperCase()}: ${textOf(m)}`)
              .join("\n");
            const prompt = `${EXTRACT_INSTRUCTION}\n\nContext (older turns):\n${contextWindow || "(none)"}\n\nUSER MESSAGE TO ANALYZE:\n"""${userText}"""`;

            const { output } = await generateText({
              model: EXTRACT_MODEL,
              prompt,
              output: Output.object({ schema: emotionSchema }),
            });

            // Grounding gate: drop any emotion whose evidence isn't a substring
            // of the user message, after case- and whitespace-normalization.
            // The schema asks the model for a verbatim quote; this enforces it
            // without dying on smart quotes or trailing punctuation.
            const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
            const userNorm = norm(userText);
            const grounded = output.emotions.filter((e) => userNorm.includes(norm(e.evidence)));
            const dropped = output.emotions.length - grounded.length;
            if (dropped > 0) {
              console.warn(`[extract] dropped ${dropped} ungrounded emotion(s) for message ${savedUserId}`);
            }

            if (grounded.length > 0) {
              await db.insert(emotions).values(
                grounded.map((e) => ({
                  sessionId,
                  messageId: savedUserId as string,
                  label: e.label.toLowerCase().trim(),
                  intensity: e.intensity.toFixed(2),
                  evidence: e.evidence,
                  rationale: e.rationale,
                })),
              );
            }
          }
        }
      } catch (err) {
        console.error("[onFinish] persistence/extraction failed", err);
      }
    },
  });
}
