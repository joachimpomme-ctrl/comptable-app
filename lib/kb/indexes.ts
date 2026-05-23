/**
 * Lookup indexes built once from JSONL sources.
 * Powers the Quality Gate's deterministic citation checks.
 *
 *   - cgiIndex : Set of valid CGI article references (e.g. "CGI Art. 39 C")
 *   - kbIdIndex : Set of valid KB rule IDs (bnc_001, lm_023, gfpl_XXX…)
 */

import path from "node:path";
import { readFile } from "node:fs/promises";

const KB_BASE = path.resolve(process.cwd(), "kb", "knowledge");

const M_CGI_JSONL = path.join(KB_BASE, "M_CGI_code_general_impots.jsonl");
const CROSSWALK_JSONL = path.join(KB_BASE, "07_rule_source_crosswalk.jsonl");

interface Indexes {
  cgi: Set<string>; // canonical e.g. "CGI Art. 39 C"
  cgiStatuses: Map<string, string>; // article -> statut
  kbIds: Set<string>; // bnc_001, lm_023…
}

let cached: Indexes | null = null;

/** Normalize a CGI citation for canonical lookup. */
export function normalizeCgi(raw: string): string {
  // Examples to normalize: "CGI Art. 14", "CGI art.14", "CGI Art 39-C", "CGI Art 39 C"
  return raw
    .replace(/\s+/g, " ")
    .replace(/[Aa]rt\.?/g, "Art.")
    .replace(/CGI\s*Art\./, "CGI Art.")
    .replace(/Art\.\s*(\d+)\s*-\s*([A-Z])/g, "Art. $1 $2") // "39-C" -> "39 C"
    .trim();
}

async function readJsonlEntries(file: string): Promise<unknown[]> {
  const buf = await readFile(file, "utf8");
  return buf
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l) as unknown;
      } catch {
        return null;
      }
    })
    .filter((x): x is unknown => x !== null);
}

export async function getIndexes(): Promise<Indexes> {
  if (cached) return cached;

  const [cgiEntries, crosswalkEntries] = await Promise.all([
    readJsonlEntries(M_CGI_JSONL),
    readJsonlEntries(CROSSWALK_JSONL),
  ]);

  const cgi = new Set<string>();
  const cgiStatuses = new Map<string, string>();
  for (const e of cgiEntries) {
    if (typeof e !== "object" || e === null) continue;
    const obj = e as { article?: string; statut?: string };
    if (typeof obj.article === "string") {
      const norm = normalizeCgi(obj.article);
      cgi.add(norm);
      if (typeof obj.statut === "string") cgiStatuses.set(norm, obj.statut);
    }
  }

  const kbIds = new Set<string>();
  for (const e of crosswalkEntries) {
    if (typeof e !== "object" || e === null) continue;
    const obj = e as { source_rule_id?: string };
    if (typeof obj.source_rule_id === "string") {
      kbIds.add(obj.source_rule_id.toLowerCase());
    }
  }

  cached = { cgi, cgiStatuses, kbIds };
  return cached;
}

/** Test helper — drop the cache so the next call re-reads from disk. */
export function _resetIndexCacheForTests(): void {
  cached = null;
}
