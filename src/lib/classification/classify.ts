import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import pRetry from "p-retry";

import {
  classificationSchema,
  type Classification,
  CLASSIFIER_MODEL,
  CLASSIFIER_VERSION,
} from "./schemas";
import { CLASSIFIER_SYSTEM_PROMPT, buildClassifierUserPrompt } from "./prompts";

export interface ClassifyInput {
  title: string;
  description?: string | null;
  agencyName?: string | null;
  state?: string | null;
}

export interface ClassifyResult extends Classification {
  modelVersion: string;
}

/**
 * Classify a single RFP using Claude Haiku.
 * Retries up to 3 times on transient errors with exponential backoff.
 */
export async function classifyRfp(input: ClassifyInput): Promise<ClassifyResult> {
  const result = await pRetry(
    async () => {
      const { object } = await generateObject({
        model: anthropic(CLASSIFIER_MODEL),
        schema: classificationSchema,
        system: CLASSIFIER_SYSTEM_PROMPT,
        prompt: buildClassifierUserPrompt(input),
        temperature: 0,
        maxTokens: 500,
      });
      return object;
    },
    {
      retries: 3,
      minTimeout: 1000,
      factor: 2,
      onFailedAttempt: (error) => {
        console.warn(
          `[classify] attempt ${error.attemptNumber} failed: ${error.message}`,
        );
      },
    },
  );

  return { ...result, modelVersion: CLASSIFIER_VERSION };
}

/**
 * Classify a batch, concurrently with a small cap so we don't hammer rate limits.
 * For larger backfills, feed this from a queue rather than calling directly.
 */
export async function classifyBatch(
  inputs: ClassifyInput[],
  concurrency = 5,
): Promise<Array<ClassifyResult | { error: string }>> {
  const results: Array<ClassifyResult | { error: string }> = new Array(inputs.length);
  let cursor = 0;

  async function worker() {
    while (cursor < inputs.length) {
      const i = cursor++;
      try {
        results[i] = await classifyRfp(inputs[i]);
      } catch (err) {
        results[i] = { error: err instanceof Error ? err.message : String(err) };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, inputs.length) }, worker),
  );
  return results;
}
