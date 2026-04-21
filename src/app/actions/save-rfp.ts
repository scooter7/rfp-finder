"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function toggleSavedRfp(rfpId: string): Promise<{ saved: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { saved: false, error: "not signed in" };

  const existingRes = await supabase
    .from("saved_rfps")
    .select("rfp_id")
    .eq("user_id", user.id)
    .eq("rfp_id", rfpId)
    .maybeSingle();

  if (existingRes.data) {
    const { error } = await supabase
      .from("saved_rfps")
      .delete()
      .eq("user_id", user.id)
      .eq("rfp_id", rfpId);
    if (error) return { saved: true, error: error.message };
    revalidatePath("/");
    revalidatePath("/saved-rfps");
    return { saved: false };
  }

  const { error } = await supabase
    .from("saved_rfps")
    .insert({ user_id: user.id, rfp_id: rfpId });
  if (error) return { saved: false, error: error.message };
  revalidatePath("/");
  revalidatePath("/saved-rfps");
  return { saved: true };
}
