import { createCipheriv, createDecipheriv, randomBytes, hash } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:aes256gcm:";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getDerivedKey(explicitKey?: string): Buffer {
  // Fail closed: never fall back to a low-entropy value (DATABASE_URL) or a
  // hardcoded default, which would silently encrypt secrets under a key an
  // attacker already knows. `JWT_SECRET` is kept as a backward-compatible
  // source because it is mandatory in every deployment (serverConfig.ts) and
  // existing ciphertext was derived from it; `AT_REST_ENCRYPTION_KEY` is
  // preferred so the two domains can be separated.
  const secretSource =
    explicitKey || process.env.AT_REST_ENCRYPTION_KEY?.trim() || process.env.JWT_SECRET?.trim();

  if (!secretSource) {
    throw new Error(
      "No at-rest encryption key configured. Set AT_REST_ENCRYPTION_KEY (preferred) or JWT_SECRET.",
    );
  }

  return hash("sha256", secretSource, "buffer");
}

/**
 * True only for a structurally valid `enc:aes256gcm:<iv>:<tag>:<ciphertext>`
 * envelope. Guards against treating attacker-controlled plaintext that merely
 * starts with the prefix as already-encrypted (which would corrupt the value).
 */
function isEncryptedEnvelope(value: string): boolean {
  if (!value.startsWith(PREFIX)) return false;
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) return false;
  const [ivHex, tagHex, ciphertextHex] = parts;
  return (
    ivHex.length === IV_LENGTH * 2 &&
    tagHex.length === TAG_LENGTH * 2 &&
    ciphertextHex.length > 0 &&
    /^[0-9a-f]+$/i.test(ivHex) &&
    /^[0-9a-f]+$/i.test(tagHex) &&
    /^[0-9a-f]+$/i.test(ciphertextHex)
  );
}

/**
 * Encrypts sensitive string data at rest using AES-256-GCM.
 * Output format: enc:aes256gcm:<iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export function encryptSecretAtRest(
  plaintext?: string | null,
  explicitKey?: string,
): string | undefined {
  if (!plaintext) return undefined;
  if (isEncryptedEnvelope(plaintext)) return plaintext; // already encrypted

  const key = getDerivedKey(explicitKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Decrypts sensitive string data at rest.
 * Gracefully handles unencrypted values for seamless backward-compatibility.
 */
export function decryptSecretAtRest(
  value?: string | null,
  explicitKey?: string,
): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith(PREFIX)) return value; // plaintext legacy fallback
  // Prefixed but malformed → fail closed rather than returning raw bytes.
  if (!isEncryptedEnvelope(value)) return undefined;

  try {
    const [ivHex, tagHex, ciphertextHex] = value.slice(PREFIX.length).split(":");
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) return undefined;

    const key = getDerivedKey(explicitKey);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    // If decryption fails (e.g. key changed), return undefined or log safely without leaking data
    return undefined;
  }
}
