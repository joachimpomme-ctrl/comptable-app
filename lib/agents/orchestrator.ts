/**
 * AGENT-1 — Orchestrator.
 * Classifies the user query in <1s using Gemini Flash + JSON response mode.
 * Decides which downstream agents to invoke (Gem only / Gem+Calc / +Reviewer).
 */

import { Type } from "@google/genai";
import { z } from "zod";

import { getGenai } from "../gemini-client";
import { env } from "../env";
import type { OrchestratorOutput } from "../types";

const SYSTEM_INSTRUCTION = `Tu es l'orchestrateur d'un pipeline multi-agents comptable, fiscal et patrimonial.
Ta seule mission : analyser la requête utilisateur et émettre une classification structurée, en JSON strict.
Tu ne réponds pas à la question. Tu ne donnes pas de conseil. Tu classifies, c'est tout.

Champs à remplir :
- domaine : domaine métier principal de la question
- criticite : impact financier ou juridique de l'erreur
- besoin_calcul : true si la réponse nécessite des calculs numériques (PV, amortissement, IFI, droits)
- irreversible : true si la question porte sur une décision difficilement réversible (option IS SCI, démembrement, donation-partage, structuration SEL/SPFPL, passage micro/réel, PER sans déduction, renonciation succession, clause AV complexe)
- profondeur : niveau de détail attendu — SIMPLE pour un seuil ou un taux ; STANDARD pour un cas appliqué ; APPROFONDI pour une analyse stratégique
- raison_courte : 1 phrase justifiant la classification (≤ 120 caractères)`;

const Schema = z.object({
  domaine: z.enum([
    "LMNP",
    "BNC",
    "BIC",
    "FONCIER",
    "IFI",
    "SUCCESSION",
    "EPARGNE",
    "AUTRE",
  ]),
  criticite: z.enum(["FAIBLE", "MOYENNE", "ELEVEE"]),
  besoin_calcul: z.boolean(),
  irreversible: z.boolean(),
  profondeur: z.enum(["SIMPLE", "STANDARD", "APPROFONDI"]),
  raison_courte: z.string().min(1).max(160),
});

/**
 * Response schema for Gemini structured output.
 * We use the @google/genai Schema format with explicit Type enums.
 */
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    domaine: {
      type: Type.STRING,
      enum: ["LMNP", "BNC", "BIC", "FONCIER", "IFI", "SUCCESSION", "EPARGNE", "AUTRE"],
    },
    criticite: {
      type: Type.STRING,
      enum: ["FAIBLE", "MOYENNE", "ELEVEE"],
    },
    besoin_calcul: { type: Type.BOOLEAN },
    irreversible: { type: Type.BOOLEAN },
    profondeur: {
      type: Type.STRING,
      enum: ["SIMPLE", "STANDARD", "APPROFONDI"],
    },
    raison_courte: { type: Type.STRING },
  },
  required: [
    "domaine",
    "criticite",
    "besoin_calcul",
    "irreversible",
    "profondeur",
    "raison_courte",
  ],
  propertyOrdering: [
    "domaine",
    "criticite",
    "besoin_calcul",
    "irreversible",
    "profondeur",
    "raison_courte",
  ],
};

export async function orchestrate(
  question: string,
): Promise<OrchestratorOutput> {
  const result = await getGenai().models.generateContent({
    model: env.GEMINI_MODEL_FAST,
    contents: `QUESTION UTILISATEUR :\n${question}`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.0,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const text = result.text ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `Orchestrator returned non-JSON output: ${text.slice(0, 200)}`,
    );
  }

  return Schema.parse(parsed);
}
