import { env } from "../config/env";
import { AI_ERROR } from "../constants/ai.constants";
import { AiServiceError } from "../utils/errors";
import { AiProvider } from "./ai-provider.types";
import { createOpenAiProvider } from "./openai.provider";
import { createClaudeProvider } from "./claude.provider";
import { createGeminiProvider } from "./gemini.provider";

export type AiProviderName = "openai" | "claude" | "gemini";

const SUPPORTED: AiProviderName[] = ["openai", "claude", "gemini"];

const cache = new Map<AiProviderName, AiProvider>();

function build(name: AiProviderName): AiProvider {
  switch (name) {
    case "openai":
      return createOpenAiProvider();
    case "claude":
      return createClaudeProvider();
    case "gemini":
      return createGeminiProvider();
  }
}

/**
 * Returns the active AI provider. Which one depends on `AI_PROVIDER` in the
 * server's env (default "claude") — swapping providers is just an env change,
 * nothing in `services/ai.service.ts` or the routes needs to know.
 */
export function getAiProvider(name?: AiProviderName): AiProvider {
  const providerName = name ?? (env.ai.provider as AiProviderName);

  if (!SUPPORTED.includes(providerName)) {
    throw new AiServiceError(
      AI_ERROR.UNSUPPORTED_PROVIDER,
      `AI_PROVIDER="${providerName}" is not one of: ${SUPPORTED.join(", ")}`
    );
  }

  if (!cache.has(providerName)) {
    cache.set(providerName, build(providerName));
  }
  return cache.get(providerName)!;
}
