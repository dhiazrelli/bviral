import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * AES-256-GCM token encryption helper.
 *
 * Stored format:  enc:v1:<base64url(iv)>:<base64url(authTag)>:<base64url(ciphertext)>
 *
 *  - 12 byte random IV (recommended for GCM)
 *  - 16 byte auth tag
 *  - the key is read from `TOKEN_ENCRYPTION_KEY` (env). It must be either:
 *      * 32 raw bytes encoded as base64 (44 chars)
 *      * 32 raw bytes encoded as hex (64 chars)
 *      * any other string >= 32 chars (will be SHA-256'd into a 32 byte key)
 *
 * In development, if the env var is missing we derive a stable key from
 * `dev-only:bviral-control-center` and log a one-time warning. This keeps
 * local boot ergonomic while making sure production deployments fail fast
 * when the operator forgets to set a real key.
 *
 * Legacy (already-plaintext) tokens stored before this rollout are detected
 * via the `enc:v1:` prefix; they are returned as-is by `decryptToken` and
 * silently re-encrypted the next time the row is updated.
 */

const ENCRYPTION_VERSION = "v1";
const ENCRYPTION_PREFIX = `enc:${ENCRYPTION_VERSION}:`;
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

let cachedKey: Buffer | null = null;
let warnedAboutDevKey = false;

function decodeKeyMaterial(value: string): Buffer | null {
  // base64 (typical 44 chars for 32 bytes, possibly padded)
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length >= 44) {
    try {
      const decoded = Buffer.from(value, "base64");
      if (decoded.length === KEY_BYTES) {
        return decoded;
      }
    } catch {
      // fall through
    }
  }

  // hex
  if (/^[0-9a-fA-F]+$/.test(value) && value.length === KEY_BYTES * 2) {
    try {
      const decoded = Buffer.from(value, "hex");
      if (decoded.length === KEY_BYTES) {
        return decoded;
      }
    } catch {
      // fall through
    }
  }

  return null;
}

function deriveKey(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function loadKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim();

  if (raw) {
    const decoded = decodeKeyMaterial(raw);
    cachedKey = decoded ?? deriveKey(raw);
    return cachedKey;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY environment variable is required in production. "
        + "Generate one with `node -e \"console.log(require('node:crypto').randomBytes(32).toString('base64'))\"` "
        + "and set it before booting the API server.",
    );
  }

  if (!warnedAboutDevKey) {
    warnedAboutDevKey = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[token-encryption] TOKEN_ENCRYPTION_KEY is not set. Falling back to a "
        + "development-only derived key. DO NOT run this in production without "
        + "setting a real key.",
    );
  }

  cachedKey = deriveKey("dev-only:bviral-control-center");
  return cachedKey;
}

export function isEncryptedToken(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(ENCRYPTION_PREFIX);
}

export function encryptToken(plaintext: string): string {
  if (!plaintext) {
    return plaintext;
  }

  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_PREFIX.slice(0, -1), // "enc:v1"
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptToken(value: string): string {
  if (!isEncryptedToken(value)) {
    // Legacy / un-encrypted entry — return as-is so existing rows keep working.
    return value;
  }

  const parts = value.split(":");
  if (parts.length !== 5) {
    throw new Error("Encrypted token has an invalid format.");
  }

  const [, , ivPart, authTagPart, ciphertextPart] = parts;
  const key = loadKey();
  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(authTagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");

  if (iv.length !== IV_BYTES) {
    throw new Error("Encrypted token IV has an unexpected length.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function encryptOptionalToken(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return encryptToken(value);
}

export function decryptOptionalToken(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return decryptToken(value);
}
