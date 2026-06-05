/**
 * Abattements pour durée de détention — plus-values immobilières.
 * CGI Art. 150 VC + Art. 1609 nonies G.
 *
 * IR  : 6 % par an de la 6e à la 21e année, 4 % la 22e → exo à 22 ans (100 %)
 * PS  : 1,65 % de la 6e à la 21e, 1,60 % la 22e,
 *       9,00 % de la 23e à la 30e → exo à 30 ans (100 %)
 *
 * Les TAUX viennent du referentiel (kb-canonical) via getParam ; ce module ne
 * les duplique jamais. Stockes en % numerique (ex. 6 = 6 %) -> fraction /100.
 *
 * Returns a fraction in [0, 1].
 */

import { getParam } from "../../kb/referentiel";

export async function abattementIR(
  annees: number,
  millesime?: number | string,
): Promise<number> {
  const n = Math.max(0, Math.floor(annees));
  if (n <= 5) return 0;
  if (n >= 22) return 1;
  // Years 6 to 21 : `tauxParAn` each ; year 22 (handled by >=22 => 1 above).
  const tauxParAn = (await getParam("pv_immo_abattement_ir_par_an_6e_21e", millesime)) / 100;
  const yearsAtSixPct = Math.min(n, 21) - 5; // 1..16
  return Math.min(1, yearsAtSixPct * tauxParAn);
}

export async function abattementPS(
  annees: number,
  millesime?: number | string,
): Promise<number> {
  const n = Math.max(0, Math.floor(annees));
  if (n <= 5) return 0;
  if (n >= 30) return 1;
  const tauxAn6a21 = (await getParam("pv_immo_abattement_ps_par_an_6e_21e", millesime)) / 100;
  const taux22 = (await getParam("pv_immo_abattement_ps_22e_annee", millesime)) / 100;
  const tauxAn23a30 = (await getParam("pv_immo_abattement_ps_par_an_23e_30e", millesime)) / 100;
  let abat = 0;
  // Years 6 to 21 : tauxAn6a21 each.
  if (n >= 6) abat += Math.min(n - 5, 16) * tauxAn6a21;
  // Year 22 : extra taux22.
  if (n >= 22) abat += taux22;
  // Years 23 to 30 : tauxAn23a30 each.
  if (n >= 23) abat += Math.min(n - 22, 8) * tauxAn23a30;
  return Math.min(1, abat);
}

/**
 * Taxe supplémentaire sur PV immobilière (CGI Art. 1609 nonies G).
 * Applied on PV nette imposable IR (after abattement durée).
 * Exempts PV ≤ seuil (referentiel pv_immo_surtaxe_seuil).
 * Le BAREME par paliers reste en code (decrit en texte dans le referentiel) ;
 * seul le SEUIL d'assujettissement provient du referentiel.
 */
export async function taxeSupplementaire(
  pvNetteIR: number,
  millesime?: number | string,
): Promise<number> {
  const pv = Math.max(0, pvNetteIR);
  const seuil = await getParam("pv_immo_surtaxe_seuil", millesime);
  if (pv <= seuil) return 0;
  if (pv <= 60_000) return 0.02 * pv - (60_000 - pv) * (1 / 20);
  if (pv <= 100_000) return 0.02 * pv;
  if (pv <= 110_000) return 0.03 * pv - (110_000 - pv) * (1 / 10);
  if (pv <= 150_000) return 0.03 * pv;
  if (pv <= 160_000) return 0.04 * pv - (160_000 - pv) * (15 / 100);
  if (pv <= 200_000) return 0.04 * pv;
  if (pv <= 210_000) return 0.05 * pv - (210_000 - pv) * (20 / 100);
  if (pv <= 250_000) return 0.05 * pv;
  if (pv <= 260_000) return 0.06 * pv - (260_000 - pv) * (25 / 100);
  return 0.06 * pv;
}

/** Round to 2 decimals (centimes). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
