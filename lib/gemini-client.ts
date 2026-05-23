/**
 * Lazy-init singleton for the Gemini GoogleGenAI client.
 * Imported by cache-manager, gem-clone, orchestrator, reviewer.
 */

import { GoogleGenAI } from "@google/genai";
import { env } from "./env";

let _client: GoogleGenAI | null = null;

export function getGenai(): GoogleGenAI {
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return _client;
}
