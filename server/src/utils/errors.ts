/**
 * Structured application error. Carries an HTTP status code plus a stable
 * machine-readable `code`, a human `reason` (safe to show in the UI), and
 * whether resolving it requires an admin (vs. the user just retrying).
 *
 * Thrown from services/controllers and caught by `middlewares/error.middleware.ts`,
 * which serializes it into a consistent JSON error shape for the client.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly reason: string;
  public readonly adminActionRequired: boolean;
  public readonly details?: string;

  constructor(params: {
    message: string;
    statusCode: number;
    code: string;
    reason: string;
    adminActionRequired?: boolean;
    details?: string;
  }) {
    super(params.message);
    this.name = "AppError";
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.reason = params.reason;
    this.adminActionRequired = params.adminActionRequired ?? false;
    this.details = params.details;
  }
}

/** Error thrown by AI provider calls (OpenAI / Claude / Gemini) — see constants/ai.constants.ts for the taxonomy. */
export class AiServiceError extends AppError {
  constructor(
    def: {
      code: string;
      statusCode: number;
      message: string;
      reason: string;
      adminActionRequired: boolean;
    },
    details?: string
  ) {
    super({ ...def, details });
    this.name = "AiServiceError";
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
