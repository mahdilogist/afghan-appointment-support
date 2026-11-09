import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";

import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "ورود داوطلبان · Volunteer sign-in — Afghan Free Appointment" },
      {
        name: "description",
        content: "Sign-in for volunteer administrators only. There is no public sign-up.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Volunteer sign-in — Afghan Free Appointment" },
      { property: "og:description", content: "Sign-in for volunteer administrators only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email().max(255);

function AuthPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/admin" });
    });
  }, [navigate]);

  async function onSignIn(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success || password.length < 1) {
      setMessage({ kind: "error", text: t("authFailed") });
      return;
    }
    setPending(true);
    const { error } = await supabase.auth.signInWithPassword({ email: parsed.data, password });
    setPending(false);
    if (error) {
      setMessage({ kind: "error", text: t("authFailed") });
      return;
    }
    navigate({ to: "/admin" });
  }

  async function onForgot(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const parsed = emailSchema.safeParse(email);
    if (parsed.success) {
      setPending(true);
      await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setPending(false);
    }
    // Same message either way, so the form does not reveal which emails have accounts.
    setMessage({ kind: "info", text: t("authResetSent") });
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-md px-4 py-14">
        <div className="rounded-3xl border border-border bg-card p-7 shadow-soft">
          <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
            <KeyRound className="size-5" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold">{t("authTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("authIntro")}</p>

          <form onSubmit={mode === "signin" ? onSignIn : onForgot} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("authEmail")}</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {mode === "signin" && (
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("authPassword")}</Label>
                <Input
                  id="password"
                  type="password"
                  dir="ltr"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            {message && (
              <p
                role={message.kind === "error" ? "alert" : "status"}
                className={
                  message.kind === "error"
                    ? "rounded-xl bg-status-rejected-soft p-3 text-sm text-destructive"
                    : "rounded-xl bg-primary-soft p-3 text-sm text-primary"
                }
              >
                {message.text}
              </p>
            )}
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={pending}>
              {mode === "signin"
                ? pending
                  ? t("authSigningIn")
                  : t("authSignIn")
                : t("authSendReset")}
            </Button>
          </form>
          <button
            type="button"
            className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => {
              setMessage(null);
              setMode(mode === "signin" ? "forgot" : "signin");
            }}
          >
            {mode === "signin" ? t("authForgot") : t("authBackToSignIn")}
          </button>
        </div>
      </div>
    </PublicShell>
  );
}
