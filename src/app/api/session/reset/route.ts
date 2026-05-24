import { cookies } from "next/headers";

export async function POST() {
  const store = await cookies();
  store.delete("sid");
  return Response.json({ ok: true });
}
