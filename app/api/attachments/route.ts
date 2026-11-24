import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { generateId } from "@/lib/utils";
import {
  ATTACHMENT_QUOTA_BYTES,
  DEMO_ATTACHMENT_QUOTA_BYTES,
  MAX_ATTACHMENT_BYTES,
  detectAttachmentType,
  sanitizeFilename,
  type UploadErrorKey,
} from "@/lib/attachments/files";
import { insertAttachment } from "@/lib/attachments/write";

// Uploads a file for one of the user's payments (proof for е-ПДД) or
// clients (contracts). A route handler, not a server action: those take at
// most 1 MB. PDF, PNG or JPEG only, told from the first bytes; up to 4 MB
// each and 100 MB in all (5 MB for a demo account).

function fail(errorKey: UploadErrorKey, status: number) {
  return Response.json({ errorKey }, { status });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail("notFound", 401);

  // Refuse an oversized body before reading it (multipart adds a little).
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_ATTACHMENT_BYTES + 64 * 1024) return fail("tooLarge", 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("invalid", 400);
  }
  const file = form.get("file");
  const paymentId = form.get("paymentId");
  const clientId = form.get("clientId");
  if (!(file instanceof File)) return fail("invalid", 400);
  const owner =
    typeof paymentId === "string" && paymentId && !clientId
      ? { paymentId }
      : typeof clientId === "string" && clientId && !paymentId
      ? { clientId }
      : null;
  if (!owner) return fail("invalid", 400);
  if (file.size === 0) return fail("type", 415);
  if (file.size > MAX_ATTACHMENT_BYTES) return fail("tooLarge", 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > MAX_ATTACHMENT_BYTES) return fail("tooLarge", 413);
  const type = detectAttachmentType(bytes);
  if (!type) return fail("type", 415);

  const id = generateId();
  const result = await insertAttachment(getDb(), {
    id,
    userId: session.userId,
    owner,
    filename: sanitizeFilename(file.name, type),
    contentType: type,
    bytes,
    quotaBytes: session.isDemo ? DEMO_ATTACHMENT_QUOTA_BYTES : ATTACHMENT_QUOTA_BYTES,
  });
  if (result === "notFound") return fail("notFound", 404);
  if (result === "overQuota") return fail(session.isDemo ? "demoQuota" : "quota", 413);
  return Response.json({ id }, { status: 201 });
}
