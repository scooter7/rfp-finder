import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    role?: "admin" | "member";
  } | null;

  const email = body?.email?.trim().toLowerCase();
  const role = body?.role === "admin" ? "admin" : "member";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  const admin = createAdminClient();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/saved-searches`,
  });

  if (error || !data?.user) {
    return NextResponse.json(
      { error: error?.message ?? "invite failed" },
      { status: 500 },
    );
  }

  const { error: upsertError } = await admin
    .from("profiles")
    .upsert(
      { id: data.user.id, email, role },
      { onConflict: "id" },
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ userId: data.user.id, email, role });
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    userId?: string;
    role?: "admin" | "member";
  } | null;

  if (!body?.userId || (body.role !== "admin" && body.role !== "member")) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role: body.role })
    .eq("id", body.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
