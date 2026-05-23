/**
 * Quality Gate — deterministic final check, TypeScript only.
 *
 * Checks:
 *   1. Format de réponse (sections présentes)
 *   2. Chaque CGI Art. cité existe dans M_CGI.jsonl
 *   3. Chaque ID KB cité existe dans 07_crosswalk.jsonl
 *   4. Millésime présent si réponse fiscale/patrimoniale
 *   5. Statut candidate_to_validate signalé si applicable
 *   6. "Validation requise" présent sur domaines sensibles
 *
 * Failure mode: annotation, jamais d'échec silencieux.
 */

import { getIndexes, normalizeCgi } from "./kb/indexes";
import type { QualityGateReport, GemResponse, ReviewerOutput } from "./types";

const REQUIRED_SECTIONS = [
  /situation/i,
  /r[èe]gles?/i,
  /(application|calcul)/i,
  /(points?\s+de\s+)?vigilance/i,
  /sources?/i,
];

const SENSITIVE_KEYWORDS = [
  /TVA/i,
  /BNC/i,
  /BIC/i,
  /LMNP/i,
  /LMP/i,
  /plus[\s-]?values?/i,
  /succession/i,
  /donation/i,
  /assurance[\s-]?vie/i,
  /IFI/i,
  /SCI/i,
  /d[ée]membrement/i,
  /PER\b/i,
  /micro/i,
  /imp[oô]t/i,
];

const CANDIDATE_TO_VALIDATE_HINTS = [
  /CARMF/i,
  /CARPIMKO/i,
];

function hasAllSections(text: string): boolean {
  return REQUIRED_SECTIONS.every((re) => re.test(text));
}

function mentionsValidationRequise(text: string): boolean {
  return /validation\s+requise/i.test(text);
}

function isSensitiveTopic(text: string): boolean {
  return SENSITIVE_KEYWORDS.some((re) => re.test(text));
}

function hasCandidateToValidateMention(text: string): boolean {
  return /candidate[_\s]to[_\s]validate/i.test(text);
}

function mentionsCandidateTopics(text: string): boolean {
  return CANDIDATE_TO_VALIDATE_HINTS.some((re) => re.test(text));
}

export async function runQualityGate(args: {
  gem: GemResponse;
  reviewer: ReviewerOutput | null;
}): Promise<QualityGateReport> {
  const { gem } = args;
  const indexes = await getIndexes();
  const text = gem.reponse_brute;
  const annotations: string[] = [];

  // --- 1. Format ---
  const format_ok = hasAllSections(text);
  if (!format_ok) {
    const missing = REQUIRED_SECTIONS.filter((re) => !re.test(text))
      .map((re) => re.source)
      .join(", ");
    annotations.push(`Sections manquantes ou non détectées : ${missing}`);
  }

  // --- 2. Citations CGI ---
  const cgiCitations = gem.citations_brutes.filter((c) => /CGI\s+/i.test(c));
  const citations_invalides: string[] = [];
  for (const c of cgiCitations) {
    const norm = normalizeCgi(c);
    if (!indexes.cgi.has(norm)) {
      citations_invalides.push(c);
    }
  }
  if (citations_invalides.length > 0) {
    annotations.push(
      `Citations CGI non trouvées en KB : ${citations_invalides.join(", ")}`,
    );
  }

  // --- 3. IDs KB ---
  const kbIdCitations = gem.citations_brutes.filter((c) =>
    /^(bnc|lm|gfpl|m\d+|form)_\d{3,4}$/i.test(c),
  );
  const ids_kb_invalides: string[] = [];
  for (const id of kbIdCitations) {
    if (!indexes.kbIds.has(id.toLowerCase())) {
      ids_kb_invalides.push(id);
    }
  }
  if (ids_kb_invalides.length > 0) {
    annotations.push(
      `IDs KB inconnus : ${ids_kb_invalides.join(", ")}`,
    );
  }

  // --- 4. Millésime ---
  const millesime_present = gem.millesime_detecte !== null;
  if (!millesime_present && isSensitiveTopic(text)) {
    annotations.push(
      "Millésime fiscal absent alors que la réponse touche un sujet sensible",
    );
  }

  // --- 5. Statuts signalés ---
  // If the response cites CARMF/CARPIMKO rates, they should be flagged as candidate_to_validate.
  const needsCandidateFlag = mentionsCandidateTopics(text);
  const statuts_signales =
    !needsCandidateFlag || hasCandidateToValidateMention(text);
  if (!statuts_signales) {
    annotations.push(
      "Taux/montants CARMF ou CARPIMKO cités sans flag candidate_to_validate",
    );
  }

  // --- 6. Validation requise sur sujet sensible ---
  const validation_requise_present = mentionsValidationRequise(text);
  if (!validation_requise_present && isSensitiveTopic(text)) {
    annotations.push(
      "« Validation requise » manquant alors que le sujet est sensible",
    );
  }

  return {
    format_ok,
    citations_invalides,
    ids_kb_invalides,
    millesime_present,
    statuts_signales,
    validation_requise_present,
    annotations,
  };
}
