import { useI18n } from "@/lib/i18n";

export function SetupGuide() {
  const { t } = useI18n();
  return (
    <section className="rounded-3xl border border-border bg-card p-7 shadow-soft">
      <h2 className="text-lg font-semibold">{t("setupTitle")}</h2>
      <ol className="mt-3 list-decimal space-y-2 ps-5 text-sm text-muted-foreground">
        <li>{t("setupStep1")}</li>
        <li>{t("setupStep2")}</li>
        <li>{t("setupStep3")}</li>
        <li>{t("setupStep4")}</li>
      </ol>
    </section>
  );
}
