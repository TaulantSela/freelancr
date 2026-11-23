import { getSession } from "@/lib/auth/session";
import { getAttachmentFile } from "@/lib/attachments/queries";
import { contentDisposition } from "@/lib/attachments/files";

// Downloads one of the user's files. Anything that isn't theirs is a 404,
// the same as a file that doesn't exist.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const notFound = () => new Response("Not found", { status: 404 });
  const session = await getSession();
  if (!session) return notFound();

  const { id } = await params;
  const file = await getAttachmentFile(id, session.userId);
  if (!file) return notFound();

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.data.byteLength),
      "Content-Disposition": contentDisposition(file.filename),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
