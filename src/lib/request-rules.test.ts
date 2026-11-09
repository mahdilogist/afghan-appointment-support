import { describe, expect, it } from "vitest";

import { canApprove, canTransition, requiredApprovals, statusAfterApproval } from "./request-rules";
import { normalizeDigits, requestSchema } from "./request-schema";

describe("approval policy", () => {
  it("blocks approval while the policy is unset", () => {
    expect(
      canApprove({ policy: null, status: "pending_review", approverIds: [], currentAdminId: "a" }),
    ).toEqual({
      ok: false,
      reason: "policy_unset",
    });
  });
  it("needs one approval under single-admin policy", () => {
    expect(requiredApprovals("single_admin")).toBe(1);
    expect(statusAfterApproval("single_admin", "pending_review", 1)).toBe("approved");
  });
  it("needs two different admins under two-person policy", () => {
    expect(statusAfterApproval("two_person", "pending_review", 1)).toBe("pending_review");
    expect(statusAfterApproval("two_person", "pending_review", 2)).toBe("approved");
    expect(
      canApprove({
        policy: "two_person",
        status: "pending_review",
        approverIds: ["a"],
        currentAdminId: "a",
      }),
    ).toEqual({
      ok: false,
      reason: "already_approved_by_you",
    });
  });
});

describe("status transitions", () => {
  it("only completes approved or in-progress requests", () => {
    expect(canTransition("approved", "completed")).toBe(true);
    expect(canTransition("in_progress", "completed")).toBe(true);
    expect(canTransition("pending_review", "completed")).toBe(false);
  });
  it("never reopens completed or rejected requests", () => {
    expect(canTransition("completed", "pending_review")).toBe(false);
    expect(canTransition("rejected", "pending_review")).toBe(false);
  });
});

describe("request form validation", () => {
  const base = {
    fullName: "Test Person",
    phone: "+93 700 000 101",
    city: "Kabul",
    familyMembers: 2,
    consent: true as const,
  };
  it("accepts Persian digits in phone numbers", () => {
    expect(normalizeDigits("۰۷۰۰")).toBe("0700");
    expect(requestSchema.safeParse({ ...base, phone: "+۹۳ ۷۰۰ ۰۰۰ ۱۰۱" }).success).toBe(true);
  });
  it("requires consent", () => {
    expect(requestSchema.safeParse({ ...base, consent: false }).success).toBe(false);
  });
  it("limits family members to 1-20", () => {
    expect(requestSchema.safeParse({ ...base, familyMembers: 21 }).success).toBe(false);
    expect(requestSchema.safeParse({ ...base, familyMembers: 0 }).success).toBe(false);
  });
});
