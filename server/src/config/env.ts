import "dotenv/config";
import { z } from "zod";

/**
 * Single place that reads `process.env`. Everywhere else in the server
 * imports `env` from here instead of touching `process.env` directly.
 *
 * Validated eagerly with zod so a missing/malformed variable fails the
 * process at boot with one clear message, instead of surfacing as a vague
 * runtime error the first time that code path is hit in production.
 */

const boolFromString = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
    // Comma-separated list of additional allowed origins (e.g. staging + prod client URLs).
    EXTRA_CORS_ORIGINS: z.string().optional(),
    TRUST_PROXY: boolFromString,

    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

    // 32-byte key, hex-encoded (64 hex chars), used to encrypt GitHub access tokens
    // at rest. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    TOKEN_ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, "TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)")
      .optional(),

    GITHUB_CLIENT_ID: z.string().default(""),
    GITHUB_CLIENT_SECRET: z.string().default(""),
    GITHUB_CALLBACK_URL: z.string().default(""),
    GITHUB_TOKEN: z.string().optional(),

    // Demo Mode — lets a visitor try the app via Google sign-in, using a single
    // shared, tightly-scoped GitHub repo behind the scenes. See routes/demo.route.ts.
    GOOGLE_CLIENT_ID: z.string().default(""),
    GOOGLE_CLIENT_SECRET: z.string().default(""),
    GOOGLE_CALLBACK_URL: z.string().default(""),

    // Fine-grained GitHub PAT scoped to exactly one repo. NEVER sent to the browser —
    // the server injects it server-side once a demo session is resolved.
    DEMO_GITHUB_TOKEN: z.string().optional(),
    DEMO_REPO_OWNER: z.string().optional(),
    DEMO_REPO_NAME: z.string().optional(),
    DEMO_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24),

    AI_PROVIDER: z.enum(["openai", "claude", "gemini"]).default("claude"),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().default("gpt-4o-mini"),

    ANTHROPIC_API_KEY: z.string().optional(),
    CLAUDE_MODEL: z.string().default("claude-sonnet-4-20250514"),

    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().default("gemini-1.5-flash"),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    AI_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production" && !data.TOKEN_ENCRYPTION_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TOKEN_ENCRYPTION_KEY"],
        message: "TOKEN_ENCRYPTION_KEY is required in production to encrypt stored GitHub tokens.",
      });
    }
    if (data.NODE_ENV === "production" && data.GITHUB_TOKEN) {
      // Not a hard failure, just makes sure this is a deliberate choice — see auth.middleware.ts,
      // which refuses to use this fallback in production regardless.
      // eslint-disable-next-line no-console
      console.warn(
        "[env] GITHUB_TOKEN is set in production — it is ignored as an auth fallback (dev-only) but still used for background/admin calls if referenced explicitly."
      );
    }
  });

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("❌ Invalid environment configuration:\n");
    for (const issue of parsed.error.issues) {
      // eslint-disable-next-line no-console
      console.error(`  • ${issue.path.join(".")}: ${issue.message}`);
    }
    // eslint-disable-next-line no-console
    console.error("\nCopy server/.env.example to server/.env and fill in the required values.");
    process.exit(1);
  }
  return parsed.data;
}

const raw = loadEnv();

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === "production",
  isDevelopment: raw.NODE_ENV === "development",
  port: raw.PORT,
  clientOrigin: raw.CLIENT_ORIGIN,
  extraCorsOrigins: (raw.EXTRA_CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  trustProxy: raw.TRUST_PROXY,

  mongodbUri: raw.MONGODB_URI,
  tokenEncryptionKey: raw.TOKEN_ENCRYPTION_KEY,

  github: {
    clientId: raw.GITHUB_CLIENT_ID,
    clientSecret: raw.GITHUB_CLIENT_SECRET,
    callbackUrl: raw.GITHUB_CALLBACK_URL,
    /** Optional PAT for local testing without going through the OAuth flow. Dev-only — see auth.middleware.ts. */
    token: raw.GITHUB_TOKEN || "",
  },

  google: {
    clientId: raw.GOOGLE_CLIENT_ID,
    clientSecret: raw.GOOGLE_CLIENT_SECRET,
    callbackUrl: raw.GOOGLE_CALLBACK_URL,
  },

  demo: {
    /** Fine-grained GitHub PAT scoped to exactly one repo — never sent to the browser. */
    githubToken: raw.DEMO_GITHUB_TOKEN || "",
    repoOwner: raw.DEMO_REPO_OWNER || "",
    repoName: raw.DEMO_REPO_NAME || "",
    sessionTtlHours: raw.DEMO_SESSION_TTL_HOURS,
  },

  ai: {
    /** Which provider `providers/index.ts` resolves to by default. */
    provider: raw.AI_PROVIDER,
    timeoutMs: raw.AI_TIMEOUT_MS,

    openai: {
      apiKey: raw.OPENAI_API_KEY || "",
      model: raw.OPENAI_MODEL,
    },
    claude: {
      apiKey: raw.ANTHROPIC_API_KEY || "",
      model: raw.CLAUDE_MODEL,
    },
    gemini: {
      apiKey: raw.GEMINI_API_KEY || "",
      model: raw.GEMINI_MODEL,
    },
  },

  rateLimit: {
    windowMs: raw.RATE_LIMIT_WINDOW_MS,
    max: raw.RATE_LIMIT_MAX,
    aiMax: raw.AI_RATE_LIMIT_MAX,
  },
};
