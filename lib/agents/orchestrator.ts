/**
 * AGENT-1 — Orchestrator.
 * Classifies the user query in <1s.
 * Provider chosen via AGENT_ORCH_PROVIDER (default: gemini).
 */

import { Type } from "@google/genai";
import { z } from "zod";

import { callJson, resolveAgentProvider } from "../llm/json-call";
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

const PROPS = {
  domaine: { enum: ["LMNP", "BNC", "BIC", "FONCIER", "IFI", "SUCCESSION", "EPARGNE", "AUTRE"] },
  criticite: { enum: ["FAIBLE", "MOYENNE", "ELEVEE"] },
  besoin_calcul: { type: "boolean" },
  irreversible: { type: "boolean" },
  profondeur: { enum: ["SIMPLE", "STANDARD", "APPROFONDI"] },
  raison_courte: { type: "string" },
};

const REQUIRED = [
  "domaine",
  "criticite",
  "besoin_calcul",
  "irreversible",
  "profondeur",
  "raison_courte",
];

const GEMINI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    domaine: { type: Type.STRING, enum: PROPS.domaine.enum },
    criticite: { type: Type.STRING, enum: PROPS.criticite.enum },
    besoin_calcul: { type: Type.BOOLEAN },
    irreversible: { type: Type.BOOLEAN },
    profondeur: { type: Type.STRING, enum: PROPS.profondeur.enum },
    raison_courte: { type: Type.STRING },
  },
  required: REQUIRED,
  propertyOrdering: REQUIRED,
};

const ANTHROPIC_SCHEMA = {
  type: "object",
  properties: {
    domaine: { type: "string", enum: PROPS.domaine.enum },
    criticite: { type: "string", enum: PROPS.criticite.enum },
    besoin_calcul: { type: "boolean" },
    irreversible: { type: "boolean" },
    profondeur: { type: "string", enum: PROPS.profondeur.enum },
    raison_courte: { type: "string" },
  },
  required: REQUIRED,
};

export async function orchestrate(
  question: string,
): Promise<OrchestratorOutput> {
  const { provider, model } = resolveAgentProvider({
    envProvider: env.AGENT_ORCH_PROVIDER,
    envModel: env.AGENT_ORCH_MODEL,
    defaultGeminiModel: env.GEMINI_MODEL_FAST,
    defaultClaudeModel: env.CLAUDE_MODEL_HAIKU,
  });

  const { data } = await callJson({
    provider,
    model,
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt: `QUESTION UTILISATEUR :\n${question}`,
    zodSchema: Schema,
    geminiSchema: GEMINI_SCHEMA,
    anthropicSchema: ANTHROPIC_SCHEMA,
  });

  return { ...data, _meta: { provider, model } };
}
