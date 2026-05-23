/**
 * FORM-001 — Amortissement art. 39-C (LMNP).
 *
 * Règle: Amortissement déductible = MAX(0 ; Loyers acquis − Charges hors amort).
 * ARD (Amortissements Régulièrement Différés) = Amort comptabilisés − Amort déductibles
 * Solde ARD N = Solde N-1 + ARD N − Imputations N
 *
 * Exceptions:
 *   - Vente LMNP : ARD définitivement perdus
 *   - Vente LMP  : ARD majorent la VNC
 *
 * Source: Guide fiscal LM ARCOLIB 2025, §§ 3420-3432.
 */

import type { CalculatorResult } from "../../types";
import { round2 } from "./abattements";

export interface Form001Params {
  loyers_acquis: number;
  charges_hors_amortissements: number;
  amortissements_comptabilises: number;
  ard_anterieur?: number;
}

const VERSION = "1.0";

export function computeForm001(p: Form001Params): CalculatorResult {
  const limite = Math.max(0, p.loyers_acquis - p.charges_hors_amortissements);
  const amortDeductible = Math.min(
    Math.max(0, p.amortissements_comptabilises),
    limite,
  );
  const ardCourant = Math.max(0, p.amortissements_comptabilises - amortDeductible);
  const ardAnterieur = Math.max(0, p.ard_anterieur ?? 0);

  // Imputation : possible si exercice bénéficiaire (limite > amort_deductible déjà utilisée)
  const margeDispoImputation = Math.max(0, limite - amortDeductible);
  const imputationArdAnterieur = Math.min(ardAnterieur, margeDispoImputation);
  const soldeArdApres = ardAnterieur + ardCourant - imputationArdAnterieur;

  const etapes: CalculatorResult["etapes"] = [
    { label: "Loyers acquis", val: round2(p.loyers_acquis) },
    {
      label: "Charges hors amortissements",
      val: round2(p.charges_hors_amortissements),
      note: "À déduire des loyers pour borner l'amortissement déductible",
    },
    {
      label: "Limite art. 39-C (max amort déductible)",
      val: round2(limite),
      note: "MAX(0 ; Loyers − Charges hors amort)",
    },
    {
      label: "Amortissements comptabilisés",
      val: round2(p.amortissements_comptabilises),
    },
    {
      label: "Amortissement déductible cette année",
      val: round2(amortDeductible),
    },
    {
      label: "ARD générés cette année",
      val: round2(ardCourant),
      note: "Excédent d'amort. comptabilisé non déductible",
    },
    {
      label: "ARD antérieur (solde)",
      val: round2(ardAnterieur),
    },
    {
      label: "Imputation ARD antérieur sur exercice bénéficiaire",
      val: round2(imputationArdAnterieur),
    },
    {
      label: "Solde ARD à reporter",
      val: round2(soldeArdApres),
      note: "Perdu si LMNP, intégré à la VNC si LMP, à la sortie",
    },
  ];

  return {
    formule: "FORM-001",
    version: VERSION,
    resultat: round2(amortDeductible),
    unite: "EUR",
    etapes,
    parametres: {
      loyers_acquis: p.loyers_acquis,
      charges_hors_amortissements: p.charges_hors_amortissements,
      amortissements_comptabilises: p.amortissements_comptabilises,
      ard_anterieur: p.ard_anterieur ?? 0,
    },
    source: "Guide fiscal LM ARCOLIB 2025, §§ 3420-3432",
  };
}
