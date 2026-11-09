import { z } from "zod";

import type { DictKey } from "./i18n-dictionary";

// Converts Persian (۰-۹) and Arabic-Indic (٠-٩) digits to ASCII so phone numbers and counts validate.
export function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

export const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{6,19}$/;

// Error messages are dictionary keys so the UI can translate them.
export const requestSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { message: "errNameLength" satisfies DictKey })
    .max(120, { message: "errNameLength" satisfies DictKey }),
  phone: z
    .string()
    .transform((v) => normalizeDigits(v).trim())
    .pipe(z.string().regex(PHONE_PATTERN, { message: "errPhone" satisfies DictKey })),
  city: z
    .string()
    .trim()
    .min(2, { message: "errCityLength" satisfies DictKey })
    .max(80, { message: "errCityLength" satisfies DictKey }),
  familyMembers: z.coerce
    .number({ invalid_type_error: "errFamily" satisfies DictKey })
    .int({ message: "errFamily" satisfies DictKey })
    .min(1, { message: "errFamily" satisfies DictKey })
    .max(20, { message: "errFamily" satisfies DictKey }),
  note: z
    .string()
    .trim()
    .max(500, { message: "errNote" satisfies DictKey })
    .optional()
    .default(""),
  consent: z.literal(true, { errorMap: () => ({ message: "errConsent" satisfies DictKey }) }),
  language: z.enum(["fa", "en"]).default("fa"),
  // Honeypot: real people never see or fill this field.
  website: z.string().max(0).optional().default(""),
});

export type RequestInput = z.input<typeof requestSchema>;
export type RequestData = z.output<typeof requestSchema>;
