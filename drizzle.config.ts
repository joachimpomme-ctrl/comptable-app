import type { Config } from "drizzle-kit";
import { existsSync } from "node:fs";

// drizzle-kit only auto-loads `.env`, not `.env.local`. Load the Next.js
// convention manually so `pnpm db:push` / `db:generate` work without
// requiring a `--env-file` flag everywhere.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for drizzle-kit");
}

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
} satisfies Config;
