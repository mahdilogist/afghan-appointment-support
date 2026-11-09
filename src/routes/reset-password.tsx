import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Afghan Free Appointment" },
      { name: "description", content: "Choose a new password for a volunteer administrator account." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Reset password — Afghan Free Appointment" },
      { property: "og:description", content: "Choose a new volunteer password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useI18n();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => setReady(isRecovery || !!s.session));
    return () => data.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError(t("resetTooShort"));
      return;
    }
    setPending(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (err) {
      setError(t("errGeneric"));
      return;
    }
    setDone(true);
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-md px-4 py-14">
        <div className="rounded-3xl border border-border bg-card p-7 shadow-soft">
          <h1 className="text-2xl font-semibold">{t("resetTitle")}</h1>
          {ready === false && <p className="mt-4 text-sm text-muted-foreground">{t("resetInvalid")}</p>}
          {done ? (
            <div className="mt-4 space-y-4">
              <p role="status" className="rounded-xl bg-primary-soft p-3 text-sm text-primary">
                {t("resetDone")}
              </p>
              <Button asChild variant="hero" size="lg" className="w-full">
                <Link to="/admin">{t("adminDashboard")}</Link>
              </Button>
            </div>
          ) : (
            ready && (
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">{t("resetNew")}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    dir="ltr"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={pending}>
                  {t("resetSave")}
                </Button>
              </form>
            )
          )}
        </div>
      </div>
    </PublicShell>
  );
}
