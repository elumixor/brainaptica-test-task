import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { emotions } from "@/db/schema";
import { getOrCreateSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessionId = await getOrCreateSession();
  const db = getDb();
  const rows = await db
    .select()
    .from(emotions)
    .where(eq(emotions.sessionId, sessionId))
    .orderBy(desc(emotions.createdAt));
  return Response.json({ emotions: rows });
}
