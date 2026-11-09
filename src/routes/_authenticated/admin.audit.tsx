import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { auditLogQuery } from "@/lib/admin-queries";
import type { DictKey } from "@/lib/i18n-dictionary";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AuditPage,
});

const LABEL: Record<string, DictKey> = {
  submitted: "actionSubmitted",
  approved: "actionApproved",
  approval_recorded: "actionApprovalRecorded",
  status_changed: "actionStatusChanged",
  note_added: "actionNoteAdded",
  settings_updated: "actionSettingsUpdated",
};

function AuditPage() {
  const { t, formatDate } = useI18n();
  const audit = useQuery(auditLogQuery);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("auditPageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("auditPageIntro")}</p>
      </div>
      <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-soft">
        {audit.isPending ? (
          <p className="p-6 text-muted-foreground">{t("adminLoading")}</p>
        ) : audit.isError ? (
          <p role="alert" className="p-6 text-destructive">{t("errGeneric")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium">{t("auditColWhen")}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t("auditColWho")}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t("auditColWhat")}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t("auditColRequest")}</th>
              </tr>
            </thead>
            <tbody>
              {audit.data.map((a) => (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(a.created_at)}</td>
                  <td className="px-4 py-3" dir="ltr">{a.actor_email === "demo-seed" ? t("auditSeed") : a.actor_email ?? t("auditSystem")}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{t(LABEL[a.action] ?? "actionStatusChanged")}</span>
                    {a.details && <span className="block text-xs text-muted-foreground">{a.details}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {a.request_id && a.requests ? (
                      <Link to="/admin/requests/$id" params={{ id: a.request_id }} className="ltr-nums font-mono text-xs text-primary hover:underline">
                        {a.requests.reference_code}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
