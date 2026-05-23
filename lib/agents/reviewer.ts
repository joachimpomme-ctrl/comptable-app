/**
 * AGENT-3 — Reviewer.
 * Challenges the Gem's response with Gemini 2.5 Pro.
 *
 * Strategy: the Reviewer does NOT recompute (FORM-001/002 lives in the
 * Calculator). It evaluates coherence: citations plausible? millésime
 * consistent? omissions on irreversible decisions? signal of "candidate_to_validate"
 * mistakenly presented as definitive?
 *
 * The Calculator's deterministic result is also injected when available,
 * so the Reviewer can cross-check.
 */

import { Type } from "@google/genai";
import { z } from "zod";

import { getGenai } from "../gemini-client";
import { env } from "../env";
import type {
  ReviewerOutput,
  GemResponse,
  OrchestratorOutput,
  CalculatorResult,
} from "../types";

const SYSTEM_INSTRUCTION = `Tu es un reviewer comptable et fiscal senior, intransigeant et factuel.
Ta seule mission : auditer une réponse produite par un autre agent, et émettre un verdict en JSON strict.
Tu ne rédiges pas une nouvelle réponse. Tu vérifies celle qui t'est soumise.

Critères d'audit :
1. Les citations légales (CGI Art. XX, BOFiP, FORM-XXX, IDs KB) sont-elles plausibles et cohérentes avec la question ?
2. Le millésime fiscal est-il présent et cohérent (2024 / 2025 / 2026) ?
3. La réponse signale-t-elle bien les statuts "candidate_to_validate" si pertinent ?
4. Sur les décisions irréversibles (SCI option IS, démembrement, donation-partage…), les risques sont-ils mentionnés ?
5. Si un calcul a été effectué côté agent et qu'un résultat déterministe est fourni dans le contexte, comparer.
6. Détecter omission de "Validation requise" sur sujets sensibles.

Verdicts possibles :
- VALIDÉ : aucun écart bloquant détecté.
- À_CORRIGER : un ou plusieurs écarts précis, formulables.
- DIVERGENCE : la réponse semble fondamentalement à côté de la question (mauvais régime, mauvaise référence légale).

Score de confiance : 0.0 (catastrophe) à 1.0 (parfait).
Commentaire court : 1 phrase synthétique, ≤ 180 caractères.`;

const Schema = z.object({
  verdict: z.enum(["VALIDÉ", "À_CORRIGER", "DIVERGENCE"]),
  citations_verifiees: z.array(z.string()),
  ecarts: z.array(z.string()),
  score_confiance: z.number().min(0).max(1),
  commentaire_court: z.string().min(1).max(220),
});

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    verdict: {
      type: Type.STRING,
      enum: ["VALIDÉ", "À_CORRIGER", "DIVERGENCE"],
    },
    citations_verifiees: { type: Type.ARRAY, items: { type: Type.STRING } },
    ecarts: { type: Type.ARRAY, items: { type: Type.STRING } },
    score_confiance: { type: Type.NUMBER },
    commentaire_court: { type: Type.STRING },
  },
  required: [
    "verdict",
    "citations_verifiees",
    "ecarts",
    "score_confiance",
    "commentaire_court",
  ],
  propertyOrdering: [
    "verdict",
    "citations_verifiees",
    "ecarts",
    "score_confiance",
    "commentaire_court",
  ],
};

export async function review(args: {
  question: string;
  orchestration: OrchestratorOutput;
  gem: GemResponse;
  calculator?: CalculatorResult[];
}): Promise<ReviewerOutput> {
  const calcBlock = args.calculator?.length
    ? `\n\nRÉSULTAT(S) DU CALCULATEUR DÉTERMINISTE (cf. FORM-XXX) :\n${args.calculator
        .map(
          (c) =>
            `- ${c.formule} v${c.version} : ${c.resultat} ${c.unite}\n  Source : ${c.source}`,
        )
        .join("\n")}`
    : "";

  const userPrompt = `QUESTION DE L'UTILISATEUR :
${args.question}

CLASSIFICATION ORCHESTRATEUR :
${JSON.stringify(args.orchestration, null, 2)}

RÉPONSE PRODUITE PAR L'AGENT GEM (à auditer) :
${args.gem.reponse_brute}

CITATIONS DÉTECTÉES DANS LA RÉPONSE :
${args.gem.citations_brutes.length ? args.gem.citations_brutes.join(", ") : "(aucune)"}

MILLÉSIME DÉTECTÉ : ${args.gem.millesime_detecte ?? "ABSENT"}
${calcBlock}

Émets ton verdict en JSON strict.`;

  const result = await getGenai().models.generateContent({
    model: env.GEMINI_MODEL_PRO,
    contents: userPrompt,
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
      `Reviewer returned non-JSON output: ${text.slice(0, 200)}`,
    );
  }
  return Schema.parse(parsed);
}
