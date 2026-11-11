import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requestSchema } from "./request-schema";
import { clientAddressFrom, throttleHash } from "./submission.server";

/**
 * Public: creates one request in Pending Review and returns only its reference code.
 * Validation (including the honeypot) runs here, then the request is written through a
 * database function that only the server's service role may call. The database repeats
 * the validation and applies a privacy-preserving throttle. Errors are generic on purpose:
 * no submitted values are ever logged or returned.
 */
export const submitRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) throw new Error("invalid_input");
    return parsed.data;
  })
  .handler(async ({ data }) => {
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!serviceKey || !process.env["SUPABASE_URL"]) {
      console.error("submit_request unavailable: server is missing its backend credentials");
      throw new Error("submit_failed");
    }

    const address = clientAddressFrom((name) => getRequestHeader(name as never));
    const clientHash = await throttleHash(address, serviceKey);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reference, error } = await supabaseAdmin.rpc("submit_request", {
      p_full_name: data.fullName,
      p_phone: data.phone,
      p_city: data.city,
      p_family_members: data.familyMembers,
      p_note: data.note,
      p_consent: data.consent,
      p_language: data.language,
      p_client_hash: clientHash,
    });

    if (error || !reference) {
      if (error?.message?.includes("rate_limited")) throw new Error("rate_limited");
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
