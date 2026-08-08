import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { useMemo } from "react";
import { AppShell, RequireAuth } from "@/components/layout/AppShell";
import { PostCard } from "@/components/posts/PostCard";
import {
  EmptyState,
  ErrorState,
  PostSkeletonList,
} from "@/components/shared/States";
import { useAuth } from "@/hooks/useAuth";
import { friendlyError } from "@/lib/domain";
import { fetchBookmarkedPosts, fetchCategories } from "@/lib/queries";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved posts" },
      {
        name: "description",
        content: "The lost-and-found posts you bookmarked to follow up on.",
      },
      { property: "og:title", content: "Saved posts" },
      {
        property: "og:description",
        content: "Your bookmarked AIUB lost-and-found posts.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <RequireAuth>
        <SavedPosts />
      </RequireAuth>
    </AppShell>
  ),
});

function SavedPosts() {
  const { user, profile, isAdmin } = useAuth();
  const userId = user?.id ?? "";

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });
  const labels = useMemo(
    () =>
      new Map(
        (categoriesQuery.data ?? []).map((item) => [item.slug, item.label]),
      ),
    [categoriesQuery.data],
  );

  const savedQuery = useQuery({
    queryKey: ["bookmarks", userId],
    queryFn: () => fetchBookmarkedPosts(userId),
    enabled: Boolean(userId),
  });

  return (
    <div className="space-y-6 py-2">
      <h1 className="text-2xl font-semibold tracking-tight">Saved posts</h1>

      {savedQuery.isLoading ? (
        <PostSkeletonList count={2} />
      ) : savedQuery.isError ? (
        <ErrorState
          message={friendlyError(savedQuery.error)}
          onRetry={() => void savedQuery.refetch()}
        />
      ) : (savedQuery.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          description="Tap Save on any post to keep track of items you're helping to find."
        />
      ) : (
        <div className="space-y-4">
          {savedQuery.data?.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              categoryLabel={labels.get(post.category) ?? post.category}
              currentUserId={userId}
              isAdmin={isAdmin}
              canInteract={!profile?.is_banned}
              onChanged={() => void savedQuery.refetch()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
