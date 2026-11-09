import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { StatusBadge, TestDataTag } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { requestListQuery, settingsQuery, statusCountsQuery, type QueueFilters } from "@/lib/admin-queries";
import { useI18n } from "@/lib/i18n";
import { STATUS_LABEL_KEY, STATUSES, type QueueOrder, type RequestStatus } from "@/lib/request-rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

const COUNT_STYLES: Record<RequestStatus, string> = {
  pending_review: "text-status-pending",
  needs_clarification: "text-status-clarify",
  approved: "text-status-approved",
  in_progress: "text-status-progress",
  completed: "text-status-completed",
  rejected: "text-status-rejected",
};

function Dashboard() {
  const { t, formatNumber, formatDate, dir } = useI18n();
  const settings = useQuery(settingsQuery);
  const counts = useQuery(statusCountsQuery);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QueueFilters["status"]>("all");
  const [order, setOrder] = useState<QueueOrder | null>(null);
  const effectiveOrder: QueueOrder = order ?? settings.data?.queue_order ?? "oldest_first";

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(id);
  }, [searchInput]);

  const list = useQuery({ ...requestListQuery({ search, status, order: effectiveOrder }), enabled: settings.isSuccess || settings.isError });
  const total = Object.values(counts.data ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  const Chevron = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-8">
      <section aria-labelledby="counts-heading">
        <h1 id="counts-heading" className="text-2xl font-semibold">
          {t("adminDashboard")}
        </h1>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <CountCard label={t("countsTotal")} value={formatNumber(total)} active={status === "all"} onClick={() => setStatus("all")} />
          {STATUSES.map((s) => (
            <CountCard
              key={s}
              label={t(STATUS_LABEL_KEY[s])}
              value={formatNumber(counts.data?.[s] ?? 0)}
              valueClass={COUNT_STYLES[s]}
              active={status === s}
              onClick={() => setStatus(s)}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="queue-heading" className="rounded-3xl border border-border bg-card shadow-soft">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <h2 id="queue-heading" className="text-lg font-semibold">
            {t("queueTitle")}
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label={t("searchPlaceholder")}
                placeholder={t("searchPlaceholder")}
                className="w-full ps-9 sm:w-72"
                value={searchInput}
                maxLength={80}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as QueueFilters["status"])}>
              <SelectTrigger className="sm:w-48" aria-label={t("filterStatus")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filterAll")}</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(STATUS_LABEL_KEY[s])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={effectiveOrder} onValueChange={(v) => setOrder(v as QueueOrder)}>
              <SelectTrigger className="sm:w-44" aria-label={t("sortLabel")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="oldest_first">{t("sortOldest")}</SelectItem>
                <SelectItem value="newest_first">{t("sortNewest")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {list.isPending ? (
          <p className="p-6 text-muted-foreground">{t("adminLoading")}</p>
        ) : list.isError ? (
          <p role="alert" className="p-6 text-destructive">{t("errGeneric")}</p>
        ) : list.data.length === 0 ? (
          <p className="p-6 text-muted-foreground">{t("queueEmpty")}</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-start text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-medium">{t("colReference")}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t("colName")}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t("colCity")}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t("colMembers")}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t("colStatus")}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t("colSubmitted")}</th>
                    <th className="px-4 py-2.5"><span className="sr-only">{t("open")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((r) => (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <span className="ltr-nums font-mono text-xs">{r.reference_code}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.full_name}</span>
                          {r.is_test_data && <TestDataTag />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.city}</td>
                      <td className="px-4 py-3">{formatNumber(r.family_members)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status as RequestStatus} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-3 text-end">
                        <Link
                          to="/admin/requests/$id"
                          params={{ id: r.id }}
                          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium text-primary hover:bg-primary-soft"
                        >
                          {t("open")}
                          <Chevron className="size-4" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <ul className="divide-y divide-border md:hidden">
              {list.data.map((r) => (
                <li key={r.id}>
                  <Link to="/admin/requests/$id" params={{ id: r.id }} className="flex items-start justify-between gap-3 p-4 hover:bg-muted/40">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{r.full_name}</span>
                        {r.is_test_data && <TestDataTag />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="ltr-nums font-mono">{r.reference_code}</span> · {r.city} · {formatDate(r.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={r.status as RequestStatus} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function CountCard({
  label,
  value,
  valueClass,
  active,
  onClick,
}: {
  label: string;
  value: string;
  valueClass?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-2xl border bg-card p-4 text-start shadow-soft transition-colors hover:border-primary/40",
        active ? "border-primary ring-1 ring-primary" : "border-border",
      )}
    >
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className={cn("mt-1 block font-display text-2xl font-semibold", valueClass)}>{value}</span>
    </button>
  );
}
