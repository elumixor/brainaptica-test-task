import { type NextRequest, NextResponse } from "next/server";

const COOKIE = "sid";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function proxy(req: NextRequest) {
  const existing = req.cookies.get(COOKIE)?.value;
  if (existing) return NextResponse.next();

  const res = NextResponse.next();
  res.cookies.set(COOKIE, crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return res;
}

export const config = {
  matcher: ["/", "/api/:path*"],
};
