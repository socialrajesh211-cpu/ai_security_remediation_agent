export interface AiGenerateOptions {
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Common surface every AI provider implements, so `services/ai.service.ts`
 * never needs to know whether it's talking to OpenAI, Claude, or Gemini.
 * Swapping providers is a config change (`AI_PROVIDER` env var), not a
 * code change — see `providers/index.ts`.
 */
export interface AiProvider {
  readonly name: string;
  /** Whether an API key is present for this provider. Checked before ever calling the SDK. */
  isConfigured(): boolean;
  /** Sends `prompt` (+ optional system instruction) and returns the raw text response. */
  generate(prompt: string, options?: AiGenerateOptions): Promise<string>;
}
