/**
 * Provider-agnostic structured JSON call.
 *
 * Both Gemini and Anthropic support tool-use / structured output. We expose
 * a single function that takes a Zod schema and a system + user prompt, and
 * returns the validated typed object.
 *
 *   - "gemini" → uses @google/genai with responseMimeType + responseSchema
 *   - "anthropic" → uses @anthropic-ai/sdk with a forced single-tool call
 */

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getGenai } from "../gemini-client";
import { getAnthropic } from "../anthropic-client";
import { env } from "../env";

export type Provider = "gemini" | "anthropic";

export interface JsonCallArgs<T extends z.ZodTypeAny> {
  provider: Provider;
  model: string;
  systemInstruction: string;
  userPrompt: string;
  zodSchema: T;
  /** Gemini-style schema (Type-enum). Required for Gemini calls. */
  geminiSchema?: object;
  /** Anthropic tool input_schema (JSON schema). Required for Anthropic. */
  anthropicSchema?: object;
  temperature?: number;
}

export interface JsonCallResult<T> {
  data: T;
  provider: Provider;
  model: string;
  latency_ms: number;
}

export async function callJson<T extends z.ZodTypeAny>(
  args: JsonCallArgs<T>,
): Promise<JsonCallResult<z.infer<T>>> {
  const t0 = Date.now();
  let raw: unknown;

  if (args.provider === "gemini") {
    if (!args.geminiSchema) {
      throw new Error("geminiSchema required for provider=gemini");
    }
    const result = await getGenai().models.generateContent({
      model: args.model,
      contents: args.userPrompt,
      config: {
        systemInstruction: args.systemInstruction,
        temperature: args.temperature ?? 0.0,
        responseMimeType: "application/json",
        responseSchema: args.geminiSchema,
      },
    });
    const text = result.text ?? "";
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error(`Gemini returned non-JSON: ${text.slice(0, 200)}`);
    }
  } else {
    if (!args.anthropicSchema) {
      throw new Error("anthropicSchema required for provider=anthropic");
    }
    const TOOL_NAME = "emit_result";
    const result = await getAnthropic().messages.create({
      model: args.model,
      max_tokens: 4096,
      system: args.systemInstruction,
      temperature: args.temperature ?? 0.0,
      tools: [
        {
          name: TOOL_NAME,
          description: "Emit the structured result.",
          input_schema: args.anthropicSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: args.userPrompt }],
    });
    const block = result.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === "tool_use" && b.name === TOOL_NAME,
    );
    if (!block) {
      throw new Error("Anthropic returned no tool_use block");
    }
    raw = block.input;
  }

  const data = args.zodSchema.parse(raw);
  return {
    data,
    provider: args.provider,
    model: args.model,
    latency_ms: Date.now() - t0,
  };
}

/** Resolve env-configured provider+model for an agent, with sensible defaults. */
export function resolveAgentProvider(args: {
  envProvider: string;
  envModel: string;
  defaultGeminiModel: string;
  defaultClaudeModel: string;
}): { provider: Provider; model: string } {
  const provider = (args.envProvider === "anthropic"
    ? "anthropic"
    : "gemini") as Provider;
  if (provider === "anthropic" && !env.ANTHROPIC_ENABLED) {
    // Fallback to Gemini if Claude not configured.
    return { provider: "gemini", model: args.defaultGeminiModel };
  }
  const model =
    args.envModel ||
    (provider === "anthropic"
      ? args.defaultClaudeModel
      : args.defaultGeminiModel);
  return { provider, model };
}
