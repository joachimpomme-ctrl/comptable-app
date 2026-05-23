/**
 * LMNP test runner — measures baseline (Gem-only) vs ecosystem (full pipeline).
 *
 * Prerequisites:
 *   - Dev server running:  npm run dev
 *   - GEMINI_API_KEY set in .env.local
 *
 * Usage:
 *   npx tsx tests/runner-lmnp.ts
 *
 * Outputs:
 *   tests/results-baseline.json   — raw responses from /api/gem
 *   tests/results-ecosystem.json  — raw responses from /api/ask
 *   tests/results-summary.md      — comparative metrics report
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PipelineStep, GemResponse } from "../lib/types";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const CASES_FILE = path.resolve(import.meta.dirname, "lmnp-cases.json");

interface TestCase {
  id: string;
  level: string;
  question: string;
  expected_citations: string[];
  expected_contains: string[];
  expected_millesime: string;
  expected_calc: { formule: string; resultat?: number; pv_brute_attendue?: number; pv_nette_ir_attendue?: number; duree?: number; exception_etudiant?: boolean } | null;
  domaine: string;
  criticite: string;
}

interface CasesFile {
  cases: TestCase[];
}

interface BaselineResult {
  case_id: string;
  gem: GemResponse;
  latency_ms: number;
  error?: string;
}

interface EcosystemResult {
  case_id: string;
  steps: PipelineStep[];
  total_latency_ms: number;
  cost_eur: number;
  final_response: string;
  error?: string;
}

interface CaseEvaluation {
  case_id: string;
  citations_attendues: number;
  citations_trouvees_baseline: number;
  citations_trouvees_eco: number;
  arithmetique_ok_baseline: boolean;
  arithmetique_ok_eco: boolean;
  millesime_baseline: boolean;
  millesime_eco: boolean;
  latency_baseline_ms: number;
  latency_eco_ms: number;
}

function normalizeRef(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]/g, "")
    .replace(/[-‐]/g, "-")
    .trim();
}

function findCitation(text: string, citation: string): boolean {
  const ref = normalizeRef(citation);
  const norm = normalizeRef(text);
  return norm.includes(ref);
}

function findExpectedTokens(text: string, expected: string[]): number {
  let hits = 0;
  for (const t of expected) {
    if (text.toLowerCase().includes(t.toLowerCase())) hits++;
  }
  return hits;
}

function detectMillesime(text: string, expected: string): boolean {
  return text.includes(expected);
}

async function runBaseline(c: TestCase): Promise<BaselineResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/gem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: c.question }),
    });
    if (!res.ok) {
      return {
        case_id: c.id,
        gem: emptyGem(),
        latency_ms: Date.now() - t0,
        error: `HTTP ${res.status}`,
      };
    }
    const gem = (await res.json()) as GemResponse;
    return { case_id: c.id, gem, latency_ms: Date.now() - t0 };
  } catch (err) {
    return {
      case_id: c.id,
      gem: emptyGem(),
      latency_ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function emptyGem(): GemResponse {
  return {
    reponse_brute: "",
    citations_brutes: [],
    millesime_detecte: null,
    tokens_input: 0,
    tokens_output: 0,
    cache_hit: false,
    latency_ms: 0,
  };
}

async function runEcosystem(c: TestCase): Promise<EcosystemResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: c.question, forceReview: true }),
    });
    if (!res.ok || !res.body) {
      return {
        case_id: c.id,
        steps: [],
        total_latency_ms: Date.now() - t0,
        cost_eur: 0,
        final_response: "",
        error: `HTTP ${res.status}`,
      };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const steps: PipelineStep[] = [];
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          steps.push(JSON.parse(line) as PipelineStep);
        } catch {
          // skip malformed
        }
      }
    }
    const final = steps.find((s) => s.kind === "final") as
      | Extract<PipelineStep, { kind: "final" }>
      | undefined;
    return {
      case_id: c.id,
      steps,
      total_latency_ms: final?.total_latency_ms ?? Date.now() - t0,
      cost_eur: final?.cost_eur ?? 0,
      final_response: final?.response ?? "",
    };
  } catch (err) {
    return {
      case_id: c.id,
      steps: [],
      total_latency_ms: Date.now() - t0,
      cost_eur: 0,
      final_response: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function evaluateArithmetic(c: TestCase, response: string): boolean {
  if (!c.expected_calc) return true; // no calc expected → trivially ok
  const calc = c.expected_calc;
  if (calc.resultat !== undefined && !response.includes(String(calc.resultat))) {
    return false;
  }
  if (calc.pv_brute_attendue !== undefined) {
    const s = calc.pv_brute_attendue.toLocaleString("fr-FR");
    if (!response.includes(s) && !response.includes(String(calc.pv_brute_attendue))) {
      return false;
    }
  }
  return true;
}

function evaluateCase(
  c: TestCase,
  baseline: BaselineResult,
  ecosystem: EcosystemResult,
): CaseEvaluation {
  const baselineText = baseline.gem.reponse_brute;
  const ecoText = ecosystem.final_response;

  return {
    case_id: c.id,
    citations_attendues: c.expected_citations.length,
    citations_trouvees_baseline: c.expected_citations.filter((cit) =>
      findCitation(baselineText, cit),
    ).length,
    citations_trouvees_eco: c.expected_citations.filter((cit) =>
      findCitation(ecoText, cit),
    ).length,
    arithmetique_ok_baseline: evaluateArithmetic(c, baselineText),
    arithmetique_ok_eco: evaluateArithmetic(c, ecoText),
    millesime_baseline: detectMillesime(baselineText, c.expected_millesime),
    millesime_eco: detectMillesime(ecoText, c.expected_millesime),
    latency_baseline_ms: baseline.latency_ms,
    latency_eco_ms: ecosystem.total_latency_ms,
  };
}

function summarize(evals: CaseEvaluation[]) {
  const n = evals.length;
  const sumCit = evals.reduce((a, e) => a + e.citations_attendues, 0);
  const sumCitBase = evals.reduce((a, e) => a + e.citations_trouvees_baseline, 0);
  const sumCitEco = evals.reduce((a, e) => a + e.citations_trouvees_eco, 0);
  const arithBase = evals.filter((e) => e.arithmetique_ok_baseline).length;
  const arithEco = evals.filter((e) => e.arithmetique_ok_eco).length;
  const milleBase = evals.filter((e) => e.millesime_baseline).length;
  const milleEco = evals.filter((e) => e.millesime_eco).length;
  const latBaseSorted = evals.map((e) => e.latency_baseline_ms).sort((a, b) => a - b);
  const latEcoSorted = evals.map((e) => e.latency_eco_ms).sort((a, b) => a - b);
  const median = (arr: number[]) =>
    arr.length ? arr[Math.floor(arr.length / 2)] : 0;
  return {
    cases: n,
    citations_score_baseline_pct: sumCit ? Math.round((sumCitBase / sumCit) * 100) : 0,
    citations_score_eco_pct: sumCit ? Math.round((sumCitEco / sumCit) * 100) : 0,
    arith_score_baseline_pct: Math.round((arithBase / n) * 100),
    arith_score_eco_pct: Math.round((arithEco / n) * 100),
    millesime_score_baseline_pct: Math.round((milleBase / n) * 100),
    millesime_score_eco_pct: Math.round((milleEco / n) * 100),
    latency_p50_baseline_ms: median(latBaseSorted),
    latency_p50_eco_ms: median(latEcoSorted),
  };
}

function reportMd(evals: CaseEvaluation[], summary: ReturnType<typeof summarize>): string {
  const lines: string[] = [];
  lines.push("# LMNP Test Suite — Comparative Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Cases: ${summary.cases}`);
  lines.push("");
  lines.push("## Aggregate metrics");
  lines.push("");
  lines.push("| Metric | Baseline (Gem) | Ecosystem | Delta |");
  lines.push("|---|---:|---:|---:|");
  lines.push(
    `| Citations attendues trouvées | ${summary.citations_score_baseline_pct} % | ${summary.citations_score_eco_pct} % | ${
      summary.citations_score_eco_pct - summary.citations_score_baseline_pct
    } pts |`,
  );
  lines.push(
    `| Calculs corrects | ${summary.arith_score_baseline_pct} % | ${summary.arith_score_eco_pct} % | ${
      summary.arith_score_eco_pct - summary.arith_score_baseline_pct
    } pts |`,
  );
  lines.push(
    `| Millésime présent | ${summary.millesime_score_baseline_pct} % | ${summary.millesime_score_eco_pct} % | ${
      summary.millesime_score_eco_pct - summary.millesime_score_baseline_pct
    } pts |`,
  );
  lines.push(
    `| Latence p50 (ms) | ${summary.latency_p50_baseline_ms} | ${summary.latency_p50_eco_ms} | ×${(summary.latency_p50_eco_ms / Math.max(1, summary.latency_p50_baseline_ms)).toFixed(2)} |`,
  );
  lines.push("");
  lines.push("## Per-case detail");
  lines.push("");
  lines.push("| Case | Citations (B/E/Att) | Arith B | Arith E | Mill. B | Mill. E | Lat B ms | Lat E ms |");
  lines.push("|---|---|:-:|:-:|:-:|:-:|---:|---:|");
  for (const e of evals) {
    lines.push(
      `| ${e.case_id} | ${e.citations_trouvees_baseline}/${e.citations_trouvees_eco}/${e.citations_attendues} | ${e.arithmetique_ok_baseline ? "✓" : "✗"} | ${e.arithmetique_ok_eco ? "✓" : "✗"} | ${e.millesime_baseline ? "✓" : "✗"} | ${e.millesime_eco ? "✓" : "✗"} | ${e.latency_baseline_ms} | ${e.latency_eco_ms} |`,
    );
  }
  return lines.join("\n");
}

async function main() {
  const data = JSON.parse(await readFile(CASES_FILE, "utf8")) as CasesFile;
  console.log(`Loaded ${data.cases.length} cases. Hitting ${BASE_URL}.`);

  // Warm-up : first call creates the explicit cache.
  console.log("Warming cache with first case...");
  await runBaseline(data.cases[0]);

  const baselineResults: BaselineResult[] = [];
  const ecosystemResults: EcosystemResult[] = [];
  const evaluations: CaseEvaluation[] = [];

  for (let i = 0; i < data.cases.length; i++) {
    const c = data.cases[i];
    console.log(`[${i + 1}/${data.cases.length}] ${c.id} — ${c.question.slice(0, 60)}…`);
    const b = await runBaseline(c);
    if (b.error) console.warn(`  baseline error: ${b.error}`);
    const e = await runEcosystem(c);
    if (e.error) console.warn(`  ecosystem error: ${e.error}`);
    baselineResults.push(b);
    ecosystemResults.push(e);
    evaluations.push(evaluateCase(c, b, e));
  }

  const summary = summarize(evaluations);

  await writeFile(
    path.resolve(import.meta.dirname, "results-baseline.json"),
    JSON.stringify(baselineResults, null, 2),
  );
  await writeFile(
    path.resolve(import.meta.dirname, "results-ecosystem.json"),
    JSON.stringify(ecosystemResults, null, 2),
  );
  const md = reportMd(evaluations, summary);
  await writeFile(
    path.resolve(import.meta.dirname, "results-summary.md"),
    md,
  );

  console.log("\n" + md + "\n");
  console.log(`Reports written under tests/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
