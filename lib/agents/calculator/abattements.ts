/**
 * Abattements pour durée de détention — plus-values immobilières.
 * CGI Art. 150 VC + Art. 1600-0 G.
 *
 * IR  : 6 % par an de la 6e à la 21e année, 4 % la 22e → exo à 22 ans (100 %)
 * PS  : 1,65 % de la 6e à la 21e, 1,60 % la 22e,
 *       9,00 % de la 23e à la 30e → exo à 30 ans (100 %)
 *
 * Returns a fraction in [0, 1].
 */
export function abattementIR(annees: number): number {
  const n = Math.max(0, Math.floor(annees));
  if (n <= 5) return 0;
  if (n >= 22) return 1;
  // Years 6 to 21 : 6 % each ; year 22 : extra 4 %.
  const yearsAtSixPct = Math.min(n, 21) - 5; // 1..16
  return Math.min(1, yearsAtSixPct * 0.06);
}

export function abattementPS(annees: number): number {
  const n = Math.max(0, Math.floor(annees));
  if (n <= 5) return 0;
  if (n >= 30) return 1;
  let abat = 0;
  // Years 6 to 21 : 1.65 % each.
  if (n >= 6) abat += Math.min(n - 5, 16) * 0.0165;
  // Year 22 : extra 1.60 %.
  if (n >= 22) abat += 0.016;
  // Years 23 to 30 : 9 % each.
  if (n >= 23) abat += Math.min(n - 22, 8) * 0.09;
  return Math.min(1, abat);
}

/**
 * Taxe supplémentaire sur PV immobilière (CGI Art. 1609 nonies G).
 * Applied on PV nette imposable IR (after abattement durée).
 * Exempts PV ≤ 50 000 €.
 */
export function taxeSupplementaire(pvNetteIR: number): number {
  const pv = Math.max(0, pvNetteIR);
  if (pv <= 50_000) return 0;
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
