import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ClipboardCheck,
  ClipboardList,
  History,
  LogOut,
  Settings2,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { useState } from "react";

import { SetupGuide } from "@/components/setup-guide";
import { LanguageToggle } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { currentUserQuery } from "@/lib/admin-queries";
import { useI18n } from "@/lib/i18n";
import { claimAdminAccess } from "@/lib/requests.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Volunteer dashboard — Afghan Free Appointment" },
      { name: "description", content: "Protected review dashboard for volunteer administrators." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Volunteer dashboard — Afghan Free Appointment" },
      {
        property: "og:description",
        content: "Protected review dashboard for volunteer administrators.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useQuery(currentUserQuery);

  async function signOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/auth" });
  }

  const navItem =
    "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-foreground/75 hover:bg-muted hover:text-foreground";

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/admin" className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"
            >
              <ShieldCheck className="size-5" />
            </span>
            <span className="font-display font-semibold">{t("appName")}</span>
          </Link>
          {me.data?.isAdmin && (
            <nav aria-label="Admin" className="flex flex-wrap items-center gap-1">
              <Link
                to="/admin"
                activeOptions={{ exact: true }}
                className={navItem}
                activeProps={{ className: "bg-primary-soft text-primary font-medium" }}
              >
                <ClipboardList className="size-4" aria-hidden="true" />
                {t("adminDashboard")}
              </Link>
              <Link
                to="/admin/desk"
                className={navItem}
                activeProps={{ className: "bg-primary-soft text-primary font-medium" }}
              >
                <ClipboardCheck className="size-4" aria-hidden="true" />
                {t("adminDesk")}
              </Link>
              <Link
                to="/admin/audit"
                className={navItem}
                activeProps={{ className: "bg-primary-soft text-primary font-medium" }}
              >
                <History className="size-4" aria-hidden="true" />
                {t("adminAudit")}
              </Link>
              <Link
                to="/admin/settings"
                className={navItem}
                activeProps={{ className: "bg-primary-soft text-primary font-medium" }}
              >
                <Settings2 className="size-4" aria-hidden="true" />
                {t("adminSettings")}
              </Link>
            </nav>
          )}
          <div className="flex items-center gap-2">
            {me.data && (
              <span className="hidden text-xs text-muted-foreground md:inline" dir="ltr">
                {me.data.email}
              </span>
            )}
            <LanguageToggle />
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut aria-hidden="true" />
              {t("adminSignOut")}
            </Button>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-8">
        {me.isPending ? (
          <p className="text-muted-foreground">{t("adminLoading")}</p>
        ) : me.isError ? (
          <p role="alert" className="text-destructive">
            {t("errGeneric")}
          </p>
        ) : me.data.isAdmin ? (
          <Outlet />
        ) : (
          <NoAccess />
        )}
      </main>
    </div>
  );
}

function NoAccess() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const claim = useServerFn(claimAdminAccess);
  const [pending, setPending] = useState(false);
  const [denied, setDenied] = useState(false);

  async function activate() {
    setPending(true);
    setDenied(false);
    try {
      const res = await claim();
      if (res.granted) await queryClient.invalidateQueries({ queryKey: currentUserQuery.queryKey });
      else setDenied(true);
    } catch {
      setDenied(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-3xl border border-border bg-card p-7 shadow-soft">
        <ShieldOff className="size-8 text-warning" aria-hidden="true" />
        <h1 className="mt-3 text-2xl font-semibold">{t("noAccessTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("noAccessBody")}</p>
        <Button variant="hero" size="lg" className="mt-5" onClick={activate} disabled={pending}>
          {t("noAccessActivate")}
        </Button>
        {denied && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-warning-soft p-3 text-sm text-warning-foreground"
          >
            {t("noAccessNotAllowed")}
          </p>
        )}
      </div>
      <SetupGuide />
    </div>
  );
}
