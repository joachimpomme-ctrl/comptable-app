/**
 * POST /api/ask
 * Full multi-agent pipeline, streams NDJSON events.
 *
 * Body: { question: string, forceReview?: boolean }
 * Response: NDJSON stream where each line is a PipelineStep (see lib/types.ts).
 */

import { z } from "zod";
import { runPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  question: z.string().trim().min(1).max(8000),
  forceReview: z.boolean().optional(),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "invalid_request",
        message: err instanceof Error ? err.message : "Invalid body",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const step of runPipeline(parsed.question, {
          forceReview: parsed.forceReview,
        })) {
          controller.enqueue(encoder.encode(JSON.stringify(step) + "\n"));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ kind: "error", stage: "pipeline", message }) +
              "\n",
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
