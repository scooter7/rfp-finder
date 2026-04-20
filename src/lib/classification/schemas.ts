import { z } from "zod";

/**
 * Verticals — the target industry/sector of an RFP.
 * Kept small and disjoint. "other" is the fallback when nothing fits.
 */
export const verticalSchema = z.enum([
  "higher_ed",
  "healthcare",
  "k12",
  "state_local_gov",
  "federal_gov",
  "other",
]);
export type Vertical = z.infer<typeof verticalSchema>;

/**
 * Categories — the type of work being requested.
 * Start broad; expand as patterns emerge from real data.
 */
export const categorySchema = z.enum([
  "website_redesign",
  "web_development",
  "digital_marketing",
  "ai_ml_services",
  "data_analytics",
  "crm_implementation",
  "erp_implementation",
  "software_development",
  "it_consulting",
  "cybersecurity",
  "cloud_migration",
  "content_creation",
  "video_production",
  "training_services",
  "research_services",
  "branding_design",
  "enrollment_marketing",
  "student_information_system",
  "learning_management_system",
  "other",
]);
export type Category = z.infer<typeof categorySchema>;

export const classificationSchema = z.object({
  vertical: verticalSchema,
  category: categorySchema,
  tags: z
    .array(z.string().min(2).max(40))
    .min(2)
    .max(8)
    .describe("3-7 concise keywords/phrases capturing the RFP's substance"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Your confidence in this classification, 0.0 to 1.0"),
  reasoning: z
    .string()
    .max(300)
    .describe("One-sentence explanation — helps with debugging/eval"),
});

export type Classification = z.infer<typeof classificationSchema>;

export const CLASSIFIER_MODEL = "claude-haiku-4-5-20251001";
export const CLASSIFIER_VERSION = `${CLASSIFIER_MODEL}-v1`;
