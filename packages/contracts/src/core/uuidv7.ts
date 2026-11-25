/**
 * RFC 9562 version-7 UUID: a 48-bit Unix-millisecond timestamp, then version/variant bits and
 * 74 random bits. Ids made later sort later, so new rows land at the end of a B-tree index
 * instead of at random pages (better locality than v4 `gen_random_uuid()` / `randomUUID()`).
 *
 * Uses `globalThis.crypto.getRandomValues`, available in Node 24 and every evergreen browser, so
 * the backend and the frontend mint ids the same way. PostgreSQL 16 has no built-in `uuidv7()`.
 *
 * @param now - Clock in milliseconds (injectable for tests).
 * @param random - Fills the 10 random bytes (injectable for tests).
 */
export function uuidv7(
  now: number = Date.now(),
  random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer> = (bytes) =>
    globalThis.crypto.getRandomValues(bytes),
): string {
  const bytes = new Uint8Array(16);
  let ms = Math.max(0, Math.floor(now));
  for (let i = 5; i >= 0; i -= 1) {
    bytes[i] = ms % 256;
    ms = Math.floor(ms / 256);
  }
  bytes.set(random(new Uint8Array(new ArrayBuffer(10))), 6);
  bytes[6] = 0x70 | (bytes[6]! & 0x0f); // version 7
  bytes[8] = 0x80 | (bytes[8]! & 0x3f); // RFC 9562 variant (10xx)
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Milliseconds encoded in a v7 UUID (null for anything else). */
export function uuidv7Timestamp(id: string): number | null {
  const match = /^([0-9a-f]{8})-([0-9a-f]{4})-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.exec(
    id,
  );
  return match ? Number.parseInt(`${match[1]}${match[2]}`, 16) : null;
}
