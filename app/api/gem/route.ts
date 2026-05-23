/**
 * POST /api/gem
 * Direct access to the Gem clone (no orchestration, no reviewer).
 * Used by the test runner to measure the baseline.
 *
 * Body: { question: string }
 * Returns: GemResponse (see lib/types.ts)
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { askGem } from "@/lib/agents/gem-clone";

export const runtime = "nodejs"; // need fs access for KB loader
export const maxDuration = 60;

const Body = z.object({
  question: z.string().trim().min(1).max(8000),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: err instanceof Error ? err.message : "Invalid body",
      },
      { status: 400 },
    );
  }

  try {
    const out = await askGem(parsed.question);
    return NextResponse.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/gem]", message);
    return NextResponse.json(
      { error: "gem_error", message },
      { status: 500 },
    );
  }
}
