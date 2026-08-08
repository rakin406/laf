import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navigation/Navbar";
import { useAuth } from "@/hooks/useAuth";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        AIUB Lost &amp; Found — a private community for verified AIUB students.
      </footer>
    </div>
  );
}

/** Client-side gate: content is only rendered for signed-in, non-banned students. */
export function RequireAuth({
  children,
  adminOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
}) {
  const { status, profile, isAdmin } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" aria-busy="true">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="sr-only">Checking your session</span>
      </div>
    );
  }

  if (status === "anonymous") {
    return (
      <div className="surface-panel mx-auto mt-10 max-w-md p-8 text-center">
        <LockKeyhole className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">Students only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with your AIUB student email to browse lost and found posts.
        </p>
        <Button asChild className="mt-6">
          <Link to="/auth">Sign in or register</Link>
        </Button>
      </div>
    );
  }

  if (profile?.is_banned) {
    return (
      <div className="surface-panel mx-auto mt-10 max-w-md border-destructive/40 p-8 text-center">
        <h1 className="text-xl font-semibold text-destructive">Account suspended</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {profile.banned_reason ?? "A moderator has suspended your account."} You can still read
          posts, but posting, commenting and saving are disabled.
        </p>
      </div>
    );
  }

  if (adminOnly && !isAdmin) {
    return (
      <div className="surface-panel mx-auto mt-10 max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Admins only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have permission to open the moderation dashboard.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
