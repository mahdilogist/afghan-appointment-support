import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Copy,
  Inbox,
  Info,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { StatusBadge, TestDataTag } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  deskQueueQuery,
  settingsQuery,
  type DeskRequest,
  type RecordSource,
} from "@/lib/admin-queries";
import {
  DESK_NEXT_STATUS,
  deskAuditReason,
  formatDeskSummary,
  isDeskStatus,
  receiptNoteBody,
  type DeskStatus,
} from "@/lib/desk";
import type { DictKey } from "@/lib/i18n-dictionary";
import { useI18n } from "@/lib/i18n";
import { errorKeyFor } from "@/lib/request-rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/desk")({
  component: RapidDesk,
});

type StatusFilter = "both" | DeskStatus;

function RapidDesk() {
  const { t, formatNumber } = useI18n();
  const settings = useQuery(settingsQuery);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("both");
  const [source, setSource] = useState<RecordSource>("all");
  const order = settings.data?.queue_order ?? "oldest_first";
  const queue = useQuery({
    ...deskQueueQuery({ order, source }),
    enabled: settings.isSuccess || settings.isError,
  });

  const items = useMemo(
    () =>
      (queue.data ?? []).filter((r) => statusFilter === "both" || r.status === statusFilter),
    [queue.data, statusFilter],
  );

  // Selection lives in memory only — never in the URL — so no personal data leaks into links.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastIndex, setLastIndex] = useState(0);
  const found = items.findIndex((r) => r.id === selectedId);
  const index = found >= 0 ? found : Math.min(lastIndex, items.length - 1);
  const current = index >= 0 ? items[index] : undefined;
  useEffect(() => {
    if (index >= 0) setLastIndex(index);
  }, [index]);

  const select = (i: number) => {
    const next = items[i];
    if (next) setSelectedId(next.id);
  };

  const approvedCount = (queue.data ?? []).filter((r) => r.status === "approved").length;
  const progressCount = (queue.data ?? []).filter((r) => r.status === "in_progress").length;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold">{t("adminDesk")}</h1>
        <p className="max-w-3xl text-muted-foreground">{t("deskIntro")}</p>
        <div
          role="note"
          className="flex max-w-4xl gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4 text-sm text-warning-foreground"
        >
          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{t("deskManualTitle")}</p>
            <p className="mt-0.5">{t("deskManualBody")}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <section
          aria-labelledby="desk-queue-heading"
          className="h-fit rounded-3xl border border-border bg-card shadow-soft"
        >
          <div className="space-y-3 border-b border-border p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="desk-queue-heading" className="font-semibold">
                {t("deskQueueTitle")}
              </h2>
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {t("deskQueueCount", { count: items.length })}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-status-approved-soft px-2.5 py-1 text-status-approved">
                {t("statusApproved")}: {formatNumber(approvedCount)}
              </span>
              <span className="rounded-full bg-status-progress-soft px-2.5 py-1 text-status-progress">
                {t("statusInProgress")}: {formatNumber(progressCount)}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger aria-label={t("filterStatus")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">{t("deskStatusBoth")}</SelectItem>
                  <SelectItem value="approved">{t("statusApproved")}</SelectItem>
                  <SelectItem value="in_progress">{t("statusInProgress")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={source} onValueChange={(v) => setSource(v as RecordSource)}>
                <SelectTrigger aria-label={t("filterSource")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("sourceAll")}</SelectItem>
                  <SelectItem value="real">{t("sourceReal")}</SelectItem>
                  <SelectItem value="demo">{t("sourceDemo")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {queue.isPending || settings.isPending ? (
            <p className="p-4 text-sm text-muted-foreground" aria-busy="true">
              {t("adminLoading")}
            </p>
          ) : queue.isError ? (
            <div role="alert" className="space-y-3 p-4 text-sm text-destructive">
              <p>{t("deskLoadFailed")}</p>
              <Button size="sm" variant="outline" onClick={() => queue.refetch()}>
                {t("retry")}
              </Button>
            </div>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t("queueEmpty")}</p>
          ) : (
            <ol className="max-h-72 divide-y divide-border overflow-y-auto lg:max-h-[38rem]">
              {items.map((r, i) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => select(i)}
                    aria-current={i === index ? "true" : undefined}
                    className={cn(
                      "flex w-full items-start justify-between gap-2 px-4 py-3 text-start text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      i === index && "bg-primary-soft",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{r.full_name}</span>
                      <span className="ltr-nums block font-mono text-xs text-muted-foreground">
                        {r.reference_code}
                      </span>
                      {r.is_test_data && (
                        <span className="mt-1 inline-flex">
                          <TestDataTag />
                        </span>
                      )}
                    </span>
                    <StatusBadge status={r.status} />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div>
          {queue.isSuccess && !current ? (
            <EmptyDesk />
          ) : current ? (
            <Workspace
              key={current.id}
              request={current}
              position={index + 1}
              total={items.length}
              onPrev={index > 0 ? () => select(index - 1) : undefined}
              onNext={index < items.length - 1 ? () => select(index + 1) : undefined}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EmptyDesk() {
  const { t } = useI18n();
  return (
    <section
      role="status"
      className="rounded-3xl border border-dashed border-border bg-card p-10 text-center shadow-soft"
    >
      <Inbox className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-semibold">{t("deskEmptyTitle")}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{t("deskEmptyBody")}</p>
      <Button asChild variant="outline" className="mt-5 rounded-full">
        <Link to="/admin">{t("deskBackToQueue")}</Link>
      </Button>
    </section>
  );
}

const CHECKLIST: DictKey[] = ["deskStep1", "deskStep2", "deskStep3", "deskStep4", "deskStep5"];
const CONFIRM_STEP = 3; // "Confirm the result on the official site"

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function Workspace({
  request: r,
  position,
  total,
  onPrev,
  onNext,
}: {
  request: DeskRequest;
  position: number;
  total: number;
  onPrev: (() => void) | undefined;
  onNext: (() => void) | undefined;
}) {
  const { t, formatDate, formatNumber, dir } = useI18n();
  const qc = useQueryClient();
  const [checked, setChecked] = useState<boolean[]>(() => CHECKLIST.map(() => false));
  const [auditNote, setAuditNote] = useState("");
  const [receipt, setReceipt] = useState("");
  const [announce, setAnnounce] = useState("");
  const [actionError, setActionError] = useState<DictKey | null>(null);
  const auditId = useId();
  const receiptId = useId();
  const receiptHintId = useId();
  const Prev = dir === "rtl" ? ChevronRight : ChevronLeft;
  const Next = dir === "rtl" ? ChevronLeft : ChevronRight;

  const status = r.status;
  const nextStatus = isDeskStatus(status) ? DESK_NEXT_STATUS[status] : null;
  const confirmed = checked[CONFIRM_STEP] === true;
  const submittedText = formatDate(r.created_at);

  async function copy(label: string, value: string) {
    const ok = await copyText(value);
    const msg = ok ? t("deskCopiedField", { field: label }) : t("copyFailed");
    setAnnounce(msg);
    if (ok) toast.success(msg);
    else toast.error(msg);
  }

  const changeStatus = useMutation({
    mutationFn: async () => {
      if (!nextStatus) throw new Error("invalid_transition");
      const { error } = await supabase.rpc("admin_set_status", {
        p_request_id: r.id,
        p_status: nextStatus,
        p_reason: deskAuditReason(auditNote),
      });
      if (error) throw error;
    },
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setAuditNote("");
      toast.success(t("deskStatusUpdated"));
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => {
      const key = errorKeyFor(e);
      setActionError(key);
      toast.error(t(key));
    },
  });

  const saveReceipt = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_add_note", {
        p_request_id: r.id,
        p_body: receiptNoteBody(receipt),
      });
      if (error) throw error;
    },
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setReceipt("");
      toast.success(t("deskReceiptSaved"));
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => {
      const key = errorKeyFor(e);
      setActionError(key);
      toast.error(t(key));
    },
  });

  const fields: { label: string; value: string; display?: ReactNode; ltr?: boolean }[] = [
    { label: t("deskFieldName"), value: r.full_name },
    { label: t("deskFieldPhone"), value: r.phone, ltr: true },
    { label: t("deskFieldCity"), value: r.city },
    {
      label: t("deskFieldHousehold"),
      value: String(r.family_members),
      display: formatNumber(r.family_members),
    },
    { label: t("deskFieldReference"), value: r.reference_code, ltr: true },
    { label: t("deskFieldSubmitted"), value: submittedText },
  ];

  const summary = formatDeskSummary(
    { ...r, submittedText },
    {
      title: t("appName"),
      reference: t("deskFieldReference"),
      name: t("deskFieldName"),
      phone: t("deskFieldPhone"),
      city: t("deskFieldCity"),
      household: t("deskFieldHousehold"),
      submitted: t("deskFieldSubmitted"),
      note: t("deskFieldNote"),
      synthetic: t("testDataTag"),
    },
  );

  const busy = changeStatus.isPending || saveReceipt.isPending;

  return (
    <article
      aria-labelledby="desk-current-heading"
      className="space-y-6 rounded-3xl border border-border bg-card p-5 shadow-soft md:p-7"
    >
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("deskPosition", { current: position, total })}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onPrev} disabled={!onPrev}>
            <Prev aria-hidden="true" />
            {t("deskPrev")}
          </Button>
          <Button variant="outline" size="sm" onClick={onNext} disabled={!onNext}>
            {t("deskNext")}
            <Next aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h2 id="desk-current-heading" className="text-xl font-semibold">
          <span className="sr-only">{t("deskWorkspace")}: </span>
          {r.full_name}
        </h2>
        <StatusBadge status={status} />
        {r.is_test_data && <TestDataTag />}
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <CopyField
            key={f.label}
            label={f.label}
            ltr={f.ltr}
            onCopy={() => copy(f.label, f.value)}
          >
            {f.display ?? f.value}
          </CopyField>
        ))}
        <div className="sm:col-span-2">
          <CopyField
            label={t("deskFieldNote")}
            onCopy={r.note ? () => copy(t("deskFieldNote"), r.note ?? "") : undefined}
          >
            {r.note ? (
              <span className="whitespace-pre-wrap">{r.note}</span>
            ) : (
              <span className="font-normal text-muted-foreground">{t("detailNoNote")}</span>
            )}
          </CopyField>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button variant="hero" onClick={() => copy(t("deskCopySummary"), summary)}>
          <ClipboardCopy aria-hidden="true" />
          {t("deskCopySummary")}
        </Button>
        <Button asChild variant="ghost">
          <Link to="/admin/requests/$id" params={{ id: r.id }}>
            {t("deskOpenDetail")}
          </Link>
        </Button>
      </div>

      <section aria-labelledby="desk-checklist-heading" className="rounded-2xl bg-muted/60 p-4">
        <h3 id="desk-checklist-heading" className="font-semibold">
          {t("deskChecklistTitle")}
        </h3>
        <p className="text-xs text-muted-foreground">{t("deskChecklistHint")}</p>
        <ol className="mt-3 space-y-2.5">
          {CHECKLIST.map((key, i) => {
            const id = `desk-step-${i + 1}`;
            return (
              <li key={key} className="flex items-start gap-3">
                <Checkbox
                  id={id}
                  checked={checked[i]}
                  onCheckedChange={(v) =>
                    setChecked((prev) => prev.map((c, j) => (j === i ? v === true : c)))
                  }
                  className="mt-0.5"
                />
                <Label htmlFor={id} className="text-sm font-normal leading-relaxed">
                  <span className="font-semibold">{formatNumber(i + 1)}.</span> {t(key)}
                </Label>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="space-y-2">
        <Label htmlFor={receiptId}>{t("deskReceiptLabel")}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={receiptId}
            dir="ltr"
            className="text-start"
            maxLength={120}
            autoComplete="off"
            value={receipt}
            aria-describedby={receiptHintId}
            onChange={(e) => setReceipt(e.target.value)}
          />
          <Button
            variant="outline"
            onClick={() => saveReceipt.mutate()}
            disabled={busy || !receipt.trim()}
          >
            {t("deskReceiptSave")}
          </Button>
        </div>
        <p id={receiptHintId} className="flex gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {t("deskReceiptHint")}
        </p>
      </section>

      {nextStatus && (
        <section className="space-y-3 border-t border-border pt-5">
          <div className="space-y-1.5">
            <Label htmlFor={auditId}>{t("deskAuditLabel")}</Label>
            <Input
              id={auditId}
              maxLength={400}
              placeholder={t("deskAuditPlaceholder")}
              value={auditNote}
              onChange={(e) => setAuditNote(e.target.value)}
            />
          </div>
          {status === "approved" ? (
            <Button onClick={() => changeStatus.mutate()} disabled={busy}>
              {t("deskStart")}
            </Button>
          ) : (
            <div className="space-y-2">
              <Button
                onClick={() => changeStatus.mutate()}
                disabled={busy || !confirmed}
                aria-describedby={!confirmed ? "desk-complete-hint" : undefined}
              >
                {t("deskComplete")}
              </Button>
              {!confirmed && (
                <p id="desk-complete-hint" className="text-xs text-muted-foreground">
                  {t("deskCompleteNeedsConfirm")}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {actionError && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-status-rejected-soft p-3 text-sm text-destructive"
        >
          {t(actionError)}
        </p>
      )}
    </article>
  );
}

function CopyField({
  label,
  ltr,
  onCopy,
  children,
}: {
  label: string;
  ltr?: boolean | undefined;
  onCopy: (() => void) | undefined;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-border p-3">
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className={cn("mt-0.5 break-words font-medium", ltr && "ltr-nums")} dir={ltr ? "ltr" : undefined}>
          {children}
        </dd>
      </div>
      {onCopy && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopy}
          aria-label={t("deskCopyField", { field: label })}
          className="shrink-0"
        >
          <Copy aria-hidden="true" />
          <span className="hidden sm:inline">{t("copy")}</span>
        </Button>
      )}
    </div>
  );
}
