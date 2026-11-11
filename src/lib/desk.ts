// Rapid Registration Desk helpers. The desk only prepares text for a volunteer to copy by
// hand; nothing here talks to any external website.

import type { RequestStatus } from "./request-rules";

export const DESK_STATUSES = ["approved", "in_progress"] as const satisfies readonly RequestStatus[];
export type DeskStatus = (typeof DESK_STATUSES)[number];

/** The one status change the desk offers for each desk status. */
export const DESK_NEXT_STATUS: Record<DeskStatus, RequestStatus> = {
  approved: "in_progress",
  in_progress: "completed",
};

export function isDeskStatus(status: string): status is DeskStatus {
  return (DESK_STATUSES as readonly string[]).includes(status);
}

export type SummaryLabels = {
  title: string;
  reference: string;
  name: string;
  phone: string;
  city: string;
  household: string;
  submitted: string;
  note: string;
  synthetic: string;
};

export type SummaryInput = {
  reference_code: string;
  full_name: string;
  phone: string;
  city: string;
  family_members: number;
  note: string | null;
  is_test_data: boolean;
  submittedText: string;
};

/** Plain-text summary a volunteer can paste into their own working notes. */
export function formatDeskSummary(r: SummaryInput, l: SummaryLabels): string {
  const lines = [
    `${l.title} — ${r.reference_code}`,
    ...(r.is_test_data ? [`[${l.synthetic}]`] : []),
    `${l.name}: ${r.full_name}`,
    `${l.phone}: ${r.phone}`,
    `${l.city}: ${r.city}`,
    `${l.household}: ${r.family_members}`,
    `${l.reference}: ${r.reference_code}`,
    `${l.submitted}: ${r.submittedText}`,
  ];
  if (r.note) lines.push(`${l.note}: ${r.note}`);
  return lines.join("\n");
}

/** Audit text for a desk status change; stays within the 500-character database limit. */
export function deskAuditReason(note: string): string {
  const trimmed = note.trim().replace(/\s+/g, " ");
  const base = "Rapid Registration Desk";
  return (trimmed ? `${base}: ${trimmed}` : base).slice(0, 500);
}

/** Internal-note body for a receipt or confirmation reference. */
export function receiptNoteBody(reference: string): string {
  return `Receipt / confirmation reference · شمارهٔ رسید: ${reference.trim().slice(0, 120)}`;
}
