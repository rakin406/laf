import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { AppShell, RequireAuth } from "@/components/layout/AppShell";
import { CommentsSection } from "@/components/posts/CommentsSection";
import { PostCard } from "@/components/posts/PostCard";
import { ErrorState, PostSkeletonList } from "@/components/shared/States";
// import { AdSlot } from "@/components/shared/AdSlot";
import { useAuth } from "@/hooks/useAuth";
import { friendlyError } from "@/lib/domain";
import { fetchCategories, fetchPost } from "@/lib/queries";

export const Route = createFileRoute("/posts/$postId")({
  head: () => ({
    meta: [
      { title: "Lost item details" },
      {
        name: "description",
        content:
          "Full details, photo and student comments for a reported AIUB lost item.",
      },
      {
        property: "og:title",
        content: "Lost item details",
      },
      {
        property: "og:description",
        content:
          "See the photo, description and comments for this reported item.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <RequireAuth>
        <PostDetail />
      </RequireAuth>
    </AppShell>
  ),
});

function PostDetail() {
  const { postId } = useParams({ from: "/posts/$postId" });
  const { user, profile, isAdmin } = useAuth();
  const userId = user?.id ?? null;

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

  const postQuery = useQuery({
    queryKey: ["post", postId, userId],
    queryFn: () => fetchPost(postId, userId),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-2">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to feed
      </Link>

      {postQuery.isLoading ? (
        <PostSkeletonList count={1} />
      ) : postQuery.isError ? (
        <ErrorState
          message={friendlyError(postQuery.error)}
          onRetry={() => void postQuery.refetch()}
        />
      ) : !postQuery.data ? (
        <ErrorState message="This post no longer exists." />
      ) : (
        <>
          <PostCard
            post={postQuery.data}
            categoryLabel={
              labels.get(postQuery.data.category) ?? postQuery.data.category
            }
            currentUserId={userId}
            isAdmin={isAdmin}
            canInteract={!profile?.is_banned}
            onChanged={() => void postQuery.refetch()}
          />
          {/* <AdSlot id="post-detail" /> */}
          <CommentsSection
            postId={postId}
            currentUserId={userId}
            isAdmin={isAdmin}
            canInteract={!profile?.is_banned}
          />
        </>
      )}
    </div>
  );
}
