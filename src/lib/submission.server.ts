// Server-only helpers for the public request form. Never import this from components.

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
}

/** Best-effort client address from the hosting proxy headers. Used only to compute a hash. */
export function clientAddressFrom(get: (name: string) => string | undefined): string {
  const direct = get("cf-connecting-ip") ?? get("x-real-ip");
  if (direct) return direct.trim().slice(0, 64);
  const forwarded = get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ? forwarded.slice(0, 64) : "unknown";
}

/**
 * Keyed, daily-rotating hash of the client address for throttling. The key is derived from a
 * server-only secret with a fixed label, so the hash cannot be reversed or linked across days,
 * and the raw address never leaves this function.
 */
export async function throttleHash(
  address: string,
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  const derivedKey = await hmac(encoder.encode(secret), "afa-submission-throttle-v1");
  const day = now.toISOString().slice(0, 10);
  return toHex(await hmac(derivedKey, `${day}|${address}`));
}
