// How a backup file is sealed: gzip, then AES-256-GCM with BACKUP_KEY.
//
//   "FLBK1" (5 bytes) | IV (12) | auth tag (16) | ciphertext of gzip(dump)
//
// The magic is the cipher's additional data, so a file can't be passed off
// as another format. Without BACKUP_KEY nothing can be read back: the key
// lives in Vercel (Production, as a Secret) and in its owner's keychain.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";

const MAGIC = Buffer.from("FLBK1", "ascii");
const IV_BYTES = 12;
const TAG_BYTES = 16;

// BACKUP_KEY: 32 random bytes, base64 (`openssl rand -base64 32`). Null when
// it isn't set; anything else that isn't 32 bytes throws.
export function backupKey(): Buffer | null {
  const raw = process.env.BACKUP_KEY?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("BACKUP_KEY must be 32 bytes, base64-encoded");
  return key;
}

export function sealBackup(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(MAGIC);
  const body = Buffer.concat([cipher.update(gzipSync(plain)), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

// Throws if the file isn't a backup, was changed, or the key is wrong.
export function openBackup(sealed: Buffer, key: Buffer): Buffer {
  if (sealed.length < MAGIC.length + IV_BYTES + TAG_BYTES || !sealed.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Not a Freelancr backup file");
  }
  const iv = sealed.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
  const tag = sealed.subarray(MAGIC.length + IV_BYTES, MAGIC.length + IV_BYTES + TAG_BYTES);
  const body = sealed.subarray(MAGIC.length + IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(tag);
  return gunzipSync(Buffer.concat([decipher.update(body), decipher.final()]));
}
