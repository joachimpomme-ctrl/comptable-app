/**
 * Shared types for the multi-agents pipeline.
 * Imported by orchestrator, gem-clone, reviewer, calculator, quality-gate.
 */

export type Domaine =
  | "LMNP"
  | "BNC"
  | "BIC"
  | "FONCIER"
  | "IFI"
  | "SUCCESSION"
  | "EPARGNE"
  | "AUTRE";

export type Criticite = "FAIBLE" | "MOYENNE" | "ELEVEE";

export type Profondeur = "SIMPLE" | "STANDARD" | "APPROFONDI";

/** Orchestrator output — classification of the user query. */
export interface OrchestratorOutput {
  domaine: Domaine;
  criticite: Criticite;
  besoin_calcul: boolean;
  irreversible: boolean;
  profondeur: Profondeur;
  raison_courte: string;
  _meta?: { provider: string; model: string };
}

/** Gem clone — raw response from the Gemini-cloned Gem. */
export interface GemResponse {
  reponse_brute: string;
  citations_brutes: string[]; // e.g. ["CGI Art. 39 C", "FORM-002"]
  millesime_detecte: string | null; // e.g. "2025"
  tokens_input: number;
  tokens_output: number;
  cache_hit: boolean;
  latency_ms: number;
}

/** Calculator — deterministic numeric result with full traceability. */
export interface CalculatorResult {
  formule: string; // e.g. "FORM-002"
  version: string; // e.g. "1.0"
  resultat: number;
  unite: string; // e.g. "EUR"
  etapes: { label: string; val: number; note?: string }[];
  parametres: Record<string, number>;
  source: string; // e.g. "Guide fiscal LM ARCOLIB 2025, 6211-6213"
}

/** Reviewer — structured verdict on the Gem response. */
export type Verdict = "VALIDÉ" | "À_CORRIGER" | "DIVERGENCE";

export interface ReviewerOutput {
  verdict: Verdict;
  citations_verifiees: string[];
  ecarts: string[];
  score_confiance: number; // 0.0–1.0
  commentaire_court: string;
  _meta?: { provider: string; model: string };
}

/** Quality Gate — deterministic final check, never silent failure. */
export interface QualityGateReport {
  format_ok: boolean;
  citations_invalides: string[];
  ids_kb_invalides: string[];
  millesime_present: boolean;
  statuts_signales: boolean;
  validation_requise_present: boolean;
  annotations: string[];
}

/** Persistence row written to Google Sheets (Historique_Compta). */
export interface SheetRow {
  timestamp: string; // ISO 8601
  question_hash: string;
  question: string;
  orch_classification: OrchestratorOutput | null;
  gem_response: GemResponse | null;
  calc_results: CalculatorResult[];
  reviewer_verdict: ReviewerOutput | null;
  qg_annotations: QualityGateReport | null;
  final_response: string;
  latency_ms: number;
  cost_eur: number;
  user_feedback: "OK" | "KO" | "À_AMÉLIORER" | null;
}

/** Streaming step emitted to the UI as each agent completes. */
export type PipelineStep =
  | { kind: "orchestrator"; output: OrchestratorOutput; latency_ms: number }
  | { kind: "gem"; output: GemResponse }
  | { kind: "calculator"; output: CalculatorResult }
  | { kind: "reviewer"; output: ReviewerOutput; latency_ms: number }
  | { kind: "quality-gate"; output: QualityGateReport; latency_ms: number }
  | { kind: "final"; response: string; total_latency_ms: number; cost_eur: number }
  | { kind: "error"; message: string; stage: string };
