#!/usr/bin/env node
/**
 * Sync KB files from the source-of-truth folders into App/comptable-app/kb/
 * so the deployed app no longer depends on a parent-directory path.
 *
 * Runs:
 *   - automatically before `next build` (prebuild script)
 *   - manually via `npm run sync-kb`
 *
 * Sources (must exist when running locally):
 *   ../../PARTAGE/knowledge/                    — 10 KB files
 *   ../../PARTAGE/knowledge/chatgpt_only/       — M_CGI .jsonl
 *   ../../PARTAGE/gemini/                       — system instruction
 *
 * Targets (committed to the repo):
 *   ./kb/knowledge/        — copies of the 10 KB files + M_CGI.jsonl
 *   ./kb/system/           — system instruction
 *
 * If sources are missing (e.g. on Vercel build), the script noops and assumes
 * kb/ is already populated from the last sync committed.
 */

import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_DIR = path.resolve(__dirname, "..");
const SRC_ROOT = path.resolve(APP_DIR, "..", "..", "PARTAGE");

const KB_TARGET = path.join(APP_DIR, "kb", "knowledge");
const SYS_TARGET = path.join(APP_DIR, "kb", "system");

const KB_FILES = [
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
];

const EXTRA_FILES = [
  // (sourceRelative, targetRelative)
  ["knowledge/chatgpt_only/M_CGI_code_general_impots.jsonl", "M_CGI_code_general_impots.jsonl"],
];

const SYS_FILE = "gemini/00_INSTRUCTIONS_GEMINI.md";

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function copyOne(src, dst) {
  await ensureDir(path.dirname(dst));
  await cp(src, dst);
}

async function main() {
  if (!existsSync(SRC_ROOT)) {
    console.log(`[sync-kb] source root not found (${SRC_ROOT}) — assuming kb/ already populated. Skipping.`);
    return;
  }

  let copied = 0;
  let skipped = 0;

  await ensureDir(KB_TARGET);
  await ensureDir(SYS_TARGET);

  for (const f of KB_FILES) {
    const src = path.join(SRC_ROOT, "knowledge", f);
    if (!existsSync(src)) {
      console.warn(`[sync-kb] missing source: ${src}`);
      skipped++;
      continue;
    }
    await copyOne(src, path.join(KB_TARGET, f));
    copied++;
  }

  for (const [srcRel, dstRel] of EXTRA_FILES) {
    const src = path.join(SRC_ROOT, srcRel);
    if (!existsSync(src)) {
      console.warn(`[sync-kb] missing source: ${src}`);
      skipped++;
      continue;
    }
    await copyOne(src, path.join(KB_TARGET, dstRel));
    copied++;
  }

  const sysSrc = path.join(SRC_ROOT, SYS_FILE);
  if (existsSync(sysSrc)) {
    await copyOne(sysSrc, path.join(SYS_TARGET, "00_INSTRUCTIONS_GEMINI.md"));
    copied++;
  } else {
    console.warn(`[sync-kb] missing system instruction: ${sysSrc}`);
    skipped++;
  }

  // Quick sanity log
  const present = await readdir(KB_TARGET);
  console.log(`[sync-kb] copied=${copied} skipped=${skipped} present=${present.length}`);
}

main().catch((err) => {
  console.error("[sync-kb] failed:", err);
  process.exit(1);
});
