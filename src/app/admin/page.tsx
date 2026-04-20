import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import InviteUserForm from "./invite-form";
import RoleToggle from "./role-toggle";

export default async function AdminHome() {
  const session = await getSessionUser();
  if (!session) redirect("/login?next=/admin");
  if (session.role !== "admin") redirect("/");

  const supabase = await createServerSupabaseClient();

  const [{ data: users }, { count: searchCount }, { count: alertCount }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, display_name, role, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("saved_searches")
        .select("*", { count: "exact", head: true }),
      supabase.from("alerts").select("*", { count: "exact", head: true }),
    ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage users and view all saved searches and alerts.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Users" value={users?.length ?? 0} />
        <Stat label="Saved searches" value={searchCount ?? 0} />
        <Stat label="Alerts" value={alertCount ?? 0} />
      </div>

      <nav className="flex gap-4 text-sm">
        <Link
          href="/admin/saved-searches"
          className="underline-offset-4 hover:underline"
        >
          All saved searches →
        </Link>
        <Link
          href="/admin/alerts"
          className="underline-offset-4 hover:underline"
        >
          All alerts →
        </Link>
      </nav>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Invite user</h2>
        <InviteUserForm />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Users</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Joined</th>
                <th className="text-left px-4 py-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {u.display_name ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    <RoleToggle
                      userId={u.id}
                      role={u.role}
                      isSelf={u.id === session.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
