import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { AIUB_EMAIL_MESSAGE, friendlyError, loginSchema, registerSchema } from "@/lib/domain";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — AIUB Lost & Found" },
      {
        name: "description",
        content:
          "Sign in or register with your AIUB student email to use the campus lost-and-found board.",
      },
      { property: "og:title", content: "Sign in — AIUB Lost & Found" },
      {
        property: "og:description",
        content: "Verified AIUB student access to the campus lost-and-found board.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [signIn, setSignIn] = useState({ email: "", password: "" });
  const [signUp, setSignUp] = useState({ fullName: "", email: "", password: "" });
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    const parsed = loginSchema.safeParse(signIn);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? AIUB_EMAIL_MESSAGE);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error) throw error;
      toast.success("Welcome back!");
      void navigate({ to: "/" });
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(event: React.FormEvent) {
    event.preventDefault();
    const parsed = registerSchema.safeParse(signUp);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? AIUB_EMAIL_MESSAGE);
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: parsed.data.fullName },
        },
      });
      if (error) throw error;
      if (data.session) {
        toast.success("Account created");
        void navigate({ to: "/" });
      } else {
        setCheckEmail(true);
      }
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md py-6">
        <h1 className="text-center text-2xl font-semibold tracking-tight">AIUB Lost &amp; Found</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Only verified AIUB student emails can join.
        </p>

        {checkEmail ? (
          <div className="surface-panel mt-6 p-6 text-center">
            <h2 className="text-lg font-semibold">Confirm your email</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a confirmation link to <strong>{signUp.email}</strong>. Click it to activate
              your account, then sign in.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => setCheckEmail(false)}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="signin" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="surface-panel space-y-4 p-6" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Student email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    placeholder="23-12345-1@student.aiub.edu"
                    value={signIn.email}
                    onChange={(event) =>
                      setSignIn((prev) => ({ ...prev, email: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    autoComplete="current-password"
                    value={signIn.password}
                    onChange={(event) =>
                      setSignIn((prev) => ({ ...prev, password: event.target.value }))
                    }
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="surface-panel space-y-4 p-6" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full name</Label>
                  <Input
                    id="signup-name"
                    autoComplete="name"
                    value={signUp.fullName}
                    onChange={(event) =>
                      setSignUp((prev) => ({ ...prev, fullName: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Student email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    placeholder="23-12345-1@student.aiub.edu"
                    value={signUp.email}
                    onChange={(event) =>
                      setSignUp((prev) => ({ ...prev, email: event.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">{AIUB_EMAIL_MESSAGE}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    value={signUp.password}
                    onChange={(event) =>
                      setSignUp((prev) => ({ ...prev, password: event.target.value }))
                    }
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}
