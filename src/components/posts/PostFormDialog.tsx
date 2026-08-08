import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError, postSchema, todayInDhaka } from "@/lib/domain";
import { uploadImage } from "@/lib/upload-client";
import { deleteUploadedImage } from "@/lib/uploads.functions";
import type { PostWithMeta } from "@/lib/queries";

type Category = { slug: string; label: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  userId: string;
  post?: PostWithMeta | null;
  onSaved: () => void;
};

type FormState = {
  title: string;
  description: string;
  category: string;
  lostDate: string;
};

const emptyForm: FormState = { title: "", description: "", category: "", lostDate: todayInDhaka() };

export function PostFormDialog({
  open,
  onOpenChange,
  categories,
  userId,
  post,
  onSaved,
}: Props) {
  const isEdit = Boolean(post);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFile(null);
    setPreview(null);
    setForm(
      post
        ? {
            title: post.title,
            description: post.description ?? "",
            category: post.category,
            lostDate: post.lost_date,
          }
        : { ...emptyForm, lostDate: todayInDhaka() },
    );
  }, [open, post]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = postSchema.safeParse(form);
    if (!parsed.success) {
      const next: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);

    let uploaded: { url: string; publicId: string } | null = null;
    try {
      if (isEdit && post) {
        const { error } = await supabase
          .from("posts")
          .update({
            title: parsed.data.title,
            description: parsed.data.description || null,
            category: parsed.data.category,
            lost_date: parsed.data.lostDate,
          })
          .eq("id", post.id);
        if (error) throw error;
        toast.success("Post updated");
      } else {
        if (file) uploaded = await uploadImage(file, "posts");
        const { error } = await supabase.from("posts").insert({
          user_id: userId,
          title: parsed.data.title,
          description: parsed.data.description || null,
          category: parsed.data.category,
          lost_date: parsed.data.lostDate,
          image_url: uploaded?.url ?? null,
          image_public_id: uploaded?.publicId ?? null,
        });
        if (error) throw error;
        toast.success("Post published — good luck!");
      }
      onOpenChange(false);
      onSaved();
    } catch (error) {
      // Roll back an orphaned Cloudinary upload when the insert failed.
      if (uploaded) {
        try {
          await deleteUploadedImage({ data: { publicId: uploaded.publicId, scope: "orphan" } });
        } catch (cleanupError) {
          console.warn("[post] orphan cleanup failed", cleanupError);
        }
      }
      toast.error(friendlyError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit post" : "Report a lost item"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "You can update the details. The photo cannot be changed after a post is created."
              : "You can publish one post per day. Add as much detail as you can."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              maxLength={120}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Black Casio watch left in AB1 lab"
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title ? <p className="text-xs text-destructive">{errors.title}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
              >
                <SelectTrigger id="category" aria-invalid={Boolean(errors.category)}>
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.slug} value={category.slug}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category ? (
                <p className="text-xs text-destructive">{errors.category}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lostDate">Date lost</Label>
              <Input
                id="lostDate"
                type="date"
                max={todayInDhaka()}
                value={form.lostDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, lostDate: event.target.value }))
                }
                aria-invalid={Boolean(errors.lostDate)}
              />
              {errors.lostDate ? (
                <p className="text-xs text-destructive">{errors.lostDate}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={4}
              maxLength={2000}
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Where you last saw it, identifying marks, how to reach you…"
            />
            {errors.description ? (
              <p className="text-xs text-destructive">{errors.description}</p>
            ) : null}
          </div>

          {!isEdit ? (
            <div className="space-y-2">
              <Label htmlFor="photo">Photo (optional, one per post)</Label>
              <input
                ref={fileInput}
                id="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              {preview ? (
                <div className="relative overflow-hidden rounded-lg border border-border">
                  <img src={preview} alt="Selected preview" className="max-h-56 w-full object-cover" />
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute right-2 top-2"
                    aria-label="Remove selected photo"
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInput.current?.click()}
                >
                  <ImagePlus className="mr-2 h-4 w-4" /> Add a photo
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                JPG, PNG or WebP up to 5 MB. The photo cannot be changed later.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Save changes" : "Publish post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
