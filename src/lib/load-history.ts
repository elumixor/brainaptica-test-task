import type { UIMessage } from "ai";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { emotions as emotionsTable, messages as messagesTable } from "@/db/schema";

export type EmotionRow = {
  id: string;
  messageId: string;
  label: string;
  intensity: number;
  evidence: string;
  rationale: string;
  createdAt: string;
};

export async function loadHistory(sessionId: string): Promise<{
  initialMessages: UIMessage[];
  initialEmotions: EmotionRow[];
}> {
  const db = getDb();
  const [rows, emotionRows] = await Promise.all([
    db.select().from(messagesTable).where(eq(messagesTable.sessionId, sessionId)).orderBy(asc(messagesTable.createdAt)),
    db.select().from(emotionsTable).where(eq(emotionsTable.sessionId, sessionId)).orderBy(asc(emotionsTable.createdAt)),
  ]);

  const initialMessages: UIMessage[] = rows.map((r) => ({
    id: r.id,
    role: r.role,
    parts: (r.parts as UIMessage["parts"] | null) ?? [{ type: "text", text: r.content }],
  }));

  const initialEmotions: EmotionRow[] = emotionRows.map((e) => ({
    id: e.id,
    messageId: e.messageId,
    label: e.label,
    intensity: Number(e.intensity),
    evidence: e.evidence,
    rationale: e.rationale,
    createdAt: e.createdAt.toISOString(),
  }));

  return { initialMessages, initialEmotions };
}
