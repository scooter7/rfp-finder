import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string;
  role: "admin" | "member";
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profileRes = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileRes.data as { role: "admin" | "member"; email: string } | null;

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? "",
    role: profile?.role ?? "member",
  };
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    throw new Error("forbidden");
  }
  return session;
}
