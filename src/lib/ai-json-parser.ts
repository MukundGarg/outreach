import { z } from 'zod';

export function cleanJsonFences(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

/**
 * Safely parses and validates assistant JSON responses from AI services.
 */
export function parseAiJsonResponse<T>(rawAnswer: string, schema: z.ZodType<T>): T {
  const cleaned = cleanJsonFences(rawAnswer);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch (err: unknown) {
    throw new Error(
      `AI service returned non-JSON text: ${rawAnswer.slice(0, 150)}... Error: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const result = schema.safeParse(parsedJson);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`AI payload failed schema validation: ${errorDetails}`);
  }

  return result.data;
}
