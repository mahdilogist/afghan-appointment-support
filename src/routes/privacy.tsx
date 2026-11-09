import { createFileRoute } from "@tanstack/react-router";
import { Ban, Clock, Eye, FileText, FlaskConical, UserCheck } from "lucide-react";

import { PublicShell } from "@/components/public-shell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "حریم خصوصی · Privacy notice — Afghan Free Appointment" },
      {
        name: "description",
        content: "What we collect, what we never collect, who can see requests, and how long they are kept.",
      },
      { property: "og:title", content: "Privacy notice — Afghan Free Appointment" },
      { property: "og:description", content: "Data minimization and least-privilege access by design." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t } = useI18n();
  const sections = [
    { icon: FileText, title: t("privacyCollectTitle"), body: t("privacyCollectBody") },
    { icon: Ban, title: t("privacyNotCollectTitle"), body: t("privacyNotCollectBody") },
    { icon: Eye, title: t("privacyAccessTitle"), body: t("privacyAccessBody") },
    { icon: Clock, title: t("privacyRetentionTitle"), body: t("privacyRetentionBody") },
    { icon: UserCheck, title: t("privacyRightsTitle"), body: t("privacyRightsBody") },
  ];
  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-semibold">{t("privacyTitle")}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t("privacyIntro")}</p>

        <div className="mt-8 flex gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-5 text-warning-foreground">
          <FlaskConical className="mt-1 size-5 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">{t("privacyPrototypeTitle")}</h2>
            <p className="text-sm">{t("privacyPrototypeBody")}</p>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {sections.map((s) => (
            <section key={s.title} className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                <s.icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">{s.title}</h2>
                <p className="mt-1 text-muted-foreground">{s.body}</p>
              </div>
            </section>
          ))}
        </div>

        <p className="mt-10 text-sm text-muted-foreground">{t("independentNotice")}</p>
      </div>
    </PublicShell>
  );
}
