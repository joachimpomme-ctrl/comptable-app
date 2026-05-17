/**
 * scripts/build-knowledge.ts
 *
 * Clones (or refreshes) the upstream `comptable` repository and assembles
 * the 8 markdown knowledge files into a single `knowledge/bundle.json`
 * with a sha256 hash. The bundle is then loaded by:
 *   - the POC script (poc-claude-corpus.ts)
 *   - the Next.js server (Phase 1+) to populate Claude's system prompt
 *
 * Usage:
 *   pnpm knowledge:build
 *
 * Env vars (see .env.example):
 *   COMPTABLE_REPO_URL  default https://github.com/joachimpomme-ctrl/comptable.git
 *   COMPTABLE_REPO_REF  default main
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const REPO_URL =
  process.env.COMPTABLE_REPO_URL ??
  "https://github.com/joachimpomme-ctrl/comptable.git";
const REPO_REF = process.env.COMPTABLE_REPO_REF ?? "main";

const ROOT = resolve(process.cwd());
const CACHE_DIR = join(ROOT, ".cache");
const REPO_DIR = join(CACHE_DIR, "comptable");
const OUT_DIR = join(ROOT, "knowledge");
const OUT_FILE = join(OUT_DIR, "bundle.json");

// Files to include from the upstream repo's /knowledge dir. The chatgpt_only/
// subfolder is intentionally excluded (reserved for the other agent).
const INCLUDED_FILES = [
  "01_decision_engine.md",
  "02_golden_rules_claude_first.md",
  "03_few_shots.md",
  "04_formules_et_risques.md",
  "05_agent_governance.md",
  "06_golden_checklists.md",
  "08_evaluation_suite.md",
  "M_CGI_code_general_impots.md",
] as const;

type IncludedFile = (typeof INCLUDED_FILES)[number];

interface BundleSection {
  file: IncludedFile;
  bytes: number;
  sha256: string;
  content: string;
}

interface Bundle {
  generatedAt: string;
  source: {
    repo: string;
    ref: string;
    commit: string;
  };
  sections: BundleSection[];
  totals: {
    bytes: number;
    approxChars: number;
    approxTokens: number; // rough heuristic: ~4 chars/token
    sha256: string;
  };
}

function sh(cmd: string, cwd?: string): string {
  return execSync(cmd, {
    cwd,
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
  }).trim();
}

function cloneOrUpdate(): void {
  mkdirSync(CACHE_DIR, { recursive: true });

  if (!existsSync(join(REPO_DIR, ".git"))) {
    console.log(`[knowledge] cloning ${REPO_URL} -> ${REPO_DIR}`);
    sh(`git clone --depth 1 --branch ${REPO_REF} ${REPO_URL} ${REPO_DIR}`);
    return;
  }

  console.log(`[knowledge] refreshing ${REPO_DIR} (ref=${REPO_REF})`);
  sh(`git fetch --depth 1 origin ${REPO_REF}`, REPO_DIR);
  sh(`git reset --hard origin/${REPO_REF}`, REPO_DIR);
}

async function assertKnowledgeFiles(): Promise<void> {
  const knowledgeDir = join(REPO_DIR, "knowledge");
  const st = await stat(knowledgeDir).catch(() => null);
  if (!st || !st.isDirectory()) {
    throw new Error(
      `Expected ${knowledgeDir} to exist after cloning ${REPO_URL}`,
    );
  }
  const present = new Set(await readdir(knowledgeDir));
  const missing = INCLUDED_FILES.filter((f) => !present.has(f));
  if (missing.length > 0) {
    throw new Error(
      `Missing files in upstream /knowledge: ${missing.join(", ")}`,
    );
  }
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function buildBundle(): Bundle {
  const commit = sh("git rev-parse HEAD", REPO_DIR);
  const sections: BundleSection[] = INCLUDED_FILES.map((file) => {
    const path = join(REPO_DIR, "knowledge", file);
    const content = readFileSync(path, "utf8");
    return {
      file,
      bytes: Buffer.byteLength(content, "utf8"),
      sha256: sha256(content),
      content,
    };
  });

  const concatenated = sections.map((s) => s.content).join("\n\n");
  const bytes = sections.reduce((a, s) => a + s.bytes, 0);
  const approxChars = concatenated.length;

  return {
    generatedAt: new Date().toISOString(),
    source: { repo: REPO_URL, ref: REPO_REF, commit },
    sections,
    totals: {
      bytes,
      approxChars,
      approxTokens: Math.round(approxChars / 4),
      sha256: sha256(concatenated),
    },
  };
}

function main() {
  cloneOrUpdate();
  // Top-level await is fine in tsx, but keep it sync where possible.
  return assertKnowledgeFiles().then(() => {
    const bundle = buildBundle();
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT_FILE, JSON.stringify(bundle, null, 2));

    console.log("");
    console.log(`[knowledge] commit            ${bundle.source.commit}`);
    console.log(`[knowledge] sections          ${bundle.sections.length}`);
    console.log(`[knowledge] total bytes       ${bundle.totals.bytes}`);
    console.log(`[knowledge] approx chars      ${bundle.totals.approxChars}`);
    console.log(`[knowledge] approx tokens (~) ${bundle.totals.approxTokens}`);
    console.log(`[knowledge] sha256            ${bundle.totals.sha256}`);
    console.log(`[knowledge] written           ${OUT_FILE}`);
  });
}

main().catch((err) => {
  console.error("[knowledge] FAILED:", err);
  process.exit(1);
});
