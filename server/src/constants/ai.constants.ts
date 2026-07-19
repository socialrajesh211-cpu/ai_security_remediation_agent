/**
 * Taxonomy of AI-provider failure modes. Every AI-related error the server
 * throws is one of these, so the client can always show a specific,
 * actionable message instead of a generic "AI analysis failed".
 *
 * `adminActionRequired: true` means the user themselves can't fix it (bad
 * server config, disabled key, no quota) — the FE tells them to contact
 * an admin instead of suggesting a retry.
 */
export const AI_ERROR = {
  NOT_CONFIGURED: {
    code: "AI_NOT_CONFIGURED",
    statusCode: 503,
    message: "AI analysis failed",
    reason: "The AI provider isn't configured on the server — no API key is set for it.",
    adminActionRequired: true,
  },
  INVALID_API_KEY: {
    code: "AI_INVALID_API_KEY",
    statusCode: 502,
    message: "AI analysis failed",
    reason: "The AI provider rejected the configured API key (it may be invalid, revoked, or disabled).",
    adminActionRequired: true,
  },
  QUOTA_EXCEEDED: {
    code: "AI_QUOTA_EXCEEDED",
    statusCode: 402,
    message: "AI analysis failed",
    reason: "The AI provider account is out of quota or billing credits.",
    adminActionRequired: true,
  },
  RATE_LIMITED: {
    code: "AI_RATE_LIMITED",
    statusCode: 429,
    message: "AI analysis failed",
    reason: "Too many requests were sent to the AI provider in a short time.",
    adminActionRequired: false,
  },
  TOKEN_LIMIT_EXCEEDED: {
    code: "AI_TOKEN_LIMIT_EXCEEDED",
    statusCode: 413,
    message: "AI analysis failed",
    reason: "This finding's code/description is too large for the AI model's context limit.",
    adminActionRequired: false,
  },
  PROVIDER_UNAVAILABLE: {
    code: "AI_PROVIDER_UNAVAILABLE",
    statusCode: 502,
    message: "AI analysis failed",
    reason: "The AI provider is temporarily unavailable or the request timed out.",
    adminActionRequired: false,
  },
  INVALID_RESPONSE: {
    code: "AI_INVALID_RESPONSE",
    statusCode: 502,
    message: "AI analysis failed",
    reason: "The AI returned a response that couldn't be understood, even after retrying.",
    adminActionRequired: false,
  },
  UNSUPPORTED_PROVIDER: {
    code: "AI_UNSUPPORTED_PROVIDER",
    statusCode: 503,
    message: "AI analysis failed",
    reason: "The AI_PROVIDER configured on the server isn't a supported provider.",
    adminActionRequired: true,
  },
  UNKNOWN: {
    code: "AI_UNKNOWN_ERROR",
    statusCode: 500,
    message: "AI analysis failed",
    reason: "An unexpected error occurred while contacting the AI provider.",
    adminActionRequired: false,
  },
} as const;

export type AiErrorDef = (typeof AI_ERROR)[keyof typeof AI_ERROR];
