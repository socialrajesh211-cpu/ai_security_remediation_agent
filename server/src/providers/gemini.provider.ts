import axios from "axios";
import { env } from "../config/env";
import { AI_ERROR } from "../constants/ai.constants";
import { AiServiceError } from "../utils/errors";
import { AiGenerateOptions, AiProvider } from "./ai-provider.types";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/** Maps a Gemini REST API error response to our normalized AI error taxonomy. */
function mapGeminiError(err: any): AiServiceError {
  const status: number | undefined = err?.response?.status;
  const googleStatus: string | undefined = err?.response?.data?.error?.status;
  const message = String(err?.response?.data?.error?.message ?? err?.message ?? err);

  if (!err?.response && (err?.code === "ECONNABORTED" || /timeout/i.test(message))) {
    return new AiServiceError(AI_ERROR.PROVIDER_UNAVAILABLE, message);
  }
  if (status === 400 && /api key not valid|api_key_invalid/i.test(message)) {
    return new AiServiceError(AI_ERROR.INVALID_API_KEY, message);
  }
  if (status === 401 || status === 403 || googleStatus === "PERMISSION_DENIED") {
    return new AiServiceError(AI_ERROR.INVALID_API_KEY, message);
  }
  if (status === 429 || googleStatus === "RESOURCE_EXHAUSTED") {
    if (/quota/i.test(message)) return new AiServiceError(AI_ERROR.QUOTA_EXCEEDED, message);
    return new AiServiceError(AI_ERROR.RATE_LIMITED, message);
  }
  if (/exceeds the maximum number of tokens|token limit/i.test(message)) {
    return new AiServiceError(AI_ERROR.TOKEN_LIMIT_EXCEEDED, message);
  }
  if (status === 503 || googleStatus === "UNAVAILABLE" || (typeof status === "number" && status >= 500)) {
    return new AiServiceError(AI_ERROR.PROVIDER_UNAVAILABLE, message);
  }
  return new AiServiceError(AI_ERROR.UNKNOWN, message);
}

export function createGeminiProvider(): AiProvider {
  return {
    name: "gemini",

    isConfigured() {
      return Boolean(env.ai.gemini.apiKey);
    },

    async generate(prompt: string, options: AiGenerateOptions = {}): Promise<string> {
      if (!this.isConfigured()) {
        throw new AiServiceError(AI_ERROR.NOT_CONFIGURED, "GEMINI_API_KEY is not set");
      }

      try {
        const { data } = await axios.post(
          `${BASE_URL}/${env.ai.gemini.model}:generateContent`,
          {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            ...(options.system ? { systemInstruction: { parts: [{ text: options.system }] } } : {}),
            generationConfig: {
              temperature: options.temperature ?? 0.2,
              maxOutputTokens: options.maxTokens ?? 4096,
            },
          },
          { params: { key: env.ai.gemini.apiKey }, timeout: env.ai.timeoutMs }
        );

        const parts = data?.candidates?.[0]?.content?.parts ?? [];
        return parts.map((p: any) => p.text ?? "").join("\n");
      } catch (err) {
        if (err instanceof AiServiceError) throw err;
        throw mapGeminiError(err);
      }
    },
  };
}
