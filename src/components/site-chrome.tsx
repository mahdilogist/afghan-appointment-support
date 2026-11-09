import { Link } from "@tanstack/react-router";
import { FlaskConical, Languages, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function TestDataBanner() {
  const { t } = useI18n();
  return (
    <div role="note" className="border-b border-warning/30 bg-warning-soft text-warning-foreground">
      <div className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 text-sm sm:items-center">
        <FlaskConical className="mt-0.5 size-4 shrink-0 sm:mt-0" aria-hidden="true" />
        <p>
          <strong className="font-semibold">{t("testBannerTitle")}.</strong> {t("testBanner")}
        </p>
      </div>
    </div>
  );
}

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n();
  const next = lang === "fa" ? "en" : "fa";
  return (
    <Button
      variant="soft"
      size="sm"
      onClick={() => setLang(next)}
      aria-label={t("langSwitchLabel")}
      lang={next}
    >
      <Languages aria-hidden="true" />
      {t("langSwitch")}
    </Button>
  );
}

export function SiteHeader() {
  const { t } = useI18n();
  return (
    <header className="border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5 rounded-md">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft"
          >
            <ShieldCheck className="size-5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-base font-semibold">{t("appName")}</span>
            <span className="hidden text-xs text-muted-foreground sm:block">
              {t("heroEyebrow")}
            </span>
          </span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          <Link
            to="/request"
            className="rounded-full px-3 py-1.5 text-foreground/80 hover:bg-muted hover:text-foreground"
            activeProps={{ className: "bg-muted text-foreground font-medium" }}
          >
            {t("navRequest")}
          </Link>
          <Link
            to="/privacy"
            className="rounded-full px-3 py-1.5 text-foreground/80 hover:bg-muted hover:text-foreground"
            activeProps={{ className: "bg-muted text-foreground font-medium" }}
          >
            {t("navPrivacy")}
          </Link>
          <LanguageToggle />
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-16 border-t border-border/70 bg-muted/50">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 text-sm text-muted-foreground sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-2">
          <p className="font-medium text-foreground">{t("appName")}</p>
          <p className="max-w-2xl">{t("independentNotice")}</p>
          <p>{t("footerFree")}</p>
        </div>
        <div className="flex gap-4">
          <Link to="/privacy" className="hover:text-foreground">
            {t("navPrivacy")}
          </Link>
          <Link to="/auth" className="hover:text-foreground">
            {t("navVolunteer")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
