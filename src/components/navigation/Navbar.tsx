import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bookmark,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Shield,
  Sun,
  User as UserIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Feed", icon: Search },
  { to: "/saved", label: "Saved", icon: Bookmark },
] as const;

export function Navbar() {
  const { status, profile, user, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const signedIn = status === "authenticated";
  const displayName = profile?.full_name ?? "AIUB student";

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4"
      >
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            LF
          </span>
          <span className="hidden sm:inline">AIUB Lost &amp; Found</span>
        </Link>

        {signedIn ? (
          <div className="ml-4 hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  pathname === link.to && "bg-secondary text-secondary-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
            {isAdmin ? (
              <Link
                to="/admin"
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  pathname === "/admin" && "bg-secondary text-secondary-foreground",
                )}
              >
                Admin
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {signedIn ? (
            <>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link to="/create">
                  <Plus className="mr-1 h-4 w-4" /> New post
                </Link>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label="Account menu"
                  >
                    <UserAvatar
                      name={displayName}
                      avatarUrl={profile?.avatar_url ?? null}
                      seed={user?.id ?? displayName}
                      size="sm"
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">
                    {displayName}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {profile?.email}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/settings">
                      <UserIcon className="mr-2 h-4 w-4" /> Profile &amp; my posts
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/saved">
                      <Bookmark className="mr-2 h-4 w-4" /> Saved posts
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin ? (
                    <DropdownMenuItem asChild>
                      <Link to="/admin">
                        <Shield className="mr-2 h-4 w-4" /> Admin dashboard
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void handleSignOut()}>
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64">
                  <SheetTitle className="mb-4">Menu</SheetTitle>
                  <div className="flex flex-col gap-1">
                    <Link to="/" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-accent">
                      Feed
                    </Link>
                    <Link to="/create" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-accent">
                      New post
                    </Link>
                    <Link to="/saved" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-accent">
                      Saved
                    </Link>
                    <Link to="/settings" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-accent">
                      Profile &amp; my posts
                    </Link>
                    {isAdmin ? (
                      <Link to="/admin" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-accent">
                        Admin dashboard
                      </Link>
                    ) : null}
                  </div>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
}
