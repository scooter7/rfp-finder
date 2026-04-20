import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import pRetry from "p-retry";

/**
 * Embedding provider — starts with OpenAI text-embedding-3-small (1536 dims).
 * Swap for Voyage AI (voyage-3, 1024 dims) later for better retrieval quality.
 * If you swap, update the vector(1536) column width in the migration.
 */
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_VERSION = `openai/${EMBEDDING_MODEL}-v1`;

/**
 * Build the text we'll embed. For retrieval, title + description
 * generally outperforms title alone. Truncate to keep token cost bounded.
 */
export function buildEmbedText(input: {
  title: string;
  description?: string | null;
  agencyName?: string | null;
}): string {
  const pieces = [input.title];
  if (input.agencyName) pieces.push(`Agency: ${input.agencyName}`);
  if (input.description) pieces.push(input.description.slice(0, 2000));
  return pieces.join("\n\n");
}

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await pRetry(
    () =>
      embed({
        model: openai.embedding(EMBEDDING_MODEL),
        value: text,
      }),
    { retries: 3, minTimeout: 1000, factor: 2 },
  );
  return embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  // OpenAI supports up to 2048 inputs per request; chunk conservatively.
  const CHUNK = 100;
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += CHUNK) {
    const slice = texts.slice(i, i + CHUNK);
    const { embeddings } = await pRetry(
      () => embedMany({ model: openai.embedding(EMBEDDING_MODEL), values: slice }),
      { retries: 3, minTimeout: 1000, factor: 2 },
    );
    out.push(...embeddings);
  }
  return out;
}
