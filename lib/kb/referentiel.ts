/**
 * Referentiel des parametres fiscaux — SOURCE DE VERITE UNIQUE cote code.
 *
 * Lit kb-canonical/referentiel_parametres.json (copie dans ./kb/referentiel/
 * par scripts/sync-kb.mjs, pour ne pas dependre du dossier Drive parent au
 * runtime). Aucun chiffre fiscal ne doit etre ecrit en dur ailleurs dans le
 * code : tout passe par getParam(cle, millesime).
 *
 * Regle (CLAUDE.md) : la valeur appartient au referentiel. Ce module la LIT,
 * il ne la duplique jamais. Ajouter une cle = role de l'agent
 * architecte-referentiel (editer kb-canonical/referentiel_parametres.json).
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export interface ParamEntry {
  libelle: string;
  alias?: string[];
  unite: string;
  valeurs: Record<string, number>; // millesime (YYYY) -> valeur
  source: string;
  source_url?: string;
  verifie_le?: string;
  valable_jusqu_au?: string;
  statut: "sourced" | "candidate_to_validate" | "a_verifier" | string;
  note?: string;
}

export interface Referentiel {
  millesime_courant: number;
  schema_version: number;
  parametres: Record<string, ParamEntry>;
  comptages_attendus?: Record<string, unknown>;
}

/**
 * Emplacements possibles, dans l'ordre de priorite :
 *  1. ./kb/referentiel/referentiel_parametres.json   (copie sync-kb, runtime/Vercel)
 *  2. ../../kb-canonical/referentiel_parametres.json  (source, dev local)
 */
function candidatePaths(): string[] {
  const cwd = process.cwd();
  return [
    path.resolve(cwd, "kb", "referentiel", "referentiel_parametres.json"),
    path.resolve(cwd, "..", "..", "kb-canonical", "referentiel_parametres.json"),
  ];
}

let cached: Referentiel | null = null;

export async function loadReferentiel(): Promise<Referentiel> {
  if (cached) return cached;
  const tried: string[] = [];
  for (const p of candidatePaths()) {
    tried.push(p);
    if (existsSync(p)) {
      const raw = await readFile(p, "utf8");
      cached = JSON.parse(raw) as Referentiel;
      return cached;
    }
  }
  throw new Error(
    `[referentiel] referentiel_parametres.json introuvable. Cherche : ${tried.join(
      " ; ",
    )}. Lance \`npm run sync-kb\`.`,
  );
}

/** Millesime courant declare par le referentiel (ex: 2026). */
export async function millesimeCourant(): Promise<number> {
  return (await loadReferentiel()).millesime_courant;
}

export class ParamNotFoundError extends Error {}

/**
 * Valeur d'un parametre fiscal pour un millesime donne.
 * @param cle        cle du referentiel (ex: "PASS", "seuil_micro_bnc")
 * @param millesime  annee (number ou string). Defaut = millesime_courant.
 * @throws ParamNotFoundError si la cle ou le millesime est absent.
 */
export async function getParam(
  cle: string,
  millesime?: number | string,
): Promise<number> {
  const ref = await loadReferentiel();
  const entry = ref.parametres[cle];
  if (!entry) {
    throw new ParamNotFoundError(
      `[referentiel] cle inconnue : "${cle}". Cles dispo : ${Object.keys(
        ref.parametres,
      ).join(", ")}`,
    );
  }
  const mil = String(millesime ?? ref.millesime_courant);
  const val = entry.valeurs[mil];
  if (val === undefined) {
    throw new ParamNotFoundError(
      `[referentiel] millesime ${mil} absent pour "${cle}". Dispo : ${Object.keys(
        entry.valeurs,
      ).join(", ")}`,
    );
  }
  return val;
}

/** Acces a l'entree complete (libelle, source, statut...) pour tracabilite. */
export async function getParamEntry(cle: string): Promise<ParamEntry> {
  const ref = await loadReferentiel();
  const entry = ref.parametres[cle];
  if (!entry) {
    throw new ParamNotFoundError(`[referentiel] cle inconnue : "${cle}"`);
  }
  return entry;
}

/** Reset du cache (tests). */
export function _resetReferentielCache(): void {
  cached = null;
}
