import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Copy, ShieldAlert, UserRound } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";

import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DictKey } from "@/lib/i18n-dictionary";
import { useI18n } from "@/lib/i18n";
import { normalizeDigits, requestSchema } from "@/lib/request-schema";
import { submitRequest } from "@/lib/requests.functions";

export const Route = createFileRoute("/request")({
  head: () => ({
    meta: [
      { title: "ثبت درخواست · Submit a request — Afghan Free Appointment" },
      {
        name: "description",
        content: "Request free volunteer help for one family member. Minimal details only — no ID numbers or documents.",
      },
      { property: "og:title", content: "Submit a request — Afghan Free Appointment" },
      { property: "og:description", content: "One request per family member. Free and reviewed by volunteers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestPage,
});

type FieldName = "fullName" | "phone" | "city" | "familyMembers" | "note" | "consent";
const EMPTY = { fullName: "", phone: "", city: "", familyMembers: "1", note: "", website: "" };

function RequestPage() {
  const { t, lang } = useI18n();
  const submit = useServerFn(submitRequest);
  const [values, setValues] = useState(EMPTY);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldName, DictKey>>>({});
  const [formError, setFormError] = useState<DictKey | null>(null);
  const [pending, setPending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const set = (name: keyof typeof EMPTY) => (value: string) => setValues((v) => ({ ...v, [name]: value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const payload = {
      ...values,
      familyMembers: normalizeDigits(values.familyMembers),
      consent,
      language: lang,
    };
    const parsed = requestSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Partial<Record<FieldName, DictKey>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as FieldName;
        if (!next[field]) next[field] = issue.message as DictKey;
      }
      setErrors(next);
      const first = Object.keys(next)[0];
      if (first) document.getElementById(`field-${first}`)?.focus();
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const res = await submit({ data: payload });
      setReference(res.reference);
      setValues(EMPTY);
      setConsent(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setFormError("errSubmitFailed");
    } finally {
      setPending(false);
    }
  }

  if (reference) {
    return (
      <PublicShell>
        <SuccessPanel reference={reference} onAnother={() => setReference(null)} />
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl px-4 py-10 md:py-14">
        <h1 className="text-3xl font-semibold">{t("formTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("formIntro")}</p>

        <div className="mt-6 flex gap-3 rounded-2xl border border-primary/20 bg-primary-soft p-4 text-primary">
          <UserRound className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p className="text-sm font-medium">{t("formOneMember")}</p>
        </div>

        <form onSubmit={onSubmit} noValidate className="mt-8 space-y-6 rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
          <Field name="fullName" label={t("fieldName")} hint={t("fieldNameHint")} error={errors.fullName}>
            {(props) => (
              <Input {...props} autoComplete="name" maxLength={120} value={values.fullName} onChange={(e) => set("fullName")(e.target.value)} />
            )}
          </Field>
          <Field name="phone" label={t("fieldPhone")} hint={t("fieldPhoneHint")} error={errors.phone}>
            {(props) => (
              <Input
                {...props}
                type="tel"
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                maxLength={20}
                className="text-start"
                value={values.phone}
                onChange={(e) => set("phone")(e.target.value)}
              />
            )}
          </Field>
          <div className="grid gap-6 sm:grid-cols-[1fr_200px]">
            <Field name="city" label={t("fieldCity")} hint={t("fieldCityHint")} error={errors.city}>
              {(props) => (
                <Input {...props} autoComplete="address-level2" maxLength={80} value={values.city} onChange={(e) => set("city")(e.target.value)} />
              )}
            </Field>
            <Field name="familyMembers" label={t("fieldFamily")} error={errors.familyMembers}>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={1}
                  max={20}
                  inputMode="numeric"
                  value={values.familyMembers}
                  onChange={(e) => set("familyMembers")(e.target.value)}
                />
              )}
            </Field>
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">{t("fieldFamilyHint")}</p>
          <Field name="note" label={t("fieldNote")} hint={t("fieldNoteHint")} error={errors.note}>
            {(props) => (
              <Textarea {...props} rows={3} maxLength={500} value={values.note} onChange={(e) => set("note")(e.target.value)} />
            )}
          </Field>

          {/* Honeypot for bots; hidden from people and assistive technology. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => set("website")(e.target.value)} />
            </label>
          </div>

          <div className="space-y-2 rounded-2xl border border-border bg-muted/60 p-4 text-sm">
            <h2 className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="size-4 text-primary" aria-hidden="true" />
              {t("privacyNoticeTitle")}
            </h2>
            <p className="text-muted-foreground">{t("privacyNoticeBody")}</p>
            <Link to="/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
              {t("privacyNoticeLink")}
            </Link>
          </div>

          <div className="space-y-1">
            <div className="flex items-start gap-3">
              <Checkbox
                id="field-consent"
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                aria-invalid={!!errors.consent}
                aria-describedby={errors.consent ? "err-consent" : undefined}
                className="mt-1"
              />
              <Label htmlFor="field-consent" className="text-sm font-normal leading-relaxed">
                {t("consentLabel")}
              </Label>
            </div>
            {errors.consent && (
              <p id="err-consent" className="text-sm text-destructive">
                {t(errors.consent)}
              </p>
            )}
          </div>

          {formError && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-status-rejected-soft p-3 text-sm text-destructive">
              {t(formError)}
            </p>
          )}

          <Button type="submit" variant="hero" size="xl" className="w-full" disabled={pending}>
            {pending ? t("submitting") : t("submit")}
          </Button>
        </form>
      </div>
    </PublicShell>
  );
}

function Field({
  name,
  label,
  hint,
  error,
  children,
}: {
  name: FieldName;
  label: string;
  hint?: string;
  error?: DictKey;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const { t } = useI18n();
  const hintId = useId();
  const errId = useId();
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`field-${name}`}>{label}</Label>
      {children({ id: `field-${name}`, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-sm text-destructive">
          {t(error)}
        </p>
      )}
    </div>
  );
}

function SuccessPanel({ reference, onAnother }: { reference: string; onAnother: () => void }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <div role="status" className="rounded-3xl border border-border bg-card p-8 text-center shadow-lift">
        <CheckCircle2 className="mx-auto size-12 text-status-completed" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold">{t("successTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("successBody")}</p>
        <div className="mt-6 rounded-2xl bg-primary-soft p-5">
          <p className="text-sm text-primary">{t("successRefLabel")}</p>
          <p className="ltr-nums mt-1 font-mono text-3xl font-semibold tracking-wider text-primary">{reference}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={async () => {
              await navigator.clipboard?.writeText(reference);
              setCopied(true);
            }}
          >
            <Copy aria-hidden="true" />
            {copied ? "✓" : "Copy"}
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{t("successRefHint")}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="hero" size="lg" onClick={onAnother}>
            {t("successAnother")}
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full">
            <Link to="/">{t("successHome")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
