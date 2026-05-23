/**
 * Param extractor — turns a free-form LMNP question into structured
 * Form002Params so the Calculator can run.
 * Used only when orchestrator says { domaine: "LMNP", besoin_calcul: true }.
 *
 * Returns null if the question doesn't contain enough info (the calculator
 * is then skipped — the Gem still answers).
 */

import { Type } from "@google/genai";
import { z } from "zod";
import { getGenai } from "../gemini-client";
import { env } from "../env";
import type { Form002Params } from "./calculator/form-002";

const SYSTEM_INSTRUCTION = `Tu es un extracteur de paramètres pour le calcul de plus-value LMNP (FORM-002).
Tu reçois la question d'un utilisateur. Tu retournes en JSON strict les paramètres nécessaires.
Si une donnée est ABSENTE de la question, mets null.
N'invente JAMAIS un montant. Les ratios ou pourcentages dans la question doivent être convertis en euros si possible, sinon null.`;

const Schema = z.object({
  prix_cession: z.number().nullable(),
  prix_acquisition: z.number().nullable(),
  amortissements_deduits: z.number().nullable(),
  duree_detention_annees: z.number().nullable(),
  frais_acquisition_reels: z.number().nullable(),
  travaux_reels: z.number().nullable(),
  exception_etudiant: z.boolean().nullable(),
});

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    prix_cession: { type: Type.NUMBER, nullable: true },
    prix_acquisition: { type: Type.NUMBER, nullable: true },
    amortissements_deduits: { type: Type.NUMBER, nullable: true },
    duree_detention_annees: { type: Type.NUMBER, nullable: true },
    frais_acquisition_reels: { type: Type.NUMBER, nullable: true },
    travaux_reels: { type: Type.NUMBER, nullable: true },
    exception_etudiant: { type: Type.BOOLEAN, nullable: true },
  },
  required: [
    "prix_cession",
    "prix_acquisition",
    "amortissements_deduits",
    "duree_detention_annees",
    "frais_acquisition_reels",
    "travaux_reels",
    "exception_etudiant",
  ],
  propertyOrdering: [
    "prix_cession",
    "prix_acquisition",
    "amortissements_deduits",
    "duree_detention_annees",
    "frais_acquisition_reels",
    "travaux_reels",
    "exception_etudiant",
  ],
};

/** Returns Form002Params or null if mandatory fields are missing. */
export async function extractForm002Params(
  question: string,
): Promise<Form002Params | null> {
  const result = await getGenai().models.generateContent({
    model: env.GEMINI_MODEL_FAST,
    contents: `Question : ${question}`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.0,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const text = result.text ?? "";
  let parsed: z.infer<typeof Schema>;
  try {
    parsed = Schema.parse(JSON.parse(text));
  } catch {
    return null;
  }

  // Mandatory: cession, acquisition, amort, durée
  if (
    parsed.prix_cession === null ||
    parsed.prix_acquisition === null ||
    parsed.amortissements_deduits === null ||
    parsed.duree_detention_annees === null
  ) {
    return null;
  }

  return {
    prix_cession: parsed.prix_cession,
    prix_acquisition: parsed.prix_acquisition,
    amortissements_deduits: parsed.amortissements_deduits,
    duree_detention_annees: parsed.duree_detention_annees,
    frais_acquisition_reels: parsed.frais_acquisition_reels ?? undefined,
    travaux_reels: parsed.travaux_reels ?? undefined,
    exception_etudiant: parsed.exception_etudiant ?? undefined,
  };
}
