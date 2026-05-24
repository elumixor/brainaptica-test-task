import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { sessions } from "@/db/schema";

const COOKIE = "sid";
const ONE_YEAR = 60 * 60 * 24 * 365;

function newSid() {
  // crypto.randomUUID is available in Node 24 + edge runtimes
  return crypto.randomUUID();
}

/**
 * Ensure the request has a session cookie + a row in `sessions`.
 * Returns the session id (DB uuid, not the cookie value).
 */
export async function getOrCreateSession(): Promise<string> {
  const store = await cookies();
  let sid = store.get(COOKIE)?.value;
  const db = getDb();

  if (sid) {
    const [existing] = await db.select().from(sessions).where(eq(sessions.cookieSid, sid)).limit(1);
    if (existing) return existing.id;
  }

  // create cookie if missing, insert session row
  sid ??= newSid();
  const [created] = await db.insert(sessions).values({ cookieSid: sid }).returning();
  store.set(COOKIE, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return created.id;
}
