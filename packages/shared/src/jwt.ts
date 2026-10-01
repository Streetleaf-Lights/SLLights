/**
 * Runtime-agnostic JWT payload decoding.
 *
 * The web app used Node's `Buffer.from(x, "base64url")`, which doesn't exist
 * in React Native (Hermes). `atob`/`TextDecoder` availability also varies
 * across Hermes versions, so this decodes base64url -> bytes -> UTF-8 by
 * hand. It's small, pure, and identical on every runtime that imports it.
 *
 * Decoding only — no signature verification. See decodeSessionToken in
 * auth-role.ts for why that's acceptable for display/navigation decisions,
 * and why it is NOT a security boundary on its own.
 */

const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const LOOKUP: Record<string, number> = Object.fromEntries(
  [...BASE64URL_ALPHABET].map((char, index) => [char, index]),
);
// Accept standard base64 characters too, in case a token was re-encoded.
LOOKUP["+"] = 62;
LOOKUP["/"] = 63;

/** Decodes base64url (padded or unpadded) into raw bytes. Throws on invalid input. */
export function base64UrlToBytes(input: string): Uint8Array {
  const clean = input.replace(/=+$/, "");
  if (clean.length % 4 === 1) throw new Error("Invalid base64url length.");

  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = LOOKUP[char];
    if (value === undefined) throw new Error("Invalid base64url character.");
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

/** Decodes UTF-8 bytes into a string (handles 1–4 byte sequences). Throws on malformed input. */
export function utf8Decode(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++];
    let codePoint: number;
    if (b0 < 0x80) {
      codePoint = b0;
    } else if (b0 >= 0xc0 && b0 < 0xe0) {
      codePoint = ((b0 & 0x1f) << 6) | continuation(bytes, i++);
    } else if (b0 >= 0xe0 && b0 < 0xf0) {
      codePoint = ((b0 & 0x0f) << 12) | (continuation(bytes, i++) << 6) | continuation(bytes, i++);
    } else if (b0 >= 0xf0 && b0 < 0xf8) {
      codePoint =
        ((b0 & 0x07) << 18) |
        (continuation(bytes, i++) << 12) |
        (continuation(bytes, i++) << 6) |
        continuation(bytes, i++);
    } else {
      throw new Error("Malformed UTF-8.");
    }
    out += String.fromCodePoint(codePoint);
  }
  return out;
}

function continuation(bytes: Uint8Array, index: number): number {
  const byte = bytes[index];
  if (byte === undefined || (byte & 0xc0) !== 0x80) throw new Error("Malformed UTF-8.");
  return byte & 0x3f;
}

/** Returns the JWT's decoded payload object, or null if it isn't a well-formed three-part token with a JSON object payload. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload: unknown = JSON.parse(utf8Decode(base64UrlToBytes(parts[1])));
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
