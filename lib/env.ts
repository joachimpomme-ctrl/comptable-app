import { z } from "zod";

const EnvSchema = z.object({
  // Anthropic
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL_DEFAULT: z.string().default("claude-sonnet-4-6"),
  ANTHROPIC_MODEL_OPUS: z.string().default("claude-opus-4-7"),

  // Auth.js
  AUTH_SECRET: z.string().min(16),
  AUTH_URL: z.string().url().optional(),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),

  // Allowlist (CSV)
  ALLOWED_EMAILS: z
    .string()
    .min(1)
    .transform((s) =>
      s
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),

  // DB
  DATABASE_URL: z.string().url(),
  DATABASE_URL_POOLED: z.string().url().optional(),

  // Knowledge
  COMPTABLE_REPO_URL: z
    .string()
    .url()
    .default("https://github.com/joachimpomme-ctrl/comptable.git"),
  COMPTABLE_REPO_REF: z.string().default("main"),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
