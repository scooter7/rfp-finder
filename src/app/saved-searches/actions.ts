"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { embedText } from "@/lib/embeddings/embed";

const savedSearchSchema = z.object({
  name: z.string().min(1).max(100),
  keywordQuery: z.string().max(500).optional().or(z.literal("")),
  semanticQuery: z.string().max(1000).optional().or(z.literal("")),
  vertical: z.string().optional().or(z.literal("")),
  category: z.string().optional().or(z.literal("")),
  state: z.string().length(2).optional().or(z.literal("")),
  alertFrequency: z.enum(["realtime", "daily", "weekly", "never"]),
});

export async function createSavedSearch(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const parsed = savedSearchSchema.parse({
    name: formData.get("name"),
    keywordQuery: formData.get("keywordQuery") ?? "",
    semanticQuery: formData.get("semanticQuery") ?? "",
    vertical: formData.get("vertical") ?? "",
    category: formData.get("category") ?? "",
    state: (formData.get("state") ?? "").toString().toUpperCase(),
    alertFrequency: formData.get("alertFrequency") ?? "daily",
  });

  // Pre-embed the semantic query so we don't re-embed on every match run
  let semanticEmbedding: number[] | null = null;
  if (parsed.semanticQuery && parsed.semanticQuery.trim().length > 0) {
    semanticEmbedding = await embedText(parsed.semanticQuery);
  }

  const filters: Record<string, unknown> = {};
  if (parsed.vertical) filters.vertical = parsed.vertical;
  if (parsed.category) filters.category = parsed.category;
  if (parsed.state) filters.state = parsed.state;

  const { error } = await supabase.from("saved_searches").insert({
    user_id: user.id,
    name: parsed.name,
    keyword_query: parsed.keywordQuery || null,
    semantic_query: parsed.semanticQuery || null,
    semantic_query_embedding: (semanticEmbedding as unknown as number[]) ?? null,
    filters,
    alert_frequency: parsed.alertFrequency,
  });

  if (error) throw new Error(`create failed: ${error.message}`);

  revalidatePath("/saved-searches");
  redirect("/saved-searches");
}

export async function deleteSavedSearch(id: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("saved_searches").delete().eq("id", id);
  if (error) throw new Error(`delete failed: ${error.message}`);
  revalidatePath("/saved-searches");
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/");
}
