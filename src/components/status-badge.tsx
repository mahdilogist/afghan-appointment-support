import { cva } from "class-variance-authority";

import { useI18n } from "@/lib/i18n";
import { STATUS_LABEL_KEY, type RequestStatus } from "@/lib/request-rules";
import { cn } from "@/lib/utils";

const statusBadge = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap before:size-1.5 before:rounded-full before:bg-current",
  {
    variants: {
      status: {
        pending_review: "bg-status-pending-soft text-status-pending",
        needs_clarification: "bg-status-clarify-soft text-status-clarify",
        approved: "bg-status-approved-soft text-status-approved",
        in_progress: "bg-status-progress-soft text-status-progress",
        completed: "bg-status-completed-soft text-status-completed",
        rejected: "bg-status-rejected-soft text-status-rejected",
      },
    },
  },
);

export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  const { t } = useI18n();
  return (
    <span className={cn(statusBadge({ status }), className)}>{t(STATUS_LABEL_KEY[status])}</span>
  );
}

export function TestDataTag() {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center rounded border border-warning/40 bg-warning-soft px-1.5 py-px text-[11px] font-medium text-warning-foreground">
      {t("testDataTag")}
    </span>
  );
}
