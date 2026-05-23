/**
 * Lazy-init singleton for the Anthropic Claude client.
 * Used when an agent's *_PROVIDER env var is set to "anthropic".
 */

import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return _client;
}
