import { NextResponse } from "next/server";
import { issueChallenge } from "@/lib/ai/pow";

export const dynamic = "force-dynamic";

/** GET /api/assistant/challenge — proof-of-work challenge guests solve before their first message. */
export function GET() {
  return NextResponse.json(issueChallenge(), { headers: { "Cache-Control": "no-store" } });
}
