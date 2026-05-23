/**
 * Unit tests for the Quality Gate.
 * Run with: npm test
 */

import { test, expect } from "vitest";
import { runQualityGate } from "../lib/quality-gate";
import { normalizeCgi } from "../lib/kb/indexes";
import type { GemResponse } from "../lib/types";

function makeGem(overrides: Partial<GemResponse> = {}): GemResponse {
  return {
    reponse_brute: "",
    citations_brutes: [],
    millesime_detecte: null,
    tokens_input: 0,
    tokens_output: 0,
    cache_hit: false,
    latency_ms: 0,
    ...overrides,
  };
}

const GOOD_RESPONSE = `Situation identifiée
Cession d'un bien LMNP détenu 11 ans.

Règles applicables
- CGI Art. 150 U
- CGI Art. 150 VB
- FORM-002

Application / Calcul
PV brute : 95 500 €.

Points de vigilance
Réintégration des amortissements depuis 2025.

Sources
Guide fiscal LM ARCOLIB 2025.

Validation requise
Expert-comptable ou notaire avant la signature.`;

test("normalizeCgi — variants converge to canonical form", () => {
  expect(normalizeCgi("CGI Art. 14")).toBe("CGI Art. 14");
  expect(normalizeCgi("CGI art. 14")).toBe("CGI Art. 14");
  expect(normalizeCgi("CGI Art 14")).toBe("CGI Art. 14");
  expect(normalizeCgi("CGI Art. 39-C")).toBe("CGI Art. 39 C");
});

test("Quality Gate — réponse propre, format OK", async () => {
  const r = await runQualityGate({
    gem: makeGem({
      reponse_brute: GOOD_RESPONSE,
      citations_brutes: ["CGI Art. 150 U", "CGI Art. 150 VB"],
      millesime_detecte: "2025",
    }),
    reviewer: null,
  });
  expect(r.format_ok).toBe(true);
  expect(r.citations_invalides).toEqual([]);
  expect(r.millesime_present).toBe(true);
  expect(r.validation_requise_present).toBe(true);
  expect(r.statuts_signales).toBe(true);
});

test("Quality Gate — citation CGI inventée détectée", async () => {
  const r = await runQualityGate({
    gem: makeGem({
      reponse_brute: GOOD_RESPONSE,
      citations_brutes: ["CGI Art. 99999"],
      millesime_detecte: "2025",
    }),
    reviewer: null,
  });
  expect(r.citations_invalides).toContain("CGI Art. 99999");
  expect(r.annotations.some((a) => a.includes("Citations CGI non trouvées"))).toBe(true);
});

test("Quality Gate — millésime absent sur sujet sensible", async () => {
  const r = await runQualityGate({
    gem: makeGem({
      reponse_brute:
        "Situation\nLMNP\nRègles\nCGI Art. 150 U\nApplication\nCalcul\nVigilance\nSources\nValidation requise",
      citations_brutes: ["CGI Art. 150 U"],
      millesime_detecte: null,
    }),
    reviewer: null,
  });
  expect(r.millesime_present).toBe(false);
  expect(r.annotations.some((a) => a.includes("Millésime"))).toBe(true);
});

test("Quality Gate — Validation requise absente sur sujet sensible", async () => {
  const r = await runQualityGate({
    gem: makeGem({
      reponse_brute:
        "Situation\nLMNP\nRègles\nCGI Art. 150 U\nApplication\nCalcul\nVigilance\nSources",
      citations_brutes: ["CGI Art. 150 U"],
      millesime_detecte: "2025",
    }),
    reviewer: null,
  });
  expect(r.validation_requise_present).toBe(false);
  expect(r.annotations.some((a) => a.includes("Validation requise"))).toBe(true);
});

test("Quality Gate — CARMF cité sans flag candidate_to_validate", async () => {
  const r = await runQualityGate({
    gem: makeGem({
      reponse_brute:
        "Situation\nCotisations\nRègles\nApplication\nCARMF rate xx\nVigilance\nSources\nValidation requise",
      citations_brutes: [],
      millesime_detecte: "2025",
    }),
    reviewer: null,
  });
  expect(r.statuts_signales).toBe(false);
});
