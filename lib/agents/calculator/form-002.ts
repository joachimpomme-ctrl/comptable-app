/**
 * FORM-002 — Plus-value LMNP depuis 2025.
 *
 * Changement majeur 2025 : les amortissements déduits sont RÉINTÉGRÉS dans
 * la PV brute (CGI Art. 150 VB modifié par LF 2025).
 *
 *   PV brute      = Prix cession − (Prix acquisition majoré − Amort déduits)
 *   PV nette IR   = PV brute × (1 − abattement durée IR)
 *   PV nette PS   = PV brute × (1 − abattement durée PS)
 *   IR            = PV nette IR × 19 %
 *   PS            = PV nette PS × 17,2 %
 *   Taxe sup.     = barème CGI 1609 nonies G sur PV nette IR
 *
 * Prix acquisition majoré :
 *   + frais d'acquisition réels OU forfait 7,5 % si détention > 5 ans
 *   + travaux réels OU forfait 15 % si détention > 5 ans
 *
 * Exceptions : résidences étudiantes / apprentissage → ancienne formule.
 *
 * Source: Guide fiscal LM ARCOLIB 2025, §§ 6211-6213 ; CGI Art. 150 U, 150 VB.
 */

import type { CalculatorResult } from "../../types";
import {
  abattementIR,
  abattementPS,
  taxeSupplementaire,
  round2,
} from "./abattements";

export interface Form002Params {
  prix_cession: number;
  prix_acquisition: number;
  amortissements_deduits: number;
  duree_detention_annees: number;
  frais_acquisition_reels?: number;
  travaux_reels?: number;
  exception_etudiant?: boolean;
}

const VERSION = "1.0";
const TAUX_IR = 0.19;
const TAUX_PS = 0.172;

export function computeForm002(p: Form002Params): CalculatorResult {
  const duree = Math.max(0, p.duree_detention_annees);
  const longueDetention = duree > 5;

  const fraisAcquisition =
    p.frais_acquisition_reels !== undefined
      ? p.frais_acquisition_reels
      : longueDetention
        ? p.prix_acquisition * 0.075
        : 0;

  const travaux =
    p.travaux_reels !== undefined
      ? p.travaux_reels
      : longueDetention
        ? p.prix_acquisition * 0.15
        : 0;

  const prixAcquisitionMajore =
    p.prix_acquisition + fraisAcquisition + travaux;

  // Réintégration des amortissements (sauf exception étudiant/apprentissage)
  const amortReintegres = p.exception_etudiant ? 0 : p.amortissements_deduits;
  const pvBrute = Math.max(
    0,
    p.prix_cession - (prixAcquisitionMajore - amortReintegres),
  );

  const abatIR = abattementIR(duree);
  const abatPS = abattementPS(duree);

  const pvNetteIR = pvBrute * (1 - abatIR);
  const pvNettePS = pvBrute * (1 - abatPS);

  const ir = pvNetteIR * TAUX_IR;
  const ps = pvNettePS * TAUX_PS;
  const taxeSup = taxeSupplementaire(pvNetteIR);

  const totalImposition = ir + ps + taxeSup;

  const etapes: CalculatorResult["etapes"] = [
    { label: "Prix de cession", val: round2(p.prix_cession) },
    { label: "Prix d'acquisition", val: round2(p.prix_acquisition) },
    {
      label: "Frais d'acquisition retenus",
      val: round2(fraisAcquisition),
      note:
        p.frais_acquisition_reels !== undefined
          ? "Montant réel fourni"
          : longueDetention
            ? "Forfait 7,5 % (détention > 5 ans)"
            : "Aucun (détention ≤ 5 ans)",
    },
    {
      label: "Travaux retenus",
      val: round2(travaux),
      note:
        p.travaux_reels !== undefined
          ? "Montant réel fourni"
          : longueDetention
            ? "Forfait 15 % (détention > 5 ans)"
            : "Aucun (détention ≤ 5 ans)",
    },
    {
      label: "Prix d'acquisition majoré",
      val: round2(prixAcquisitionMajore),
    },
    {
      label: "Amortissements à réintégrer",
      val: round2(amortReintegres),
      note: p.exception_etudiant
        ? "0 — exception résidence étudiant/apprentissage"
        : "Réintégration depuis 2025 (LF 2025)",
    },
    {
      label: "PV brute",
      val: round2(pvBrute),
      note: "Prix cession − (Prix acq. majoré − Amort réintégrés)",
    },
    {
      label: `Abattement durée IR (${duree} ans)`,
      val: round2(abatIR),
      note: `${(abatIR * 100).toFixed(2)} %`,
    },
    {
      label: `Abattement durée PS (${duree} ans)`,
      val: round2(abatPS),
      note: `${(abatPS * 100).toFixed(2)} %`,
    },
    { label: "PV nette imposable IR", val: round2(pvNetteIR) },
    { label: "PV nette imposable PS", val: round2(pvNettePS) },
    { label: "IR (19 %)", val: round2(ir) },
    { label: "PS (17,2 %)", val: round2(ps) },
    {
      label: "Taxe supplémentaire",
      val: round2(taxeSup),
      note: pvNetteIR > 50_000 ? "Barème CGI 1609 nonies G" : "Non due (< 50 000 €)",
    },
    {
      label: "TOTAL imposition",
      val: round2(totalImposition),
      note: "IR + PS + taxe sup.",
    },
  ];

  return {
    formule: "FORM-002",
    version: VERSION,
    resultat: round2(totalImposition),
    unite: "EUR",
    etapes,
    parametres: {
      prix_cession: p.prix_cession,
      prix_acquisition: p.prix_acquisition,
      amortissements_deduits: p.amortissements_deduits,
      duree_detention_annees: p.duree_detention_annees,
      frais_acquisition_reels: p.frais_acquisition_reels ?? 0,
      travaux_reels: p.travaux_reels ?? 0,
      exception_etudiant: p.exception_etudiant ? 1 : 0,
    },
    source:
      "Guide fiscal LM ARCOLIB 2025, §§ 6211-6213 ; CGI Art. 150 U, 150 VB",
  };
}
