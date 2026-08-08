import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, RequireAuth } from "@/components/layout/AppShell";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/domain";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Moderation — AIUB Lost & Found" },
      { name: "description", content: "Moderate students, posts and comments on the board." },
      { property: "og:title", content: "Moderation — AIUB Lost & Found" },
      { property: "og:description", content: "Admin moderation tools for AIUB Lost & Found." },
    ],
  }),
  component: () => (
    <AppShell>
      <RequireAuth adminOnly>
        <AdminDashboard />
      </RequireAuth>
    </AppShell>
  ),
});

type Row = {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  is_banned: boolean;
  banned_reason: string | null;
};

function AdminDashboard() {
  const [search, setSearch] = useState("");

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, is_banned, banned_reason")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  async function toggleBan(row: Row) {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_banned: !row.is_banned,
          banned_reason: row.is_banned ? null : "Suspended by a moderator",
        })
        .eq("id", row.id);
      if (error) throw error;
      toast.success(row.is_banned ? "Account restored" : "Account suspended");
      await usersQuery.refetch();
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  const rows = (usersQuery.data ?? []).filter((row) =>
    `${row.full_name} ${row.email}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-5 py-2">
      <h1 className="text-2xl font-semibold tracking-tight">Moderation</h1>
      <p className="text-sm text-muted-foreground">
        Suspend accounts that break community rules. Suspended students can still read the board but
        cannot post, comment or save.
      </p>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search students by name or email"
        aria-label="Search students"
        className="max-w-sm"
      />

      <div className="surface-panel divide-y divide-border">
        {usersQuery.isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading students…</p>
        ) : rows.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No students match that search.</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex items-center gap-3 p-4">
              <UserAvatar name={row.full_name} avatarUrl={row.avatar_url} seed={row.id} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">{row.email}</p>
              </div>
              <Button
                variant={row.is_banned ? "outline" : "destructive"}
                size="sm"
                onClick={() => void toggleBan(row)}
              >
                {row.is_banned ? "Restore" : "Suspend"}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
