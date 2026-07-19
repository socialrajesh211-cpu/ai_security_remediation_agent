import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";
import { AI_ERROR } from "../constants/ai.constants";
import { AiServiceError } from "../utils/errors";
import { AiGenerateOptions, AiProvider } from "./ai-provider.types";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: env.ai.claude.apiKey, timeout: env.ai.timeoutMs, maxRetries: 2 });
  }
  return _client;
}

/** Maps an Anthropic SDK error to our normalized AI error taxonomy. */
function mapAnthropicError(err: any): AiServiceError {
  const status: number | undefined = err?.status ?? err?.response?.status;
  const type: string | undefined = err?.error?.error?.type ?? err?.error?.type;
  const message = String(err?.message ?? err);

  if (status === 401 || type === "authentication_error") {
    return new AiServiceError(AI_ERROR.INVALID_API_KEY, message);
  }
  if (status === 403 || type === "permission_error") {
    return new AiServiceError(AI_ERROR.INVALID_API_KEY, message);
  }
  if (status === 429 || type === "rate_limit_error") {
    return new AiServiceError(AI_ERROR.RATE_LIMITED, message);
  }
  if (/credit balance|billing/i.test(message)) {
    return new AiServiceError(AI_ERROR.QUOTA_EXCEEDED, message);
  }
  if (
    type === "invalid_request_error" &&
    /prompt is too long|max_tokens|context/i.test(message)
  ) {
    return new AiServiceError(AI_ERROR.TOKEN_LIMIT_EXCEEDED, message);
  }
  if (status === 529 || (typeof status === "number" && status >= 500)) {
    return new AiServiceError(AI_ERROR.PROVIDER_UNAVAILABLE, message);
  }
  return new AiServiceError(AI_ERROR.UNKNOWN, message);
}

export function createClaudeProvider(): AiProvider {
  return {
    name: "claude",

    isConfigured() {
      return Boolean(env.ai.claude.apiKey);
    },

    async generate(prompt: string, options: AiGenerateOptions = {}): Promise<string> {
      if (!this.isConfigured()) {
        throw new AiServiceError(AI_ERROR.NOT_CONFIGURED, "ANTHROPIC_API_KEY is not set");
      }

      try {
        const response = await client().messages.create({
          model: env.ai.claude.model,
          max_tokens: options.maxTokens ?? 4096,
          temperature: options.temperature ?? 0.2,
          ...(options.system ? { system: options.system } : {}),
          messages: [{ role: "user", content: prompt }],
        });

        return response.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("\n");
      } catch (err) {
        if (err instanceof AiServiceError) throw err;
        throw mapAnthropicError(err);
      }
    },
  };
}
