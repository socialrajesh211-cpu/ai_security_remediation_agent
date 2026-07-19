import OpenAI from "openai";
import { env } from "../config/env";
import { AI_ERROR } from "../constants/ai.constants";
import { AiServiceError } from "../utils/errors";
import { AiGenerateOptions, AiProvider } from "./ai-provider.types";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: env.ai.openai.apiKey, timeout: env.ai.timeoutMs, maxRetries: 2 });
  }
  return _client;
}

/** Maps an OpenAI SDK error to our normalized AI error taxonomy. */
function mapOpenAiError(err: any): AiServiceError {
  const status: number | undefined = err?.status ?? err?.response?.status;
  const code: string | undefined = err?.code ?? err?.error?.code ?? err?.error?.type;
  const message = String(err?.message ?? err);

  if (status === 401 || code === "invalid_api_key") {
    return new AiServiceError(AI_ERROR.INVALID_API_KEY, message);
  }
  if (code === "insufficient_quota" || /quota/i.test(message)) {
    return new AiServiceError(AI_ERROR.QUOTA_EXCEEDED, message);
  }
  if (status === 429) {
    return new AiServiceError(AI_ERROR.RATE_LIMITED, message);
  }
  if (
    code === "context_length_exceeded" ||
    /context length|maximum context|too many tokens/i.test(message)
  ) {
    return new AiServiceError(AI_ERROR.TOKEN_LIMIT_EXCEEDED, message);
  }
  if (typeof status === "number" && status >= 500) {
    return new AiServiceError(AI_ERROR.PROVIDER_UNAVAILABLE, message);
  }
  return new AiServiceError(AI_ERROR.UNKNOWN, message);
}

export function createOpenAiProvider(): AiProvider {
  return {
    name: "openai",

    isConfigured() {
      return Boolean(env.ai.openai.apiKey);
    },

    async generate(prompt: string, options: AiGenerateOptions = {}): Promise<string> {
      if (!this.isConfigured()) {
        throw new AiServiceError(AI_ERROR.NOT_CONFIGURED, "OPENAI_API_KEY is not set");
      }

      try {
        const response = await client().chat.completions.create({
          model: env.ai.openai.model,
          temperature: options.temperature ?? 0.2,
          messages: [
            ...(options.system ? [{ role: "system" as const, content: options.system }] : []),
            { role: "user" as const, content: prompt },
          ],
        });
        return response.choices[0]?.message?.content ?? "";
      } catch (err) {
        if (err instanceof AiServiceError) throw err;
        throw mapOpenAiError(err);
      }
    },
  };
}
