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
  // --- Anthropic ---
  get ANTHROPIC_API_KEY() {
    return required("ANTHROPIC_API_KEY");
  },
  get ANTHROPIC_ENABLED() {
    return (
      !!process.env.ANTHROPIC_API_KEY &&
      process.env.ANTHROPIC_API_KEY !== "__REPLACE_ME__"
    );
  },
  get CLAUDE_MODEL_HAIKU() {
    return optional("CLAUDE_MODEL_HAIKU", "claude-haiku-4-5-20251001");
  },
  get CLAUDE_MODEL_SONNET() {
    return optional("CLAUDE_MODEL_SONNET", "claude-sonnet-4-6");
  },
  get CLAUDE_MODEL_OPUS() {
    return optional("CLAUDE_MODEL_OPUS", "claude-opus-4-7");
  },
  // --- Per-agent provider routing ---
  get AGENT_ORCH_PROVIDER() {
    return optional("AGENT_ORCH_PROVIDER", "gemini");
  },
  get AGENT_ORCH_MODEL() {
    return process.env.AGENT_ORCH_MODEL || "";
  },
  get AGENT_REVIEWER_PROVIDER() {
    return optional("AGENT_REVIEWER_PROVIDER", "gemini");
  },
  get AGENT_REVIEWER_MODEL() {
    return process.env.AGENT_REVIEWER_MODEL || "";
  },
  get AGENT_REVIEWER_IRREVERSIBLE_MODEL() {
    return process.env.AGENT_REVIEWER_IRREVERSIBLE_MODEL || "";
  },
  get AGENT_PARAM_PROVIDER() {
    return optional("AGENT_PARAM_PROVIDER", "gemini");
  },
  get AGENT_PARAM_MODEL() {
    return process.env.AGENT_PARAM_MODEL || "";
  },
  // --- Sheets ---
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
