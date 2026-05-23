/**
 * Pipeline orchestration — ties together Orchestrator → Gem → Calculator
 *  → Reviewer → Quality Gate → persistence.
 *
 * Emits PipelineStep events as a NDJSON stream.
 */

import { createHash } from "node:crypto";

import { orchestrate } from "./agents/orchestrator";
import { askGem } from "./agents/gem-clone";
import { extractForm002Params } from "./agents/param-extractor";
import { computeForm002 } from "./agents/calculator/form-002";
import { review } from "./agents/reviewer";
import { runQualityGate } from "./quality-gate";
import { logToSheets } from "./sheets/logger";
import type {
  CalculatorResult,
  GemResponse,
  OrchestratorOutput,
  PipelineStep,
  ReviewerOutput,
  QualityGateReport,
  SheetRow,
} from "./types";

export interface PipelineOptions {
  /** Override : force the reviewer to run even on simple queries. */
  forceReview?: boolean;
}

/** Pricing estimates (€ per million tokens, May 2026). */
const PRICE_FLASH_INPUT = 0.15 / 1_000_000;
const PRICE_FLASH_INPUT_CACHED = PRICE_FLASH_INPUT * 0.1;
const PRICE_FLASH_OUTPUT = 0.6 / 1_000_000;
const PRICE_PRO_INPUT = 0.75 / 1_000_000;
const PRICE_PRO_OUTPUT = 3.0 / 1_000_000;

function estimateCostEur(args: {
  gem: GemResponse | null;
  reviewer: ReviewerOutput | null;
}): number {
  let total = 0;
  if (args.gem) {
    const inputRate = args.gem.cache_hit ? PRICE_FLASH_INPUT_CACHED : PRICE_FLASH_INPUT;
    total += args.gem.tokens_input * inputRate;
    total += args.gem.tokens_output * PRICE_FLASH_OUTPUT;
  }
  // Orchestrator + param-extractor cost is negligible (<200 tokens each), folded in.
  total += 0.0005;
  if (args.reviewer) {
    // Roughly: a Pro reviewer call adds ~$0.003-$0.006 per call.
    total += 0.004;
  }
  return Math.round(total * 10_000) / 10_000;
}

function questionHash(q: string): string {
  return createHash("sha256").update(q.trim().toLowerCase()).digest("hex").slice(0, 16);
}

/** Compose the final user-facing response from the Gem + annotations. */
function composeFinalResponse(args: {
  gem: GemResponse;
  qg: QualityGateReport;
  calc: CalculatorResult[];
  reviewer: ReviewerOutput | null;
}): string {
  let out = args.gem.reponse_brute;
  if (args.calc.length) {
    out += "\n\n— RÉSULTATS CALCULATEUR DÉTERMINISTE —";
    for (const c of args.calc) {
      out += `\n[${c.formule} v${c.version}] ${c.resultat} ${c.unite}`;
      out += `\nSource : ${c.source}`;
    }
  }
  const banners: string[] = [];
  if (args.reviewer && args.reviewer.verdict !== "VALIDÉ") {
    banners.push(`⚠ Reviewer : ${args.reviewer.verdict} — ${args.reviewer.commentaire_court}`);
  }
  if (args.qg.annotations.length) {
    banners.push("⚠ Quality Gate :");
    for (const a of args.qg.annotations) banners.push(`  • ${a}`);
  }
  if (banners.length) out += "\n\n" + banners.join("\n");
  return out;
}

/** Main pipeline — async generator yielding PipelineStep events. */
export async function* runPipeline(
  question: string,
  opts: PipelineOptions = {},
): AsyncGenerator<PipelineStep, void, void> {
  const t0 = Date.now();
  let orchestration: OrchestratorOutput | null = null;
  let gem: GemResponse | null = null;
  const calculatorResults: CalculatorResult[] = [];
  let reviewer: ReviewerOutput | null = null;
  let qg: QualityGateReport | null = null;

  // 1 — Orchestrator
  const tOrch = Date.now();
  try {
    orchestration = await orchestrate(question);
    yield { kind: "orchestrator", output: orchestration, latency_ms: Date.now() - tOrch };
  } catch (e) {
    yield {
      kind: "error",
      stage: "orchestrator",
      message: e instanceof Error ? e.message : String(e),
    };
    return;
  }

  // 2 — Gem (always runs)
  try {
    gem = await askGem(question);
    yield { kind: "gem", output: gem };
  } catch (e) {
    yield {
      kind: "error",
      stage: "gem",
      message: e instanceof Error ? e.message : String(e),
    };
    return;
  }

  // 3 — Calculator (LMNP only in MVP)
  if (orchestration.besoin_calcul && orchestration.domaine === "LMNP") {
    try {
      const params = await extractForm002Params(question);
      if (params) {
        const result = computeForm002(params);
        calculatorResults.push(result);
        yield { kind: "calculator", output: result };
      }
    } catch (e) {
      yield {
        kind: "error",
        stage: "calculator",
        message: e instanceof Error ? e.message : String(e),
      };
      // continue — calculator failure is not fatal
    }
  }

  // 4 — Reviewer (skip on FAIBLE unless forced)
  const shouldReview =
    opts.forceReview ||
    orchestration.criticite !== "FAIBLE" ||
    orchestration.irreversible;
  if (shouldReview) {
    const tRev = Date.now();
    try {
      reviewer = await review({
        question,
        orchestration,
        gem,
        calculator: calculatorResults,
      });
      yield {
        kind: "reviewer",
        output: reviewer,
        latency_ms: Date.now() - tRev,
      };
    } catch (e) {
      yield {
        kind: "error",
        stage: "reviewer",
        message: e instanceof Error ? e.message : String(e),
      };
      // continue — reviewer failure is not fatal
    }
  }

  // 5 — Quality Gate
  const tQg = Date.now();
  try {
    qg = await runQualityGate({ gem, reviewer });
    yield { kind: "quality-gate", output: qg, latency_ms: Date.now() - tQg };
  } catch (e) {
    yield {
      kind: "error",
      stage: "quality-gate",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  // 6 — Final consolidated response
  const finalResponse = composeFinalResponse({
    gem,
    qg: qg ?? {
      format_ok: true,
      citations_invalides: [],
      ids_kb_invalides: [],
      millesime_present: gem.millesime_detecte !== null,
      statuts_signales: true,
      validation_requise_present: false,
      annotations: ["Quality Gate non exécuté"],
    },
    calc: calculatorResults,
    reviewer,
  });

  const totalLatency = Date.now() - t0;
  const cost = estimateCostEur({ gem, reviewer });

  yield {
    kind: "final",
    response: finalResponse,
    total_latency_ms: totalLatency,
    cost_eur: cost,
  };

  // 7 — Persistence (fire-and-forget)
  const row: SheetRow = {
    timestamp: new Date().toISOString(),
    question_hash: questionHash(question),
    question,
    orch_classification: orchestration,
    gem_response: gem,
    calc_results: calculatorResults,
    reviewer_verdict: reviewer,
    qg_annotations: qg,
    final_response: finalResponse,
    latency_ms: totalLatency,
    cost_eur: cost,
    user_feedback: null,
  };
  logToSheets(row).catch((e) => console.error("[pipeline] sheets log error:", e));
}
