import { supabase } from "@/integrations/supabase/client";
import { todayInDhaka } from "@/lib/domain";

export const POSTS_PAGE_SIZE = 8;

export type PostAuthor = { id: string; full_name: string; avatar_url: string | null };

export type PostRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  lost_date: string;
  image_url: string | null;
  image_public_id: string | null;
  created_at: string;
  updated_at: string;
  profiles: PostAuthor | null;
};

export type PostWithMeta = PostRow & {
  commentCount: number;
  isBookmarked: boolean;
};

export type PostFilters = {
  q?: string;
  category?: string;
  date?: string;
};

const SELECT_POST = `
  id, user_id, title, description, category, lost_date, image_url, image_public_id,
  created_at, updated_at,
  profiles:posts_author_profile_fkey ( id, full_name, avatar_url )
`;

function escapeForOr(value: string) {
  // PostgREST `or=` filters treat , ( ) as syntax; strip them from user input.
  return value.replace(/[,()*%]/g, " ").trim();
}

export async function fetchCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("slug, label")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

async function decorate(posts: PostRow[], userId: string | null): Promise<PostWithMeta[]> {
  if (posts.length === 0) return [];
  const ids = posts.map((post) => post.id);

  const [{ data: comments }, bookmarkResult] = await Promise.all([
    supabase.from("comments").select("post_id").in("post_id", ids),
    userId
      ? supabase.from("bookmarks").select("post_id").eq("user_id", userId).in("post_id", ids)
      : Promise.resolve({ data: [] as { post_id: string }[] }),
  ]);

  const counts = new Map<string, number>();
  for (const row of comments ?? []) {
    counts.set(row.post_id, (counts.get(row.post_id) ?? 0) + 1);
  }
  const saved = new Set((bookmarkResult.data ?? []).map((row) => row.post_id));

  return posts.map((post) => ({
    ...post,
    commentCount: counts.get(post.id) ?? 0,
    isBookmarked: saved.has(post.id),
  }));
}

export async function fetchPostsPage({
  page,
  filters,
  userId,
  ownerId,
}: {
  page: number;
  filters?: PostFilters;
  userId: string | null;
  ownerId?: string;
}) {
  const from = page * POSTS_PAGE_SIZE;
  let query = supabase
    .from("posts")
    .select(SELECT_POST, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + POSTS_PAGE_SIZE - 1);

  if (ownerId) query = query.eq("user_id", ownerId);
  if (filters?.category) query = query.eq("category", filters.category);
  if (filters?.date) query = query.eq("lost_date", filters.date);

  const keyword = filters?.q ? escapeForOr(filters.q) : "";
  if (keyword) {
    query = query.or(
      `title.ilike.%${keyword}%,description.ilike.%${keyword}%,category.ilike.%${keyword}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const posts = await decorate((data ?? []) as unknown as PostRow[], userId);
  return { posts, total: count ?? 0, hasMore: from + POSTS_PAGE_SIZE < (count ?? 0) };
}

export async function fetchBookmarkedPosts(userId: string) {
  const { data: bookmarks, error } = await supabase
    .from("bookmarks")
    .select("post_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const ids = (bookmarks ?? []).map((row) => row.post_id);
  if (ids.length === 0) return [];

  const { data, error: postsError } = await supabase
    .from("posts")
    .select(SELECT_POST)
    .in("id", ids);
  if (postsError) throw postsError;

  const decorated = await decorate((data ?? []) as unknown as PostRow[], userId);
  const order = new Map(ids.map((id, index) => [id, index]));
  return decorated
    .map((post) => ({ ...post, isBookmarked: true }))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function fetchPost(postId: string, userId: string | null) {
  const { data, error } = await supabase
    .from("posts")
    .select(SELECT_POST)
    .eq("id", postId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [decorated] = await decorate([data as unknown as PostRow], userId);
  return decorated ?? null;
}

export type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  profiles: PostAuthor | null;
};

export async function fetchComments(postId: string) {
  const { data, error } = await supabase
    .from("comments")
    .select(
      `id, post_id, user_id, parent_comment_id, content, created_at, updated_at,
       profiles:comments_author_profile_fkey ( id, full_name, avatar_url )`,
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CommentRow[];
}

/** Whether the student has already consumed today's posting quota (Asia/Dhaka). */
export async function fetchPostingEligibility(userId: string) {
  const today = todayInDhaka();
  const { data, error } = await supabase
    .from("posting_quota")
    .select("posting_date")
    .eq("user_id", userId)
    .eq("posting_date", today)
    .maybeSingle();
  if (error) throw error;
  return { canPost: !data, today };
}

export async function toggleBookmark(postId: string, userId: string, isBookmarked: boolean) {
  if (isBookmarked) {
    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", userId)
      .eq("post_id", postId);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase.from("bookmarks").insert({ user_id: userId, post_id: postId });
  // Duplicate bookmark: treat as already saved rather than an error.
  if (error && !error.message.includes("duplicate key")) throw error;
  return true;
}
