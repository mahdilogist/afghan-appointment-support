import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge, TestDataTag } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { currentUserQuery, requestDetailQuery, settingsQuery } from "@/lib/admin-queries";
import type { DictKey } from "@/lib/i18n-dictionary";
import { useI18n } from "@/lib/i18n";
import { allowedStatusChanges, canApprove, errorKeyFor, type RequestStatus } from "@/lib/request-rules";

export const Route = createFileRoute("/_authenticated/admin/requests/$id")({
  component: RequestDetail,
});

const ACTION_LABEL: Record<RequestStatus, DictKey> = {
  pending_review: "actReopen",
  needs_clarification: "actClarify",
  approved: "actApprove",
  in_progress: "actInProgress",
  completed: "actComplete",
  rejected: "actReject",
};

const AUDIT_LABEL: Record<string, DictKey> = {
  submitted: "actionSubmitted",
  approved: "actionApproved",
  approval_recorded: "actionApprovalRecorded",
  status_changed: "actionStatusChanged",
  note_added: "actionNoteAdded",
  settings_updated: "actionSettingsUpdated",
};

function RequestDetail() {
  const { id } = Route.useParams();
  const { t, formatDate, formatNumber, dir } = useI18n();
  const qc = useQueryClient();
  const me = useQuery(currentUserQuery);
  const settings = useQuery(settingsQuery);
  const detail = useQuery(requestDetailQuery(id));
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const Back = dir === "rtl" ? ArrowRight : ArrowLeft;

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });
  const onError = (e: unknown) => toast.error(t(errorKeyFor(e)));

  const approve = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_approve", { p_request_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("actionDone")); refresh(); },
    onError,
  });
  const setStatus = useMutation({
    mutationFn: async (status: RequestStatus) => {
      const { error } = await supabase.rpc("admin_set_status", {
        p_request_id: id,
        p_status: status,
        p_reason: reason.trim().slice(0, 500) || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => { setReason(""); toast.success(t("actionDone")); refresh(); },
    onError,
  });
  const addNote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_add_note", { p_request_id: id, p_body: note.trim().slice(0, 2000) });
      if (error) throw error;
    },
    onSuccess: () => { setNote(""); refresh(); },
    onError,
  });

  if (detail.isPending || me.isPending || settings.isPending) return <p className="text-muted-foreground">{t("adminLoading")}</p>;
  if (detail.isError || !detail.data.request) return <p role="alert" className="text-destructive">{t("errNotFound")}</p>;

  const { request: r, approvals, notes, audit } = detail.data;
  const status = r.status as RequestStatus;
  const policy = settings.data?.approval_policy ?? null;
  const approveCheck = canApprove({
    policy,
    status,
    approverIds: approvals.map((a) => a.admin_id),
    currentAdminId: me.data?.id ?? "",
  });
  const changes = allowedStatusChanges(status);
  const busy = approve.isPending || setStatus.isPending;
  const required = policy === "two_person" ? 2 : 1;

  return (
    <div className="space-y-6">
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
        <Back className="size-4" aria-hidden="true" />
        {t("detailBack")}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{r.full_name}</h1>
        <StatusBadge status={status} />
        {r.is_test_data && <TestDataTag />}
        <span className="ltr-nums font-mono text-sm text-muted-foreground">{r.reference_code}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-semibold">{t("detailApplicant")}</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <Item label={t("detailPhone")}><span className="ltr-nums">{r.phone}</span></Item>
              <Item label={t("detailCity")}>{r.city}</Item>
              <Item label={t("detailMembers")}>{formatNumber(r.family_members)}</Item>
              <Item label={t("detailLanguage")}>{r.language === "fa" ? "دری" : "English"}</Item>
              <Item label={t("detailSubmitted")}>{formatDate(r.created_at)}</Item>
              <Item label={t("detailUpdated")}>{formatDate(r.updated_at)}</Item>
              <div className="sm:col-span-2">
                <Item label={t("detailNote")}>{r.note || <span className="text-muted-foreground">{t("detailNoNote")}</span>}</Item>
              </div>
            </dl>
          </section>

          <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-semibold">{t("notesTitle")}</h2>
            <p className="text-xs text-muted-foreground">{t("notesHint")}</p>
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => { e.preventDefault(); if (note.trim()) addNote.mutate(); }}
            >
              <Textarea aria-label={t("notesPlaceholder")} placeholder={t("notesPlaceholder")} rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
              <Button type="submit" size="sm" disabled={!note.trim() || addNote.isPending}>{t("notesAdd")}</Button>
            </form>
            <ul className="mt-4 space-y-3">
              {notes.length === 0 && <li className="text-sm text-muted-foreground">{t("notesEmpty")}</li>}
              {notes.map((n) => (
                <li key={n.id} className="rounded-xl bg-muted/60 p-3 text-sm">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground"><span dir="ltr">{n.author_email === "demo-seed" ? t("auditSeed") : n.author_email}</span> · {formatDate(n.created_at)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-semibold">{t("detailActions")}</h2>
            {policy === null && (
              <div className="mt-3 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning-foreground">
                <p>{t("policyUnsetWarning")}</p>
                <Link to="/admin/settings" className="mt-1 inline-block font-medium underline">{t("goToSettings")}</Link>
              </div>
            )}
            {(status === "pending_review" || status === "needs_clarification") && policy !== null && (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("detailApprovals")}: {t("approvalsProgress", { count: approvals.length, required })}
                {approvals.length > 0 && (
                  <span className="block text-xs" dir="ltr">{approvals.map((a) => a.admin_email).join(", ")}</span>
                )}
              </p>
            )}
            <div className="mt-4 space-y-1.5">
              <label htmlFor="reason" className="text-xs text-muted-foreground">{t("reasonLabel")}</label>
              <Input id="reason" placeholder={t("reasonPlaceholder")} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(status === "pending_review" || status === "needs_clarification") && (
                <Button onClick={() => approve.mutate()} disabled={busy || !approveCheck.ok} title={!approveCheck.ok ? t(approveCheck.reason === "policy_unset" ? "errPolicyUnset" : approveCheck.reason === "already_approved_by_you" ? "errAlreadyApproved" : "errInvalidTransition") : undefined}>
                  {t("actApprove")}
                </Button>
              )}
              {changes.map((s) => (
                <Button key={s} variant={s === "rejected" ? "destructive" : "outline"} onClick={() => setStatus.mutate(s)} disabled={busy}>
                  {t(ACTION_LABEL[s])}
                </Button>
              ))}
              {changes.length === 0 && status !== "pending_review" && status !== "needs_clarification" && (
                <p className="text-sm text-muted-foreground">{t("noActions")}</p>
              )}
            </div>
            {approveCheck.ok === false && approveCheck.reason === "already_approved_by_you" && (
              <p className="mt-3 text-xs text-muted-foreground">{t("errAlreadyApproved")}</p>
            )}
          </section>

          <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-semibold">{t("auditTitle")}</h2>
            <ol className="mt-3 space-y-3 border-s border-border ps-4">
              {audit.length === 0 && <li className="text-sm text-muted-foreground">{t("auditEmpty")}</li>}
              {audit.map((a) => (
                <li key={a.id} className="text-sm">
                  <p className="font-medium">
                    {t(AUDIT_LABEL[a.action] ?? "actionStatusChanged")}
                    {a.to_status && a.from_status !== a.to_status && (
                      <span className="ms-2 inline-flex"><StatusBadge status={a.to_status as RequestStatus} /></span>
                    )}
                  </p>
                  {a.details && <p className="text-muted-foreground">{a.details}</p>}
                  <p className="text-xs text-muted-foreground">
                    <span dir="ltr">{a.actor_email === "demo-seed" ? t("auditSeed") : a.actor_email ?? t("auditSystem")}</span> · {formatDate(a.created_at)}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
