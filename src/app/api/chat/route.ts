import { convertToModelMessages, generateText, Output, streamText, type UIMessage } from "ai";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { emotions, messages as messagesTable } from "@/db/schema";
import { CHAT_MODEL, EXTRACT_INSTRUCTION, EXTRACT_MODEL, emotionSchema, SYSTEM_PROMPT } from "@/lib/ai";
import { getOrCreateSession } from "@/lib/session";

export const maxDuration = 60;

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
    if (content.length > 0) {
      // dedupe: skip insert if same content was just saved (e.g. retry)
      const [recent] = await db
        .select()
        .from(messagesTable)
        .where(and(eq(messagesTable.sessionId, sessionId), eq(messagesTable.role, "user")))
        .orderBy(asc(messagesTable.createdAt));
      // simple approach: always insert; duplicates on retry are acceptable for case study
      void recent;
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

            const detected = output.emotions;
            if (detected.length > 0) {
              await db.insert(emotions).values(
                detected.map((e) => ({
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
