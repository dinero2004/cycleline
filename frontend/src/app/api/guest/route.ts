import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { GUEST_COOKIE, GUEST_LIMITS, newGuestId, signGuestId, verifyGuestId } from "@/lib/guest";

/** POST /api/guest — gives the browser an anonymous, signed guest id (idempotent) and the guest limits. */
export async function POST() {
  const jar = await cookies();
  const existing = await verifyGuestId(jar.get(GUEST_COOKIE)?.value);
  if (!existing) {
    jar.set(GUEST_COOKIE, await signGuestId(newGuestId()), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return NextResponse.json({ limits: GUEST_LIMITS });
}
