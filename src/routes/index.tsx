import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PackageSearch, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell, RequireAuth } from "@/components/layout/AppShell";
import { PostCard } from "@/components/posts/PostCard";
import { PostFormDialog } from "@/components/posts/PostFormDialog";
// import { AdSlot } from "@/components/shared/AdSlot";
import {
  EmptyState,
  ErrorState,
  PostSkeletonList,
} from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { friendlyError, todayInDhaka } from "@/lib/domain";
import {
  fetchCategories,
  fetchPostsPage,
  type PostWithMeta,
  POSTS_PAGE_SIZE,
} from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AIUB Lost & Found" },
      {
        name: "description",
        content:
          "A private lost-and-found board for verified AIUB students. Report a lost item, browse recent posts and help classmates get their belongings back.",
      },
      { property: "og:title", content: "AIUB Lost & Found" },
      {
        property: "og:description",
        content:
          "Verified AIUB students can report lost items, comment with tips and save posts they're helping with.",
      },
    ],
  }),
  component: FeedPage,
});

const ALL = "__all__";

function FeedPage() {
  return (
    <AppShell>
      <RequireAuth>
        <Feed />
      </RequireAuth>
    </AppShell>
  );
}

function Feed() {
  const { user, profile, isAdmin } = useAuth();
  const userId = user?.id ?? null;
  const canInteract = !profile?.is_banned;

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [date, setDate] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<PostWithMeta | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });
  const categories = categoriesQuery.data ?? [];
  const labels = useMemo(
    () => new Map(categories.map((item) => [item.slug, item.label])),
    [categories],
  );

  const filters = {
    ...(query ? { q: query } : {}),
    ...(category !== ALL ? { category } : {}),
    ...(date ? { date } : {}),
  };

  const postsQuery = useQuery({
    queryKey: ["posts", page, filters, userId],
    queryFn: () => fetchPostsPage({ page, filters, userId }),
  });

  const hasFilters = Boolean(query || date || category !== ALL);

  function resetFilters() {
    setSearch("");
    setQuery("");
    setCategory(ALL);
    setDate("");
    setPage(0);
  }

  return (
    <div className="space-y-6">
      <section className="surface-panel p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Campus lost &amp; found
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything reported by verified AIUB students, newest first.
        </p>

        <form
          className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
            setPage(0);
          }}
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by keyword, item or place"
              aria-label="Search posts"
              className="pl-9"
            />
          </div>

          <Select
            value={category}
            onValueChange={(value) => {
              setCategory(value);
              setPage(0);
            }}
          >
            <SelectTrigger className="md:w-48" aria-label="Filter by category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((item) => (
                <SelectItem key={item.slug} value={item.slug}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={date}
            max={todayInDhaka()}
            onChange={(event) => {
              setDate(event.target.value);
              setPage(0);
            }}
            aria-label="Filter by date lost"
            className="md:w-44"
          />

          <div className="flex gap-2">
            <Button type="submit">Search</Button>
            {hasFilters ? (
              <Button
                type="button"
                variant="ghost"
                onClick={resetFilters}
                aria-label="Clear filters"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      {/* <AdSlot id="feed-top" /> */}

      {postsQuery.isLoading ? (
        <PostSkeletonList />
      ) : postsQuery.isError ? (
        <ErrorState
          message={friendlyError(postsQuery.error)}
          onRetry={() => void postsQuery.refetch()}
        />
      ) : (postsQuery.data?.posts.length ?? 0) === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={hasFilters ? "No posts match those filters" : "No posts yet"}
          description={
            hasFilters
              ? "Try a different keyword, category or date."
              : "Be the first to report a lost item — you can publish one post per day."
          }
          {...(hasFilters
            ? {
              action: (
                <Button variant="outline" onClick={resetFilters}>
                  Clear filters
                </Button>
              ),
            }
            : {})}
        />
      ) : (
        <div className="space-y-4">
          {postsQuery.data?.posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              categoryLabel={labels.get(post.category) ?? post.category}
              currentUserId={userId}
              isAdmin={isAdmin}
              canInteract={canInteract}
              onChanged={() => void postsQuery.refetch()}
              onEdit={setEditing}
            />
          ))}
        </div>
      )}

      {(postsQuery.data?.total ?? 0) > POSTS_PAGE_SIZE ? (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of{" "}
            {Math.ceil((postsQuery.data?.total ?? 0) / POSTS_PAGE_SIZE)}
          </span>
          <Button
            variant="outline"
            disabled={!postsQuery.data?.hasMore}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}

      {userId && editing ? (
        <PostFormDialog
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
          categories={categories}
          userId={userId}
          post={editing}
          onSaved={() => void postsQuery.refetch()}
        />
      ) : null}
    </div>
  );
}
