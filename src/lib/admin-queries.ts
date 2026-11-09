import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearch, type ApprovalPolicy, type QueueOrder, type RequestStatus } from "./request-rules";

// All admin reads go through the browser client; row-level security only returns rows to admins.

export const currentUserQuery = queryOptions({
  queryKey: ["admin", "me"],
  queryFn: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("not_signed_in");
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    if (rolesError) throw new Error("roles_failed");
    return {
      id: data.user.id,
      email: data.user.email ?? "",
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
    };
  },
});

export type Settings = {
  approval_policy: ApprovalPolicy;
  queue_order: QueueOrder;
  retention_days: number | null;
  automation_enabled: boolean;
  updated_at: string;
};

export const settingsQuery = queryOptions({
  queryKey: ["admin", "settings"],
  queryFn: async (): Promise<Settings> => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("approval_policy, queue_order, retention_days, automation_enabled, updated_at")
      .eq("id", 1)
      .single();
    if (error) throw new Error("settings_failed");
    return data as Settings;
  },
});

export const statusCountsQuery = queryOptions({
  queryKey: ["admin", "counts"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("admin_status_counts");
    if (error) throw new Error("counts_failed");
    const counts: Partial<Record<RequestStatus, number>> = {};
    for (const row of data ?? []) counts[row.status as RequestStatus] = Number(row.total);
    return counts;
  },
});

export type QueueFilters = { search: string; status: RequestStatus | "all"; order: QueueOrder };

export function requestListQuery(filters: QueueFilters) {
  return queryOptions({
    queryKey: ["admin", "requests", filters],
    queryFn: async () => {
      // List rows show only what reviewers need; phone and notes stay in the detail view.
      let q = supabase
        .from("requests")
        .select("id, reference_code, full_name, city, family_members, status, is_test_data, created_at")
        .order("created_at", { ascending: filters.order === "oldest_first" })
        .limit(200);
      if (filters.status !== "all") q = q.eq("status", filters.status);
      const s = sanitizeSearch(filters.search);
      if (s) q = q.or(`reference_code.ilike.*${s}*,full_name.ilike.*${s}*,city.ilike.*${s}*`);
      const { data, error } = await q;
      if (error) throw new Error("list_failed");
      return data;
    },
  });
}

export function requestDetailQuery(id: string) {
  return queryOptions({
    queryKey: ["admin", "request", id],
    queryFn: async () => {
      const [req, approvals, notes, audit] = await Promise.all([
        supabase.from("requests").select("*").eq("id", id).maybeSingle(),
        supabase.from("request_approvals").select("admin_id, admin_email, created_at").eq("request_id", id),
        supabase
          .from("request_notes")
          .select("id, author_email, body, created_at")
          .eq("request_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("audit_log")
          .select("id, actor_email, action, from_status, to_status, details, created_at")
          .eq("request_id", id)
          .order("created_at", { ascending: false }),
      ]);
      if (req.error || approvals.error || notes.error || audit.error) throw new Error("detail_failed");
      return { request: req.data, approvals: approvals.data, notes: notes.data, audit: audit.data };
    },
  });
}

export const auditLogQuery = queryOptions({
  queryKey: ["admin", "audit"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("audit_log")
      .select("id, request_id, actor_email, action, from_status, to_status, details, created_at, requests(reference_code)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error("audit_failed");
    return data;
  },
});
