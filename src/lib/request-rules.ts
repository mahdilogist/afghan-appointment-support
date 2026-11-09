// Review workflow rules shared by the admin UI. The database functions enforce the
// same rules server-side (admin_approve / admin_set_status); keep them in sync.

import type { DictKey } from "./i18n-dictionary";

export const STATUSES = [
  "pending_review",
  "needs_clarification",
  "approved",
  "in_progress",
  "completed",
  "rejected",
] as const;
export type RequestStatus = (typeof STATUSES)[number];

export type ApprovalPolicy = "single_admin" | "two_person" | null;
export type QueueOrder = "oldest_first" | "newest_first";

export const STATUS_LABEL_KEY: Record<RequestStatus, DictKey> = {
  pending_review: "statusPendingReview",
  needs_clarification: "statusNeedsClarification",
  approved: "statusApproved",
  in_progress: "statusInProgress",
  completed: "statusCompleted",
  rejected: "statusRejected",
};

/** Status changes that do not need an approval (approval goes through canApprove). */
const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  pending_review: ["needs_clarification", "rejected"],
  needs_clarification: ["pending_review", "rejected"],
  approved: ["in_progress", "completed", "rejected"],
  in_progress: ["completed"],
  completed: [],
  rejected: [],
};

export function allowedStatusChanges(from: RequestStatus): RequestStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function requiredApprovals(policy: ApprovalPolicy): number | null {
  if (policy === "single_admin") return 1;
  if (policy === "two_person") return 2;
  return null;
}

export type ApproveCheck =
  | { ok: true; required: number }
  | { ok: false; reason: "policy_unset" | "invalid_status" | "already_approved_by_you" };

/** Whether the current admin may record an approval right now. */
export function canApprove(args: {
  policy: ApprovalPolicy;
  status: RequestStatus;
  approverIds: string[];
  currentAdminId: string;
}): ApproveCheck {
  const required = requiredApprovals(args.policy);
  if (required === null) return { ok: false, reason: "policy_unset" };
  if (args.status !== "pending_review" && args.status !== "needs_clarification") {
    return { ok: false, reason: "invalid_status" };
  }
  if (args.approverIds.includes(args.currentAdminId)) {
    return { ok: false, reason: "already_approved_by_you" };
  }
  return { ok: true, required };
}

/** Status after one more approval is recorded. */
export function statusAfterApproval(
  policy: Exclude<ApprovalPolicy, null>,
  current: RequestStatus,
  approvalsAfter: number,
): RequestStatus {
  const required = requiredApprovals(policy) ?? Infinity;
  return approvalsAfter >= required ? "approved" : current;
}

/** Strips characters that would break a PostgREST `or=` filter. */
export function sanitizeSearch(input: string): string {
  return input
    .replace(/[,()*%\\:"']/g, " ")
    .trim()
    .slice(0, 80);
}

/** Maps database error codes to translated messages without leaking raw error text. */
export function errorKeyFor(error: unknown): DictKey {
  const msg =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : "";
  if (msg.includes("not_authorized")) return "errNotAuthorized";
  if (msg.includes("approval_policy_not_set")) return "errPolicyUnset";
  if (msg.includes("invalid_transition")) return "errInvalidTransition";
  if (msg.includes("already_approved_by_you")) return "errAlreadyApproved";
  if (msg.includes("not_found")) return "errNotFound";
  return "errGeneric";
}
