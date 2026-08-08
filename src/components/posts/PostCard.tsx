import { Link } from "@tanstack/react-router";
import {
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  MessageSquare,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shared/UserAvatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatRelative, friendlyError } from "@/lib/domain";
import type { PostWithMeta } from "@/lib/queries";
import { toggleBookmark } from "@/lib/queries";
import { cloudinaryThumb } from "@/lib/upload-client";
import { deleteUploadedImage } from "@/lib/uploads.functions";

type Props = {
  post: PostWithMeta;
  categoryLabel: string;
  currentUserId: string | null;
  isAdmin: boolean;
  canInteract: boolean;
  onChanged: () => void;
  onEdit?: (post: PostWithMeta) => void;
};

export function PostCard({
  post,
  categoryLabel,
  currentUserId,
  isAdmin,
  canInteract,
  onChanged,
  onEdit,
}: Props) {
  const [saved, setSaved] = useState(post.isBookmarked);
  const [savePending, setSavePending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = currentUserId != null && post.user_id === currentUserId;
  const authorName = post.profiles?.full_name ?? "AIUB student";

  async function handleBookmark() {
    if (!currentUserId) return;
    if (!canInteract) {
      toast.error("Your account has been suspended by a moderator.");
      return;
    }
    const previous = saved;
    setSaved(!previous);
    setSavePending(true);
    try {
      await toggleBookmark(post.id, currentUserId, previous);
      toast.success(
        previous ? "Removed from saved posts" : "Saved to your bookmarks",
      );
      onChanged();
    } catch (error) {
      setSaved(previous); // optimistic rollback
      toast.error(friendlyError(error));
    } finally {
      setSavePending(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      if (post.image_public_id) {
        try {
          await deleteUploadedImage({
            data: {
              publicId: post.image_public_id,
              scope: "post",
              postId: post.id,
            },
          });
        } catch (error) {
          console.warn("[post] image cleanup failed", error);
        }
      }
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
      toast.success("Post deleted");
      setConfirmOpen(false);
      onChanged();
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="surface-panel overflow-hidden transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar
            name={authorName}
            avatarUrl={post.profiles?.avatar_url}
            seed={post.user_id}
            size="md"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{authorName}</p>
            <p className="text-xs text-muted-foreground">
              Posted {formatRelative(post.created_at)}
            </p>
          </div>
        </div>

        {isOwner || isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Actions for ${post.title}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isOwner && onEdit ? (
                <DropdownMenuItem onSelect={() => onEdit(post)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit post
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(event) => {
                  event.preventDefault();
                  setConfirmOpen(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isOwner ? "Delete post" : "Remove as admin"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="space-y-3 px-5 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{categoryLabel}</Badge>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Lost on {formatDate(post.lost_date)}
          </span>
        </div>

        <h3 className="text-lg font-semibold leading-snug">
          <Link
            to="/posts/$postId"
            params={{ postId: post.id }}
            className="hover:underline focus-visible:underline"
          >
            {post.title}
          </Link>
        </h3>

        {post.description ? (
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {post.description.length > 260
              ? `${post.description.slice(0, 260)}…`
              : post.description}
          </p>
        ) : null}
      </div>

      {post.image_url ? (
        <Link
          to="/posts/$postId"
          params={{ postId: post.id }}
          className="block"
        >
          <img
            src={cloudinaryThumb(post.image_url, 1000)}
            alt={`Photo of the lost item: ${post.title}`}
            loading="lazy"
            className="aspect-4/3 w-full bg-muted object-cover object-center"
          />
        </Link>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
        <Link
          to="/posts/$postId"
          params={{ postId: post.id }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          {post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}
        </Link>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={saved ? "secondary" : "ghost"}
              size="sm"
              disabled={savePending || !currentUserId}
              onClick={handleBookmark}
              aria-pressed={saved}
              aria-label={saved ? "Remove bookmark" : "Save post"}
            >
              {saved ? (
                <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Bookmark className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="ml-2 hidden sm:inline">
                {saved ? "Saved" : "Save"}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {saved ? "Remove from saved posts" : "Save this post"}
          </TooltipContent>
        </Tooltip>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              “{post.title}” and all of its comments will be permanently
              removed. Deleting a post does not give you an extra post for
              today.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete post"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
