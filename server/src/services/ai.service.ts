import { z } from "zod";
import { AIAnalysis, Finding, Patch, PullRequestDraftResult } from "../types";
import { getAiProvider } from "../providers";
import { JSON_ONLY_SYSTEM_PROMPT, toShortSummary, Audience } from "../prompts/system.prompt";
import { buildAnalysisPrompt } from "../prompts/analysis.prompt";
import { buildPatchPrompt } from "../prompts/patch.prompt";
import { buildPullRequestPrompt } from "../prompts/pullRequest.prompt";
import { parseJsonAgainstSchema } from "../utils/json.util";
import { AI_ERROR } from "../constants/ai.constants";
import { AiServiceError } from "../utils/errors";

const AnalysisSchema = z.object({
  shortSummary: z.string(),
  rootCause: z.string(),
  whyVulnerable: z.string(),
  attackExample: z.string(),
  owaspCategory: z.string(),
  businessImpact: z.string(),
  likelihood: z.enum(["low", "medium", "high"]),
  exploitability: z.enum(["low", "medium", "high"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  recommendation: z.string(),
  confidence: z.number(),
});

const PatchSchema = z.object({
  patchedCode: z.string(),
  explanation: z.string(),
  confidence: z.number(),
  testsRecommended: z.boolean(),
});

const PullRequestSchema = z.object({
  title: z.string(),
  shortSummary: z.string(),
  description: z.string(),
});

/** Error codes worth a retry: transient LLM flakiness (bad JSON) or a transient upstream outage. */
const RETRYABLE_CODES = new Set<string>([AI_ERROR.INVALID_RESPONSE.code, AI_ERROR.PROVIDER_UNAVAILABLE.code]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls the configured AI provider and parses+validates the JSON response
 * against `schema`, retrying on malformed/invalid JSON (an LLM flakiness
 * issue) and on transient provider outages (with a short backoff).
 * Config/auth/quota/rate-limit errors are NOT retried — retrying a bad API
 * key or a hit rate limit just wastes time and delays the real error
 * reaching the user.
 */
async function generateStructured<T>(prompt: string, schema: z.ZodSchema<T>, retries = 2): Promise<T> {
  const provider = getAiProvider();
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const text = await provider.generate(prompt, { system: JSON_ONLY_SYSTEM_PROMPT });
      return parseJsonAgainstSchema(text, schema);
    } catch (err) {
      if (err instanceof AiServiceError && !RETRYABLE_CODES.has(err.code)) {
        throw err; // not worth retrying — config/auth/rate-limit/token-limit issue
      }
      lastError = err;
      console.warn(`[ai.service] ${provider.name} call failed (attempt ${attempt + 1}/${retries + 1})`);
      if (attempt < retries) await sleep(300 * 2 ** attempt); // 300ms, 600ms, ...
    }
  }

  if (lastError instanceof AiServiceError) throw lastError;
  throw new AiServiceError(AI_ERROR.INVALID_RESPONSE, `${lastError}`);
}

/** Analysis Agent — explains root cause, attack scenario, and business risk. */
export async function analyzeFinding(finding: Finding, audience: Audience = "senior"): Promise<AIAnalysis> {
  const parsed = await generateStructured(buildAnalysisPrompt(finding, audience), AnalysisSchema);
  return {
    findingId: finding.id,
    ...parsed,
    shortSummary: toShortSummary(parsed.shortSummary),
  };
}

/** Remediation Agent — generates a secure code patch for the finding. */
export async function generatePatch(finding: Finding): Promise<Patch> {
  const parsed = await generateStructured(buildPatchPrompt(finding), PatchSchema);
  return {
    findingId: finding.id,
    originalCode: finding.codeSnippet,
    patchedCode: parsed.patchedCode,
    explanation: parsed.explanation,
    confidence: parsed.confidence,
    testsRecommended: parsed.testsRecommended,
  };
}

/** PR Agent — drafts a clear pull request title & description. */
export async function draftPullRequest(finding: Finding, patch: Patch): Promise<PullRequestDraftResult> {
  const parsed = await generateStructured(buildPullRequestPrompt(finding, patch), PullRequestSchema);
  return { ...parsed, shortSummary: toShortSummary(parsed.shortSummary) };
}
