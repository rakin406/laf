import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, PackageSearch } from "lucide-react";
import { toast } from "sonner";

import { AppShell, RequireAuth } from "@/components/layout/AppShell";
import { EmptyState, PostSkeletonList } from "@/components/shared/States";
import { PostCard } from "@/components/posts/PostCard";
import { PostFormDialog } from "@/components/posts/PostFormDialog";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError, fullNameSchema } from "@/lib/domain";
import { uploadImage } from "@/lib/upload-client";
import { fetchCategories, fetchPostsPage, type PostWithMeta } from "@/lib/queries";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Your profile — AIUB Lost & Found" },
      { name: "description", content: "Update your display name, photo and manage your posts." },
      { property: "og:title", content: "Your profile — AIUB Lost & Found" },
      { property: "og:description", content: "Manage your AIUB Lost & Found profile and posts." },
    ],
  }),
  component: () => (
    <AppShell>
      <RequireAuth>
        <Settings />
      </RequireAuth>
    </AppShell>
  ),
});

function Settings() {
  const { user, profile, isAdmin, refreshProfile } = useAuth();
  const userId = user?.id ?? "";
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<PostWithMeta | null>(null);

  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const labels = useMemo(
    () => new Map((categoriesQuery.data ?? []).map((item) => [item.slug, item.label])),
    [categoriesQuery.data],
  );

  const myPosts = useQuery({
    queryKey: ["my-posts", userId],
    queryFn: () => fetchPostsPage({ page: 0, userId, ownerId: userId }),
    enabled: Boolean(userId),
  });

  async function saveName() {
    const parsed = fullNameSchema.safeParse(fullName);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Enter a valid name");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: parsed.data })
        .eq("id", userId);
      if (error) throw error;
      await refreshProfile();
      toast.success("Profile updated");
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setSaving(false);
    }
  }

  async function changeAvatar(file: File) {
    setUploading(true);
    try {
      const uploaded = await uploadImage(file, "avatars");
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: uploaded.url, avatar_public_id: uploaded.publicId })
        .eq("id", userId);
      if (error) throw error;
      await refreshProfile();
      toast.success("Profile photo updated");
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6 py-2">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>

      <section className="surface-panel space-y-4 p-6">
        <div className="flex items-center gap-4">
          <UserAvatar
            name={profile?.full_name ?? "Student"}
            avatarUrl={profile?.avatar_url ?? null}
            seed={userId}
            size="lg"
          />
          <div>
            <Label htmlFor="avatar" className="cursor-pointer text-sm font-medium underline">
              {uploading ? "Uploading…" : "Change photo"}
            </Label>
            <input
              id="avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void changeAvatar(file);
              }}
            />
            <p className="text-xs text-muted-foreground">{profile?.email}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            maxLength={80}
          />
        </div>
        <Button onClick={() => void saveName()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save changes
        </Button>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">My posts</h2>
        {myPosts.isLoading ? (
          <PostSkeletonList count={2} />
        ) : (myPosts.data?.posts.length ?? 0) === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="You haven't posted yet"
            description="Your lost-item reports will appear here."
          />
        ) : (
          myPosts.data?.posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              categoryLabel={labels.get(post.category) ?? post.category}
              currentUserId={userId}
              isAdmin={isAdmin}
              canInteract={!profile?.is_banned}
              onChanged={() => void myPosts.refetch()}
              onEdit={setEditing}
            />
          ))
        )}
      </section>

      {editing ? (
        <PostFormDialog
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
          categories={categoriesQuery.data ?? []}
          userId={userId}
          post={editing}
          onSaved={() => void myPosts.refetch()}
        />
      ) : null}
    </div>
  );
}
