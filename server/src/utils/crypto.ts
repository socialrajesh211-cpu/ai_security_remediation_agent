import crypto from "node:crypto";
import { env } from "../config/env";

/**
 * Encrypts/decrypts secrets (GitHub access tokens) before they're persisted in
 * MongoDB, using AES-256-GCM with a key from `TOKEN_ENCRYPTION_KEY`.
 *
 * Format stored: `<ivHex>:<authTagHex>:<ciphertextHex>` — self-contained, so no
 * separate column/field is needed for the IV or auth tag.
 *
 * In development, if no key is configured, values pass through unencrypted so
 * local setup doesn't require generating a key — `env.ts` refuses to boot
 * without one in production, so this fallback never applies there.
 */
const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer | null {
  if (!env.tokenEncryptionKey) return null;
  return Buffer.from(env.tokenEncryptionKey, "hex");
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext; // dev-only fallback, see module doc

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(stored: string): string {
  const key = getKey();
  if (!key) return stored; // dev-only fallback, see module doc

  const parts = stored.split(":");
  if (parts.length !== 3) {
    // Value was stored before encryption was enabled, or the key changed —
    // treat it as opaque rather than throwing, callers don't rely on this path.
    return stored;
  }
  const [ivHex, authTagHex, dataHex] = parts;

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return stored;
  }
}
