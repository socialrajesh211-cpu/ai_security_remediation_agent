/**
 * Shared system prompt for every structured AI call (analysis, patch, PR draft).
 * Kept provider-agnostic — passed as the `system` message/instruction regardless
 * of which provider (OpenAI/Claude/Gemini) ends up handling the request.
 */
export const JSON_ONLY_SYSTEM_PROMPT = `You are a senior application security engineer.

You ALWAYS respond with EXACTLY ONE valid JSON object.

Rules:
- Output JSON only.
- No markdown.
- No explanations.
- No comments.
- No code fences.
- No text before JSON.
- No text after JSON.
- First character must be {
- Last character must be }`;

/** Hard character cap — enforced in code regardless of what the model actually returns. */
export const SHORT_SUMMARY_MAX_CHARS = 50;

export function toShortSummary(text: string): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= SHORT_SUMMARY_MAX_CHARS) return clean;
  return clean.slice(0, SHORT_SUMMARY_MAX_CHARS - 1).trimEnd() + "…";
}

export type Audience = "senior" | "junior" | "product";

export const AUDIENCE_HINTS: Record<Audience, string> = {
  senior: "a senior software engineer who knows security fundamentals",
  junior: "a junior developer who is new to application security",
  product: "a non-technical product manager who needs the business impact explained simply",
};
