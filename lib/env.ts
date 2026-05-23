/**
 * Lazy env accessor.
 * Throws at runtime if a required env var is missing.
 * Never accessed at build time.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v || v === "__REPLACE_ME__") {
    throw new Error(
      `Missing required env var: ${name}. ` +
        `Set it in .env.local or in the deployment environment.`,
    );
  }
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  get GEMINI_API_KEY() {
    return required("GEMINI_API_KEY");
  },
  get GEMINI_MODEL_FAST() {
    return optional("GEMINI_MODEL_FAST", "gemini-2.5-flash");
  },
  get GEMINI_MODEL_PRO() {
    return optional("GEMINI_MODEL_PRO", "gemini-2.5-pro");
  },
  get SHEETS_ID() {
    return process.env.SHEETS_ID ?? "";
  },
  get SHEETS_SERVICE_ACCOUNT_B64() {
    return process.env.SHEETS_SERVICE_ACCOUNT_B64 ?? "";
  },
  get SHEETS_ENABLED() {
    return (
      !!process.env.SHEETS_ID && !!process.env.SHEETS_SERVICE_ACCOUNT_B64
    );
  },
};
