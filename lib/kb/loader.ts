/**
 * KB loader — reads the 10 files of the Gemini Gem KB from disk.
 * Files are located at ../../PARTAGE/knowledge/ (relative to repo root).
 *
 * Implementation lands in task #2 (Cloner le Gem en API).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

/** Files to inject into the Gem's context cache, in priority order. */
export const KB_FILES = [
  "01_decision_engine.md",
  "02_golden_rules_claude_first.md",
  "03_few_shots.md",
  "04_formules_et_risques.md",
  "05_agent_governance.md",
  "06_golden_checklists.md",
  "07_rule_source_crosswalk.jsonl",
  "08_evaluation_suite.md",
  "09_agent_manifest.json",
  "M_CGI_code_general_impots.md",
] as const;

export type KbFileName = (typeof KB_FILES)[number];

/**
 * KB lives in the app at ./kb/knowledge — populated by scripts/sync-kb.mjs
 * (sources live in ../../PARTAGE/knowledge/). Bundling locally means the
 * Vercel build doesn't depend on the parent Drive folder.
 */
const KB_DIR = path.resolve(process.cwd(), "kb", "knowledge");

export interface KbFile {
  name: KbFileName;
  content: string;
  size: number;
}

let cached: KbFile[] | null = null;

export async function loadKb(): Promise<KbFile[]> {
  if (cached) return cached;
  const files = await Promise.all(
    KB_FILES.map(async (name) => {
      const full = path.join(KB_DIR, name);
      const content = await readFile(full, "utf8");
      return { name, content, size: content.length };
    }),
  );
  cached = files;
  return files;
}

export function kbTotalSize(files: KbFile[]): number {
  return files.reduce((sum, f) => sum + f.size, 0);
}
