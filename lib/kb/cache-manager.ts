/**
 * Gemini explicit context cache manager.
 *
 * Creates a single cachedContent containing the KB files + system instruction,
 * then reuses the same cache name across all Gem-clone requests for ~1h.
 * Cost reduction on input tokens: ~ ×10.
 */

import path from "node:path";
import { readFile } from "node:fs/promises";

import { getGenai } from "../gemini-client";
import { env } from "../env";
import { loadKb, kbTotalSize } from "./loader";

export interface CacheRef {
  name: string;
  expires_at: string;
  total_tokens: number;
  created_at: string;
}

const SYSTEM_INSTRUCTION_PATH = path.resolve(
  process.cwd(),
  "kb",
  "system",
  "00_INSTRUCTIONS_GEMINI.md",
);

const CACHE_TTL_SECONDS = 3600; // 1h — renewed lazily on next request
const CACHE_DISPLAY_NAME = "compta-multi-agents-kb-v1";

let current: CacheRef | null = null;
let inflight: Promise<CacheRef> | null = null;

/** Returns the currently-valid cache, creating one if needed. */
export async function getOrCreateCache(): Promise<CacheRef> {
  if (current && new Date(current.expires_at) > new Date(Date.now() + 60_000)) {
    // Still valid for at least 60 s — reuse.
    return current;
  }
  if (inflight) return inflight;
  inflight = createCache();
  try {
    current = await inflight;
    return current;
  } finally {
    inflight = null;
  }
}

async function loadSystemInstruction(): Promise<string> {
  return readFile(SYSTEM_INSTRUCTION_PATH, "utf8");
}

async function createCache(): Promise<CacheRef> {
  const [kbFiles, systemInstruction] = await Promise.all([
    loadKb(),
    loadSystemInstruction(),
  ]);

  const totalKbBytes = kbTotalSize(kbFiles);
  console.log(
    `[cache] creating cache with ${kbFiles.length} files (${(totalKbBytes / 1024).toFixed(0)} KB)`,
  );

  // Wrap each KB file as a separate user-message part with a header.
  const parts = kbFiles.map((f) => ({
    text: `# === FILE: ${f.name} ===\n\n${f.content}\n`,
  }));

  const result = await getGenai().caches.create({
    model: env.GEMINI_MODEL_FAST,
    config: {
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      systemInstruction,
      ttl: `${CACHE_TTL_SECONDS}s`,
      displayName: CACHE_DISPLAY_NAME,
    },
  });

  if (!result.name) {
    throw new Error("Cache creation returned no resource name");
  }

  const ref: CacheRef = {
    name: result.name,
    expires_at: result.expireTime ?? new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString(),
    total_tokens: result.usageMetadata?.totalTokenCount ?? 0,
    created_at: result.createTime ?? new Date().toISOString(),
  };

  console.log(
    `[cache] created ${ref.name} — ${ref.total_tokens} tokens — expires ${ref.expires_at}`,
  );
  return ref;
}

/** Force a refresh on next call. Useful in tests or on cache miss. */
export function invalidateCache(): void {
  current = null;
}
