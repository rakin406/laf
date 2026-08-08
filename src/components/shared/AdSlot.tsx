import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Reserved, non-intrusive advertising slot. Rendering is opt-in per page so an
 * ad provider can be wired in later without touching post/comment code.
 */
export function AdSlot({
  id,
  format = "leaderboard",
  className,
  children,
}: {
  id: string;
  format?: "leaderboard" | "rectangle";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <aside
      data-ad-slot={id}
      aria-label="Advertisement space"
      className={cn(
        "hidden items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/40 text-xs text-muted-foreground md:flex",
        format === "leaderboard" ? "h-24 w-full" : "h-64 w-full",
        className,
      )}
    >
      {children ?? null}
    </aside>
  );
}
