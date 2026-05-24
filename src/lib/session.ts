import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { sessions } from "@/db/schema";

const COOKIE = "sid";

/**
 * Ensure the cookie's session has a corresponding row in `sessions`.
 * The cookie itself is set by `src/proxy.ts` before the request reaches us.
 * Returns the session id (DB uuid).
 */
export async function getOrCreateSession(): Promise<string> {
  const store = await cookies();
  const sid = store.get(COOKIE)?.value;
  if (!sid) {
    throw new Error("missing session cookie — proxy.ts did not set it");
  }

  const db = getDb();
  const [existing] = await db.select().from(sessions).where(eq(sessions.cookieSid, sid)).limit(1);
  if (existing) return existing.id;

  const [created] = await db.insert(sessions).values({ cookieSid: sid }).returning();
  return created.id;
}
