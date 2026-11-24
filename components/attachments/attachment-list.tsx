"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImageIcon, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteAttachment } from "@/lib/actions/attachments";
import { MAX_ATTACHMENT_BYTES, formatBytes, type UploadErrorKey } from "@/lib/attachments/files";
import { useTranslations } from "@/lib/i18n/client";
import { formatMessage } from "@/lib/i18n/format";

export type AttachmentItem = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string | null;
};

// A payment's proof or a client's contracts: the files, each to download or
// delete, and an upload button. Uploads go to /api/attachments (route
// handlers take bigger bodies than server actions).
export function AttachmentList({
  owner,
  items,
  demo = false,
}: {
  owner: { paymentId: string } | { clientId: string };
  items: AttachmentItem[];
  // A demo account: 5 MB of files in all, not 100.
  demo?: boolean;
}) {
  const t = useTranslations();
  const a = t.attachments;
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error(a.errors.tooLarge);
      return;
    }
    const form = new FormData();
    form.set("file", file);
    if ("paymentId" in owner) form.set("paymentId", owner.paymentId);
    else form.set("clientId", owner.clientId);
    setUploading(true);
    try {
      const res = await fetch("/api/attachments", { method: "POST", body: form });
      if (res.ok) {
        toast.success(formatMessage(a.uploaded, { name: file.name }));
        router.refresh();
      } else {
        const body = (await res.json().catch(() => ({}))) as { errorKey?: UploadErrorKey };
        toast.error(a.errors[body.errorKey ?? "invalid"] ?? a.errors.invalid);
      }
    } catch {
      toast.error(a.errors.invalid);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{a.none}</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              {item.contentType === "application/pdf" ? (
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <a
                href={`/api/attachments/${item.id}`}
                className="min-w-0 flex-1 truncate underline-offset-2 hover:underline"
                title={item.filename}
              >
                {item.filename}
              </a>
              <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(item.sizeBytes)}</span>
              <DeleteAttachmentButton id={item.id} filename={item.filename} />
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
          aria-label={a.upload}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={uploading}
          onClick={() => input.current?.click()}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {a.upload}
        </Button>
        <span className="text-xs text-muted-foreground">{demo ? a.limitsDemo : a.limits}</span>
      </div>
    </div>
  );
}

function DeleteAttachmentButton({ id, filename }: { id: string; filename: string }) {
  const t = useTranslations();
  const a = t.attachments;
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
            aria-label={a.delete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{formatMessage(a.deleteTitle, { name: filename })}</AlertDialogTitle>
          <AlertDialogDescription>{a.deleteDesc}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() =>
              startTransition(async () => {
                const result = await deleteAttachment(id);
                if ("errorKey" in result) toast.error(a.errors.notFound);
              })
            }
          >
            {a.delete}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// "📎 2" next to a payment in a month card.
export function AttachmentCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5" title={String(count)}>
      <Paperclip className="h-3 w-3" />
      {count}
    </span>
  );
}
