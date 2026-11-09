import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, HandHeart, Info, Landmark, Lock, Users } from "lucide-react";

import heroImage from "@/assets/hero-family.jpg";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "نوبت رایگان افغان · Afghan Free Appointment" },
      {
        name: "description",
        content:
          "Free, volunteer-run help for Afghan families requesting identity-verification appointments. Independent initiative, not a government service.",
      },
      { property: "og:title", content: "Afghan Free Appointment — free volunteer help" },
      {
        property: "og:description",
        content: "Submit one request per family member. Volunteers review every request by hand. Always free.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { t, dir } = useI18n();
  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;

  const points = [
    { icon: HandHeart, title: t("pointFreeTitle"), body: t("pointFreeBody") },
    { icon: Users, title: t("pointVolunteerTitle"), body: t("pointVolunteerBody") },
    { icon: Lock, title: t("pointPrivacyTitle"), body: t("pointPrivacyBody") },
    { icon: Landmark, title: t("pointIndependentTitle"), body: t("pointIndependentBody") },
  ];
  const steps = [
    { title: t("howStep1Title"), body: t("howStep1Body") },
    { title: t("howStep2Title"), body: t("howStep2Body") },
    { title: t("howStep3Title"), body: t("howStep3Body") },
  ];

  return (
    <PublicShell>
      <section className="bg-lattice">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[1.05fr_1fr] md:py-20">
          <div className="space-y-6">
            <p className="inline-flex rounded-full border border-primary/20 bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
              {t("heroEyebrow")}
            </p>
            <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">{t("heroTitle")}</h1>
            <p className="max-w-xl text-lg text-muted-foreground">{t("heroBody")}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="hero" size="xl">
                <Link to="/request">
                  {t("heroCta")}
                  <Arrow aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="xl" className="rounded-full">
                <Link to="/privacy">{t("heroSecondary")}</Link>
              </Button>
            </div>
            <p className="max-w-xl text-sm text-muted-foreground">{t("independentNotice")}</p>
          </div>
          <div className="relative">
            <img
              src={heroImage}
              alt=""
              width={1536}
              height={1024}
              className="aspect-[4/3] w-full rounded-3xl object-cover shadow-lift"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <div className="-mt-6 flex gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-5 text-warning-foreground shadow-soft md:-mt-10">
          <Info className="mt-1 size-5 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">{t("noGuaranteeTitle")}</h2>
            <p className="text-sm">{t("noGuarantee")}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-16">
        <h2 className="text-2xl font-semibold">{t("pointsTitle")}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {points.map((p) => (
            <div key={p.title} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <span className="grid size-10 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                <p.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold">{p.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-16">
        <h2 className="text-2xl font-semibold">{t("howTitle")}</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border border-border bg-card p-6 shadow-soft">
              <span className="font-display text-3xl font-semibold text-primary/70">
                {new Intl.NumberFormat(dir === "rtl" ? "fa-AF" : "en").format(i + 1)}
              </span>
              <h3 className="mt-2 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex justify-center">
          <Button asChild variant="hero" size="xl">
            <Link to="/request">
              {t("heroCta")}
              <Arrow aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
    </PublicShell>
  );
}
