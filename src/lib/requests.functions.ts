import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requestSchema } from "./request-schema";

/**
 * Public: creates one request in Pending Review and returns only its reference code.
 * Uses the publishable key + an insert-only database function, so the caller can never
 * read or change any stored request. Errors are generic on purpose (no personal data).
 */
export const submitRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) throw new Error("invalid_input");
    return parsed.data;
  })
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("submit_failed");

    const client = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });

    const { data: reference, error } = await client.rpc("submit_request", {
      p_full_name: data.fullName,
      p_phone: data.phone,
      p_city: data.city,
      p_family_members: data.familyMembers,
      p_note: data.note,
      p_consent: data.consent,
      p_language: data.language,
    });

    if (error || !reference) {
      // Log only the error code — never the submitted values.
      console.error("submit_request failed", error?.code ?? "unknown");
      throw new Error("submit_failed");
    }
    return { reference };
  });

/**
 * Signed-in volunteers call this once to activate the admin role. The caller's verified
 * email must appear in the ADMIN_EMAILS secret (comma-separated). No credentials live in code.
 */
export const claimAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const allowlist = (process.env["ADMIN_EMAILS"] ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (allowlist.length === 0) return { granted: false as const };

    const { data: userData, error } = await context.supabase.auth.getUser();
    const user = userData?.user;
    if (error || !user?.email || !user.email_confirmed_at) return { granted: false as const };
    if (!allowlist.includes(user.email.toLowerCase())) return { granted: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insertError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: user.id, role: "admin" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
    if (insertError) {
      console.error("admin role grant failed", insertError.code);
      throw new Error("grant_failed");
    }
    return { granted: true as const };
  });
