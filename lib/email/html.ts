// Plain HTML for emails. Everything that goes in is escaped, so text a user
// typed (a client's name, a message) can't add markup.

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Paragraphs of text (line breaks kept), an optional button and a footer.
export function emailHtml(parts: {
  paragraphs: string[];
  button?: { label: string; url: string };
  footer?: string;
}): string {
  const p = (text: string) =>
    `<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(text).replace(/\r?\n/g, "<br>")}</p>`;
  const button = parts.button
    ? `<p style="margin:0 0 16px"><a href="${escapeHtml(parts.button.url)}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px">${escapeHtml(parts.button.label)}</a></p>`
    : "";
  const footer = parts.footer
    ? `<p style="margin:24px 0 0;font-size:12px;color:#6b7280">${escapeHtml(parts.footer)}</p>`
    : "";
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#111827;max-width:560px;margin:0 auto;padding:24px">${parts.paragraphs.map(p).join("")}${button}${footer}</body></html>`;
}
