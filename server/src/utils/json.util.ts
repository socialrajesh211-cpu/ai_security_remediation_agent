import { ZodSchema } from "zod";

/**
 * LLMs sometimes wrap JSON in markdown fences or add stray text around it
 * even when told not to. This strips fences and slices out the outermost
 * `{...}` object before handing it to zod. Provider-agnostic — used for
 * OpenAI, Claude, and Gemini responses alike.
 */
export function extractJsonObject(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`Model did not return JSON:\n\n${cleaned}`);
  }

  const json = cleaned.slice(start, end + 1);
  return JSON.parse(json);
}

export function parseJsonAgainstSchema<T>(text: string, schema: ZodSchema<T>): T {
  const parsed = extractJsonObject(text);
  return schema.parse(parsed);
}
