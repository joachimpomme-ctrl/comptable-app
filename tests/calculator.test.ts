/**
 * Unit tests for the deterministic calculators.
 * Run with: npm test
 */

import { test, expect } from "vitest";

import { computeForm001 } from "../lib/agents/calculator/form-001";
import { computeForm002 } from "../lib/agents/calculator/form-002";
import {
  abattementIR,
  abattementPS,
  taxeSupplementaire,
} from "../lib/agents/calculator/abattements";

// ============================================================
// Abattements
// ============================================================
test("abattementIR — 0 % avant 6 ans", async () => {
  expect(await abattementIR(0)).toBe(0);
  expect(await abattementIR(5)).toBe(0);
});

test("abattementIR — 6 % linéaire de 6 à 21 ans", async () => {
  expect(await abattementIR(6)).toBeCloseTo(0.06, 9);
  expect(await abattementIR(11)).toBeCloseTo(0.36, 9);
  expect(await abattementIR(21)).toBeCloseTo(0.96, 9);
});

test("abattementIR — exo à 22 ans", async () => {
  expect(await abattementIR(22)).toBe(1);
  expect(await abattementIR(30)).toBe(1);
});

test("abattementPS — 0 % avant 6 ans", async () => {
  expect(await abattementPS(5)).toBe(0);
});

test("abattementPS — 1,65 % linéaire de 6 à 21 ans", async () => {
  expect(await abattementPS(6)).toBeCloseTo(0.0165, 9);
  expect(await abattementPS(11)).toBeCloseTo(0.099, 9);
});

test("abattementPS — paliers 22 et 23-30 ans", async () => {
  expect(await abattementPS(22)).toBeCloseTo(0.264 + 0.016, 9);
  expect(await abattementPS(30)).toBeCloseTo(1, 9);
});

test("taxeSupplementaire — exonération sous 50k", async () => {
  expect(await taxeSupplementaire(49_999)).toBe(0);
  expect(await taxeSupplementaire(50_000)).toBe(0);
});

test("taxeSupplementaire — palier 60-100k à 2 %", async () => {
  expect(await taxeSupplementaire(80_000)).toBe(1_600);
});

test("taxeSupplementaire — palier > 260k à 6 %", async () => {
  expect(await taxeSupplementaire(300_000)).toBe(18_000);
});

// ============================================================
// FORM-001 — Amortissement art. 39-C
// ============================================================
test("FORM-001 — amort. déductible plafonné par limite", () => {
  const r = computeForm001({
    loyers_acquis: 12_000,
    charges_hors_amortissements: 4_000,
    amortissements_comptabilises: 10_000,
  });
  expect(r.resultat).toBe(8_000);
  expect(r.formule).toBe("FORM-001");
  const ard = r.etapes.find((e) => e.label === "ARD générés cette année");
  expect(ard?.val).toBe(2_000);
});

test("FORM-001 — amort. inférieur à la limite", () => {
  const r = computeForm001({
    loyers_acquis: 12_000,
    charges_hors_amortissements: 4_000,
    amortissements_comptabilises: 5_000,
  });
  expect(r.resultat).toBe(5_000);
  const ard = r.etapes.find((e) => e.label === "ARD générés cette année");
  expect(ard?.val).toBe(0);
});

test("FORM-001 — limite négative bornée à 0", () => {
  const r = computeForm001({
    loyers_acquis: 3_000,
    charges_hors_amortissements: 5_000,
    amortissements_comptabilises: 10_000,
  });
  expect(r.resultat).toBe(0);
});

test("FORM-001 — imputation ARD antérieur sur exercice bénéficiaire", () => {
  const r = computeForm001({
    loyers_acquis: 12_000,
    charges_hors_amortissements: 4_000,
    amortissements_comptabilises: 5_000,
    ard_anterieur: 4_000,
  });
  const imp = r.etapes.find((e) =>
    e.label.startsWith("Imputation ARD antérieur"),
  );
  expect(imp?.val).toBe(3_000);
  const solde = r.etapes.find((e) => e.label === "Solde ARD à reporter");
  expect(solde?.val).toBe(1_000);
});

// ============================================================
// FORM-002 — Plus-value LMNP 2025
// ============================================================
test("FORM-002 — cas standard détention 11 ans avec réintégration", async () => {
  const r = await computeForm002({
    prix_cession: 320_000,
    prix_acquisition: 220_000,
    amortissements_deduits: 45_000,
    duree_detention_annees: 11,
  });
  expect(r.formule).toBe("FORM-002");
  const pvBrute = r.etapes.find((e) => e.label === "PV brute");
  expect(pvBrute?.val).toBe(95_500);
  const pvIR = r.etapes.find((e) => e.label === "PV nette imposable IR");
  expect(pvIR?.val).toBe(61_120);
});

test("FORM-002 — exo IR à 22 ans", async () => {
  const r = await computeForm002({
    prix_cession: 400_000,
    prix_acquisition: 200_000,
    amortissements_deduits: 50_000,
    duree_detention_annees: 22,
  });
  const pvIR = r.etapes.find((e) => e.label === "PV nette imposable IR");
  expect(pvIR?.val).toBe(0);
  const ir = r.etapes.find((e) => e.label === "IR (19 %)");
  expect(ir?.val).toBe(0);
});

test("FORM-002 — exception résidence étudiant : pas de réintégration", async () => {
  const r = await computeForm002({
    prix_cession: 320_000,
    prix_acquisition: 220_000,
    amortissements_deduits: 45_000,
    duree_detention_annees: 11,
    exception_etudiant: true,
  });
  const pvBrute = r.etapes.find((e) => e.label === "PV brute");
  expect(pvBrute?.val).toBe(50_500);
});

test("FORM-002 — détention ≤ 5 ans : pas de forfait, pas d'abattement", async () => {
  const r = await computeForm002({
    prix_cession: 250_000,
    prix_acquisition: 200_000,
    amortissements_deduits: 20_000,
    duree_detention_annees: 3,
  });
  const pvBrute = r.etapes.find((e) => e.label === "PV brute");
  expect(pvBrute?.val).toBe(70_000);
  const ir = r.etapes.find((e) => e.label === "IR (19 %)");
  expect(ir?.val).toBe(13_300);
});

test("FORM-002 — montants réels priment sur forfaits", async () => {
  const r = await computeForm002({
    prix_cession: 320_000,
    prix_acquisition: 220_000,
    amortissements_deduits: 45_000,
    duree_detention_annees: 11,
    frais_acquisition_reels: 20_000,
    travaux_reels: 40_000,
  });
  // Prix acq majoré = 220k + 20k + 40k = 280k
  // PV brute = 320k - (280k - 45k) = 85k
  const pvBrute = r.etapes.find((e) => e.label === "PV brute");
  expect(pvBrute?.val).toBe(85_000);
});
