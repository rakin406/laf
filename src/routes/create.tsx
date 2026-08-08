import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";

import { AppShell, RequireAuth } from "@/components/layout/AppShell";
import { PostFormDialog } from "@/components/posts/PostFormDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { fetchCategories, fetchPostingEligibility } from "@/lib/queries";
import { tomorrowLabelInDhaka } from "@/lib/domain";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Report a lost item — AIUB Lost & Found" },
      {
        name: "description",
        content:
          "Publish one lost-item report per day with a photo, category and the date you lost it.",
      },
      { property: "og:title", content: "Report a lost item — AIUB Lost & Found" },
      {
        property: "og:description",
        content: "Publish a lost-item report for the AIUB student community.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <RequireAuth>
        <CreatePost />
      </RequireAuth>
    </AppShell>
  ),
});

function CreatePost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id ?? "";
  const [open, setOpen] = useState(true);

  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const quotaQuery = useQuery({
    queryKey: ["quota", userId],
    queryFn: () => fetchPostingEligibility(userId),
    enabled: Boolean(userId),
  });

  const canPost = quotaQuery.data?.canPost ?? true;

  return (
    <div className="mx-auto max-w-xl space-y-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Report a lost item</h1>

      {quotaQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Checking today's posting limit…</p>
      ) : canPost ? (
        <>
          <p className="text-sm text-muted-foreground">
            You have one post available today. Add clear details so other students can recognise
            your item.
          </p>
          <Button onClick={() => setOpen(true)}>Open the post form</Button>
        </>
      ) : (
        <div className="surface-panel flex flex-col items-center gap-3 p-8 text-center">
          <CalendarClock className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold">You've used today's post</h2>
          <p className="text-sm text-muted-foreground">
            Each student can publish one lost-and-found post per day. You can post again on{" "}
            {tomorrowLabelInDhaka()}.
          </p>
          <Button variant="outline" onClick={() => void navigate({ to: "/" })}>
            Back to the feed
          </Button>
        </div>
      )}

      {userId && canPost ? (
        <PostFormDialog
          open={open}
          onOpenChange={setOpen}
          categories={categoriesQuery.data ?? []}
          userId={userId}
          onSaved={() => {
            void quotaQuery.refetch();
            void navigate({ to: "/" });
          }}
        />
      ) : null}
    </div>
  );
}
