import { useState } from "react";
import { Loader2, MessageSquare, Reply, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { EmptyState } from "@/components/shared/States";
import { supabase } from "@/integrations/supabase/client";
import { commentSchema, formatRelative, friendlyError } from "@/lib/domain";
import { fetchComments, type CommentRow } from "@/lib/queries";

type Props = {
  postId: string;
  currentUserId: string | null;
  isAdmin: boolean;
  canInteract: boolean;
};

export function CommentsSection({ postId, currentUserId, isAdmin, canInteract }: Props) {
  const commentsQuery = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => fetchComments(postId),
  });

  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const comments = commentsQuery.data ?? [];
  const roots = comments.filter((comment) => !comment.parent_comment_id);
  const repliesOf = (id: string) => comments.filter((comment) => comment.parent_comment_id === id);

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!currentUserId) return;
    const parsed = commentSchema.safeParse({ content });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Write something before posting");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        user_id: currentUserId,
        parent_comment_id: replyTo?.id ?? null,
        content: parsed.data.content,
      });
      if (error) throw error;
      setContent("");
      setReplyTo(null);
      await commentsQuery.refetch();
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteComment(comment: CommentRow) {
    try {
      const { error } = await supabase.from("comments").delete().eq("id", comment.id);
      if (error) throw error;
      toast.success("Comment deleted");
      await commentsQuery.refetch();
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  function renderComment(comment: CommentRow, isReply = false) {
    const canDelete = isAdmin || comment.user_id === currentUserId;
    const name = comment.profiles?.full_name ?? "AIUB student";
    return (
      <li key={comment.id} className={isReply ? "ml-8 border-l border-border pl-4" : ""}>
        <div className="flex gap-3 py-3">
          <UserAvatar
            name={name}
            avatarUrl={comment.profiles?.avatar_url ?? null}
            seed={comment.user_id}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-semibold">{name}</span>{" "}
              <span className="text-xs text-muted-foreground">
                {formatRelative(comment.created_at)}
              </span>
            </p>
            <p className="mt-1 whitespace-pre-line break-words text-sm text-muted-foreground">
              {comment.content}
            </p>
            <div className="mt-1 flex gap-1">
              {!isReply && canInteract && currentUserId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setReplyTo(comment)}
                >
                  <Reply className="mr-1 h-3.5 w-3.5" /> Reply
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => void deleteComment(comment)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        {!isReply ? <ul>{repliesOf(comment.id).map((reply) => renderComment(reply, true))}</ul> : null}
      </li>
    );
  }

  return (
    <section aria-label="Comments" className="surface-panel p-5">
      <h2 className="text-base font-semibold">
        {comments.length} {comments.length === 1 ? "comment" : "comments"}
      </h2>

      {currentUserId && canInteract ? (
        <form onSubmit={submitComment} className="mt-4 space-y-2">
          {replyTo ? (
            <p className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-xs">
              Replying to {replyTo.profiles?.full_name ?? "a student"}
              <Button type="button" variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
                Cancel
              </Button>
            </p>
          ) : null}
          <Textarea
            value={content}
            rows={3}
            maxLength={1000}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Share a helpful detail or where you saw this item…"
            aria-label="Write a comment"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Post comment
            </Button>
          </div>
        </form>
      ) : null}

      {commentsQuery.isLoading ? (
        <p className="py-6 text-sm text-muted-foreground">Loading comments…</p>
      ) : roots.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={MessageSquare}
            title="No comments yet"
            description="Be the first to help this student find their item."
          />
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-border">{roots.map((comment) => renderComment(comment))}</ul>
      )}
    </section>
  );
}
