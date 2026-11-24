// Attachments: what's accepted and how it's named. Pure.

// Per file: under Vercel's 4.5 MB request limit, multipart overhead
// included.
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
// Everything one user keeps.
export const ATTACHMENT_QUOTA_BYTES = 100 * 1024 * 1024;
// Demo accounts (the shared one and the sandboxes) keep less.
export const DEMO_ATTACHMENT_QUOTA_BYTES = 5 * 1024 * 1024;

export type AttachmentType = "application/pdf" | "image/png" | "image/jpeg";

// Why an upload was refused (the upload route answers with one of these).
export type UploadErrorKey = "tooLarge" | "type" | "quota" | "demoQuota" | "notFound" | "invalid";

const EXTENSIONS: Record<AttachmentType, string[]> = {
  "application/pdf": ["pdf"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
};

// The file's type from its first bytes (%PDF-, \x89PNG, \xFF\xD8\xFF), never
// from its name or what the browser says; null for anything else.
export function detectAttachmentType(bytes: Uint8Array): AttachmentType | null {
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (starts([0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  return null;
}

// A name that's safe to store and to send back in a header: no folders, no
// control or reserved characters (<>:"/\|?*), no leading dots, at most 120
// characters, and an extension that matches the detected type.
export function sanitizeFilename(name: string, type: AttachmentType): string {
  const base = (name.split(/[\\/]/).pop() ?? "").normalize("NFC");
  let clean = base
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+/, "")
    .replace(/[.\s]+$/, "");
  const dot = clean.lastIndexOf(".");
  const ext = dot > 0 ? clean.slice(dot + 1).toLowerCase() : "";
  let stem = EXTENSIONS[type].includes(ext) ? clean.slice(0, dot) : clean;
  if (!stem) stem = "file";
  const extension = EXTENSIONS[type].includes(ext) ? ext : EXTENSIONS[type][0];
  stem = Array.from(stem).slice(0, 120 - extension.length - 1).join("").trim() || "file";
  clean = `${stem}.${extension}`;
  return clean;
}

// Content-Disposition for a download: an ASCII fallback name and the real
// one as UTF-8 (RFC 6266 / RFC 5987).
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

// "1.2 MB", "340 KB"
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
