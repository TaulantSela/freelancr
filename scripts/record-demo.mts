/**
 * Records the walkthrough on /demo in one language: a visitor opens a
 * sandbox ("Try it with sample data") and goes through Freelancr, from the
 * profile to the dashboard, with a caption per chapter from lib/demo/script.ts.
 *
 *   1. A scratch database, never production (this creates a sandbox, an
 *      invoice and a payment in it). In the shell, so it wins over any
 *      .env.local:
 *        export DATABASE_URL=<a scratch Neon branch's connection string>
 *        npx tsx lib/db/migrate.ts
 *   2. A production build served on it: `npm run build && npm start`
 *   3. `npm run demo:record -- http://localhost:3000 --lang en` (and mk, sq)
 *
 * Writes public/demo/<lang>/: walkthrough.mp4 (and walkthrough.webm when
 * it's clearly smaller), poster.webp, step-<n>.webp (chapter n, for the
 * guide) and chapters.json (each chapter's start). Uses the installed
 * Google Chrome (CHROME_PATH to override), ffmpeg and pdftoppm (poppler).
 * Stop motion: a full-resolution screenshot after every change, each held
 * for an exact time, then ffmpeg.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import puppeteer, { type Page } from "puppeteer-core";
import sharp from "sharp";
import { DEMO_SCRIPT, DEMO_SITE } from "../lib/demo/script";
import { dictionaries } from "../lib/i18n/dictionaries";
import type { Locale } from "../lib/i18n/types";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// 1280x800 CSS pixels at 1.25x: frames of 1600x1000, encoded as they are.
const VIEWPORT = { width: 1280, height: 800, deviceScaleFactor: 1.25 };
const FPS = 30;

const base = process.argv[2];
const langArg = process.argv[process.argv.indexOf("--lang") + 1];
if (!base || !process.argv.includes("--lang") || !["en", "mk", "sq"].includes(langArg)) {
  throw new Error("usage: npm run demo:record -- <base-url> --lang en|mk|sq");
}
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(base)) {
  throw new Error("Record against a local server only: the script creates a sandbox and records a payment.");
}
const lang = langArg as Locale;
const t = dictionaries[lang];
const script = DEMO_SCRIPT[lang];
const OUT = path.join("public/demo", lang);
const WORK = path.join(".demo-recording", lang);
const url = (p: string) => new URL(p, base).toString();

function ease(k: number) {
  return k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
}

// "YYYY-MM-DD" in Skopje, `days` from today.
function skopjeDate(days = 0) {
  const d = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Skopje" }).format(d);
}

/**
 * Stop-motion recording: a full-resolution screenshot after every change,
 * each held for an exact time, assembled at a steady frame rate. The
 * caption and the pointer are drawn into the page, so they're in the frames.
 */
class Film {
  private frames: { file: string; seconds: number }[] = [];
  private pointer = { x: VIEWPORT.width * 0.62, y: VIEWPORT.height * 0.55 };
  private caption: { title: string; text: string } | null = null;
  private showPointer = false;
  readonly chapters: { id: string; title: string; start: number }[] = [];

  constructor(
    private page: Page,
    private dir: string,
  ) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }

  get elapsed() {
    return this.frames.reduce((sum, f) => sum + f.seconds, 0);
  }

  /** Starts chapter `index` (0-based): its caption from now on. */
  chapter(index: number, { caption = true } = {}) {
    const c = script.chapters[index];
    this.chapters.push({ id: c.id, title: c.title, start: Math.round(this.elapsed * 10) / 10 });
    this.caption = caption ? { title: c.title, text: c.caption } : null;
  }

  /** Shows chapter `index`'s caption without starting a chapter. */
  showCaption(index: number) {
    const c = script.chapters[index];
    this.caption = { title: c.title, text: c.caption };
  }

  pointerOn(on = true) {
    this.showPointer = on;
  }

  /** Draws (or redraws, after a navigation) the caption and the pointer. */
  private async overlay() {
    await this.page.evaluate(
      ({ caption, pointer, showPointer }) => {
        // Room under the app's content, so anything can scroll clear of the caption.
        if (!document.getElementById("demo-style")) {
          const style = document.createElement("style");
          style.id = "demo-style";
          style.textContent = "main::after{content:'';display:block;height:150px}";
          document.head.append(style);
        }
        let box = document.getElementById("demo-caption");
        if (caption) {
          if (!box) {
            box = document.createElement("div");
            box.id = "demo-caption";
            Object.assign(box.style, {
              position: "fixed",
              left: "50%",
              bottom: "26px",
              transform: "translateX(-50%)",
              width: "max-content",
              maxWidth: "920px",
              padding: "12px 22px 14px",
              borderRadius: "12px",
              background: "rgba(9, 9, 11, 0.88)",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.45)",
              color: "#fafafa",
              textAlign: "center",
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              zIndex: "2147483646",
              pointerEvents: "none",
            });
            box.innerHTML = '<div data-t style="font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#93b4ff;margin-bottom:4px"></div><div data-x style="font-size:17px;line-height:1.4"></div>';
            document.body.append(box);
          }
          box.querySelector<HTMLElement>("[data-t]")!.textContent = caption.title;
          box.querySelector<HTMLElement>("[data-x]")!.textContent = caption.text;
        } else box?.remove();

        let dot = document.getElementById("demo-pointer");
        if (showPointer) {
          if (!dot) {
            dot = document.createElement("div");
            dot.id = "demo-pointer";
            Object.assign(dot.style, {
              position: "fixed",
              left: "0",
              top: "0",
              width: "26px",
              height: "26px",
              margin: "-13px 0 0 -13px",
              borderRadius: "50%",
              background: "rgba(59, 130, 246, 0.35)",
              border: "2px solid rgba(255, 255, 255, 0.95)",
              boxShadow: "0 3px 12px rgba(0, 0, 0, 0.45)",
              pointerEvents: "none",
              zIndex: "2147483647",
            });
            document.body.append(dot);
          }
          dot.style.transform = `translate(${pointer.x}px, ${pointer.y}px) scale(${pointer.scale ?? 1})`;
        } else dot?.remove();
      },
      { caption: this.caption, pointer: { ...this.pointer, scale: 1 }, showPointer: this.showPointer },
    );
  }

  private async scalePointer(scale: number) {
    await this.page.evaluate((scale) => {
      const dot = document.getElementById("demo-pointer");
      if (dot) dot.style.transform = dot.style.transform.replace(/scale\([^)]*\)/, `scale(${scale})`);
    }, scale);
  }

  /** Waits for React to render and the browser to paint, then holds a frame. */
  async shot(seconds: number) {
    await this.overlay();
    await this.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const file = path.join(this.dir, `${String(this.frames.length).padStart(5, "0")}.jpg`);
    await this.page.screenshot({ path: file as `${string}.jpg`, type: "jpeg", quality: 90 });
    this.frames.push({ file: path.resolve(file), seconds });
  }

  /** Adds an image of the viewport's size as a frame (the PDF, cards). */
  pushImage(file: string, seconds: number) {
    this.frames.push({ file: path.resolve(file), seconds });
  }

  /** Moves the pointer to (x, y) over `seconds`, eased. */
  async moveTo(x: number, y: number, seconds = 0.45) {
    const from = { ...this.pointer };
    const n = Math.max(1, Math.round(seconds * FPS));
    for (let i = 1; i <= n; i++) {
      const k = ease(i / n);
      this.pointer = { x: from.x + (x - from.x) * k, y: from.y + (y - from.y) * k };
      await this.shot(1 / FPS);
    }
  }

  /** Scrolls the page (or the app's scrolling <main>) so `selector` sits in the upper part. */
  async scrollTo(selector: string, seconds = 0.6, at = 0.22) {
    const [from, to] = await this.page.evaluate(
      ({ selector, at }) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error(`not found: ${selector}`);
        const main = document.querySelector("main");
        const scroller = main && main.scrollHeight > main.clientHeight ? main : document.scrollingElement!;
        const max = scroller.scrollHeight - scroller.clientHeight;
        const top = el.getBoundingClientRect().top - (scroller === main ? main.getBoundingClientRect().top : 0);
        const target = scroller.scrollTop + top - scroller.clientHeight * at;
        return [scroller.scrollTop, Math.max(0, Math.min(max, target))];
      },
      { selector, at },
    );
    if (Math.abs(to - from) < 4) return;
    const n = Math.max(1, Math.round(seconds * FPS));
    for (let i = 1; i <= n; i++) {
      await this.page.evaluate((y) => {
        const main = document.querySelector("main");
        const scroller = main && main.scrollHeight > main.clientHeight ? main : document.scrollingElement!;
        scroller.scrollTop = y;
      }, from + (to - from) * ease(i / n));
      await this.shot(1 / FPS);
    }
  }

  private async centerOf(selector: string) {
    return this.page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`not found: ${selector}`);
      const r = el.getBoundingClientRect();
      return { x: r.left + Math.min(r.width / 2, 140), y: r.top + r.height / 2 };
    }, selector);
  }

  /** Points at `selector` without clicking. */
  async pointAt(selector: string, { scroll = true } = {}) {
    if (scroll) await this.scrollTo(selector);
    const p = await this.centerOf(selector);
    await this.moveTo(p.x, p.y);
  }

  /** Scrolls to the element, moves the pointer onto it and clicks it. */
  async click(selector: string, { scroll = true } = {}) {
    await this.pointAt(selector, { scroll });
    for (const s of [0.9, 0.8]) {
      await this.scalePointer(s);
      await this.shot(1 / FPS);
    }
    await this.page.click(selector);
    for (const s of [0.9, 1]) {
      await this.scalePointer(s);
      await this.shot(1 / FPS);
    }
  }

  /** Clicks the field and types, a frame every other character. */
  async type(selector: string, text: string) {
    await this.click(selector);
    await this.page.evaluate((selector) => {
      const el = document.querySelector<HTMLInputElement>(selector);
      if (el) el.select?.();
    }, selector);
    let i = 0;
    for (const ch of text) {
      await this.page.keyboard.type(ch);
      if (++i % 2 === 0) await this.shot(0.07);
    }
    await this.shot(0.3);
  }

  /** A clean screenshot for the guide (no caption, no pointer, no toasts). */
  async still(file: string) {
    await this.page
      .waitForFunction(() => !document.querySelector("[data-sonner-toast]"), { timeout: 8_000 })
      .catch(() => {});
    await this.page.evaluate(() => {
      document.getElementById("demo-caption")?.remove();
      document.getElementById("demo-pointer")?.remove();
    });
    const png = path.join(this.dir, "still.png");
    await this.page.screenshot({ path: png as `${string}.png` });
    await sharp(png).webp({ quality: 78 }).toFile(file);
    await this.overlay();
  }

  write(out: string): string {
    const step = 1 / FPS;
    const last = this.frames.at(-1)!;
    const entries = this.frames.slice(0, -1).map((f) => [f.file, f.seconds] as const);
    // ffmpeg holds the final frame for as long as the gap before it, and the
    // concat format wants the last file repeated. So the last hold ends with a
    // one-frame step, then the repeat: otherwise the last hold plays twice.
    entries.push([last.file, Math.max(step, last.seconds - step)], [last.file, step]);
    const list = entries.map(([file, seconds]) => `file '${file}'\nduration ${seconds.toFixed(4)}`).join("\n");
    const listFile = path.join(this.dir, "list.txt");
    writeFileSync(listFile, `${list}\nfile '${last.file}'\n`);
    execFileSync("ffmpeg", [
      "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listFile,
      "-vf", `fps=${FPS},scale=${VIEWPORT.width * VIEWPORT.deviceScaleFactor}:-2,format=yuv420p`,
      "-c:v", "libx264", "-crf", "12", "-preset", "fast", out,
    ]);
    console.log(`filmed ${this.frames.length} frames, ${this.elapsed.toFixed(1)} s`);
    return out;
  }
}

/**
 * Marks the first element matching `selector` whose text includes `text`; returns a selector for it.
 * Waits up to 10 s for it: a page can still be rendering after the network goes idle.
 */
async function mark(page: Page, selector: string, text: string, name: string, { last = false } = {}) {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const found = await page.evaluate(
      ({ selector, text, name, last }) => {
        const all = [...document.querySelectorAll(selector)].filter((e) => e.textContent?.includes(text));
        const el = last ? all.at(-1) : all[0];
        el?.setAttribute("data-demo", name);
        return !!el;
      },
      { selector, text, name, last },
    );
    if (found) break;
    if (Date.now() > deadline) throw new Error(`no ${selector} containing "${text}"`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return `[data-demo="${name}"]`;
}

/** Sets a React-controlled input the way typing would. */
async function setValue(page: Page, selector: string, value: string) {
  await page.evaluate(
    ({ selector, value }) => {
      const el = document.querySelector<HTMLInputElement>(selector)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { selector, value },
  );
}

async function go(page: Page, p: string) {
  await page.goto(url(p), { waitUntil: "networkidle0", timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
}

const waitText = (page: Page, text: string, timeout = 20_000) =>
  page.waitForFunction((text) => document.body.innerText.includes(text), { timeout }, text);

/** A full-frame card: the app's look, the title card or the end card. */
async function card(page: Page, film: Film, html: string, seconds: number) {
  await page.evaluate((html) => {
    document.body.innerHTML = `<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 30%, #172554 0%, #09090b 62%);font-family:var(--font-geist-sans),system-ui,sans-serif;color:#fafafa;text-align:center">${html}</div>`;
  }, html);
  await film.shot(seconds);
}

const logo = `<div style="display:inline-flex;align-items:center;gap:14px;margin-bottom:26px"><div style="width:56px;height:56px;border-radius:12px;background:#2563eb;display:flex;align-items:center;justify-content:center"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg></div><span style="font-size:52px;font-weight:600;letter-spacing:-.02em">Freelancr</span></div>`;

/** A one-page PDF with a few lines of text: the "bank statement" to attach. */
function samplePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const text = lines.map((l, i) => `BT /F1 ${i === 0 ? 16 : 11} Tf 56 ${780 - i * 22} Td (${esc(l)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(body));
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

async function walkthrough(page: Page, film: Film) {
  const today = skopjeDate();
  // Yesterday (in this month), so the National Bank's list for the day is out.
  const day = Number(today.slice(8, 10)) > 1 ? skopjeDate(-1) : today;
  const thisMonth = today.slice(0, 7);
  const [y, m] = thisMonth.split("-").map(Number);
  const twoMonthsAgo = new Date(Date.UTC(y, m - 3, 1)).toISOString().slice(0, 7);

  // 1. The title card, then the landing page's "Try it with sample data".
  film.chapter(0, { caption: false });
  await go(page, "/");
  await card(page, film, `<div>${logo}<div style="font-size:26px;color:#cbd5e1;max-width:900px;line-height:1.4">${script.tagline}</div></div>`, 3.2);
  await go(page, "/");
  film.showCaption(0);
  film.pointerOn();
  await film.shot(1.4);
  await film.click('[data-demo="sandbox"]', { scroll: false });
  await page.waitForFunction(() => location.pathname === "/dashboard", { timeout: 30_000 });
  await page.waitForNetworkIdle({ idleTime: 300, timeout: 30_000 });
  await film.shot(2.2);

  // 2. The profile.
  await go(page, "/settings");
  film.chapter(1);
  await film.shot(1.2);
  await film.pointAt('input[name="taxStatus"][value="paid_from_abroad"]');
  await film.shot(1.8);
  await film.pointAt('input[name="vatRegistered"]');
  await film.shot(1.4);
  await film.still(path.join(OUT, "step-2.webp"));
  await film.pointAt("#iban");
  await film.shot(1.8);

  // 3. Clients.
  await go(page, "/clients");
  film.chapter(2);
  await film.shot(1.2);
  await film.pointAt(await mark(page, "main span", "Vardar Print DOOEL", "vardar"), { scroll: false });
  await film.shot(1.2);
  await film.pointAt(await mark(page, "main span", "Startup Labs NYC", "labs"), { scroll: false });
  await film.shot(1.0);
  await film.still(path.join(OUT, "step-3.webp"));
  const acme = await page.evaluate(() => {
    const card = [...document.querySelectorAll('main [data-slot="card"]')].find((c) => c.textContent?.includes("Acme GmbH"));
    return card?.querySelector<HTMLAnchorElement>('a[href$="/edit"]')?.getAttribute("href") ?? null;
  });
  if (!acme) throw new Error("no edit link for Acme GmbH");
  await film.click(`a[href="${acme}"]`);
  await page.waitForSelector("#invoiceLanguage", { timeout: 20_000 });
  await film.shot(0.6);
  await film.pointAt("#invoiceLanguage");
  await film.shot(2.0);

  // 4. An invoice: a draft, issued, and its PDF.
  await go(page, "/invoices/new");
  film.chapter(3);
  await film.shot(1.0);
  const labs = await page.evaluate(
    () => [...document.querySelectorAll<HTMLOptionElement>("#clientId option")].find((o) => o.textContent === "Startup Labs NYC")?.value,
  );
  if (!labs) throw new Error("no Startup Labs NYC in the client list");
  await film.click("#clientId");
  await page.select("#clientId", labs);
  await film.shot(0.6);
  await setValue(page, "#date", day);
  await film.shot(0.4);
  await page.evaluate(() => {
    const row = document.querySelector('input[placeholder]:not([type="number"]):not([type="date"])');
    row?.closest("div.grid")?.querySelectorAll("input").forEach((input, i) => input.setAttribute("data-demo", `item-${i}`));
  });
  await film.type('[data-demo="item-0"]', demoItem());
  await film.type('[data-demo="item-2"]', "1200");
  await film.shot(0.6);
  await film.click(await mark(page, 'main button[type="submit"]', t.invoices.form.submit, "create"));
  // The new invoice's page: /invoices/new matches /invoices/<x> too, so wait until it's not the form.
  await page.waitForFunction(() => /^\/invoices\/(?!new$)[^/]+$/.test(location.pathname), { timeout: 30_000 });
  await page.waitForNetworkIdle({ idleTime: 300, timeout: 30_000 });
  const invoicePath = await page.evaluate(() => location.pathname);
  await film.shot(1.4);
  await film.click(await mark(page, "main button", t.invoices.issue.button, "issue"));
  await page.waitForSelector('[role="alertdialog"]', { timeout: 10_000 });
  await film.shot(1.2);
  await film.click(await mark(page, '[role="alertdialog"] button', t.invoices.issue.confirm, "confirm", { last: true }), { scroll: false });
  await page.waitForFunction(() => !document.querySelector('[role="alertdialog"]'), { timeout: 20_000 });
  await page.waitForFunction(() => /INV-\d{4}-\d{3}/.test(document.querySelector("main h1, main [class*=card] [class*=font-mono]")?.textContent ?? document.body.innerText), { timeout: 20_000 });
  await page.waitForNetworkIdle({ idleTime: 300, timeout: 30_000 });
  await film.shot(1.6);
  await film.still(path.join(OUT, "step-4.webp"));
  await film.pointAt(await mark(page, "main button, main a", t.invoices.downloadPdf, "pdf"), { scroll: false });
  await film.shot(0.8);
  // The PDF the button downloads, page 1, full frame.
  const pdf = await page.evaluate(async (p) => {
    const res = await fetch(`/api/invoices/${p.split("/").pop()}/pdf`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  }, invoicePath);
  const pdfFile = path.join(WORK, "invoice.pdf");
  writeFileSync(pdfFile, Buffer.from(pdf, "base64"));
  execFileSync("pdftoppm", ["-png", "-r", "160", "-f", "1", "-l", "1", "-singlefile", pdfFile, path.join(WORK, "invoice")]);
  const page1 = readFileSync(path.join(WORK, "invoice.png")).toString("base64");
  await page.evaluate((png) => {
    const view = document.createElement("div");
    view.id = "demo-pdf";
    view.style.cssText = "position:fixed;inset:0;z-index:2147483600;background:#18181b;display:flex;align-items:flex-start;justify-content:center;padding:18px 0 0";
    view.innerHTML = `<img src="data:image/png;base64,${png}" style="height:calc(100vh - 36px);box-shadow:0 12px 40px rgba(0,0,0,.6);border-radius:4px">`;
    document.body.append(view);
  }, page1);
  await page.evaluate(() => document.querySelector<HTMLImageElement>("#demo-pdf img")!.decode());
  film.pointerOn(false);
  await film.shot(3.6);
  film.pointerOn();

  // 5. A payment: the National Bank's rate for the day fills in.
  await go(page, invoicePath);
  film.chapter(4);
  await film.shot(0.8);
  await film.click(`a[href^="/payments/new?invoice="]`);
  await page.waitForSelector("#receivedOn", { timeout: 20_000 });
  await setValue(page, "#receivedOn", day);
  // The National Bank's rate for the day (the line only shows once it's in).
  await page.waitForFunction(
    () => [...document.querySelectorAll("main p.font-mono")].some((p) => p.textContent?.includes("USD")),
    { timeout: 20_000 },
  );
  await film.shot(1.0);
  await film.pointAt("#amount");
  await film.shot(1.2);
  const rateLine = await mark(page, "main p.font-mono", "USD", "rate");
  await film.pointAt(rateLine);
  await film.shot(2.0);
  await film.still(path.join(OUT, "step-5.webp"));
  await film.click(await mark(page, 'main button[type="submit"]', t.payments.form.submit, "save"));
  await page.waitForFunction((p) => location.pathname === p, { timeout: 30_000 }, invoicePath);
  await page.waitForNetworkIdle({ idleTime: 300, timeout: 30_000 });
  await film.shot(1.0);
  await film.pointAt(await mark(page, '[data-slot="card"] span, [data-slot="card"] div', t.invoices.standing.paid, "paid-badge"), { scroll: false });
  await film.shot(1.8);

  // 6. What you owe UJP this month.
  await go(page, `/payments?year=${thisMonth.slice(0, 4)}`);
  film.chapter(5);
  await film.shot(0.8);
  await film.scrollTo(`#month-${thisMonth}`, 0.7, 0.05);
  await film.shot(0.8);
  await film.pointAt(`#month-${thisMonth} [data-slot="card-title"]`, { scroll: false });
  await film.shot(2.4);
  await film.still(path.join(OUT, "step-6.webp"));
  await film.shot(1.2);

  // 7. A company in North Macedonia: the tax it withheld.
  film.chapter(6);
  await film.scrollTo(`#month-${twoMonthsAgo}`, 0.8, 0.05);
  await film.shot(0.6);
  await film.pointAt(await mark(page, `#month-${twoMonthsAgo} *`, t.payments.alreadyPaidPart, "withheld", { last: true }), { scroll: false });
  await film.shot(2.6);
  await film.still(path.join(OUT, "step-7.webp"));
  await film.shot(0.8);

  // 8. Filing: the calculation, UJP's approval, the payment.
  film.chapter(7);
  await film.scrollTo(`#month-${thisMonth}`, 0.8, 0.05);
  const a = t.payments.monthActions;
  await film.type(`#month-${thisMonth} input[aria-label="${a.calculationNumber}"]`, "08-1234567");
  await film.click(await mark(page, `#month-${thisMonth} button`, a.markFiled, "filed"), { scroll: false });
  await page.waitForSelector(`#month-${thisMonth} input[aria-label="${a.folioNumber}"]`, { timeout: 20_000 });
  await film.shot(0.8);
  await film.type(`#month-${thisMonth} input[aria-label="${a.folioNumber}"]`, "F-2201");
  await film.click(await mark(page, `#month-${thisMonth} button`, a.markApproved, "approved"), { scroll: false });
  await page.waitForFunction(
    (sel, label) => [...document.querySelectorAll(sel)].some((b) => b.textContent?.includes(label)) && !document.querySelector(`${sel.split(" ")[0]} input[aria-label="${label}"]`),
    { timeout: 20_000 },
    `#month-${thisMonth} button`,
    a.markPaid,
  );
  await sleep(600);
  await film.shot(0.8);
  await film.click(await mark(page, `#month-${thisMonth} button`, a.markPaid, "paid"), { scroll: false });
  await sleep(1200);
  await page.waitForNetworkIdle({ idleTime: 300, timeout: 30_000 });
  await film.shot(0.8);
  // The toasts fade after 4 seconds; the month's badge shows again.
  await page.waitForFunction(() => !document.querySelector("[data-sonner-toast]"), { timeout: 15_000 });
  await film.scrollTo(`#month-${thisMonth}`, 0.3, 0.05);
  await film.shot(1.4);
  await film.pointAt(`#month-${thisMonth} [data-slot="card-title"]`, { scroll: false });
  await film.shot(1.8);
  await film.still(path.join(OUT, "step-8.webp"));

  // 9. Proof (a bank statement on the payment) and the CSV export.
  await go(page, invoicePath);
  film.chapter(8);
  const editPayment = await page.evaluate(() => document.querySelector<HTMLAnchorElement>('main a[href^="/payments/"][href$="/edit"]')?.getAttribute("href") ?? null);
  if (!editPayment) throw new Error("no payment to edit on the invoice");
  await film.shot(0.6);
  await film.click(`a[href="${editPayment}"]`);
  await page.waitForSelector('input[type="file"]', { timeout: 20_000 });
  await page.waitForNetworkIdle({ idleTime: 300, timeout: 30_000 });
  const statement = path.resolve(WORK, lang === "en" ? "bank-statement.pdf" : "izvod.pdf");
  writeFileSync(statement, samplePdf(["Komercijalna Banka AD", `Izvod / Bank statement ${day.slice(0, 7)}`, `${day}   +1,200.00 USD   Startup Labs NYC`]));
  const upload = await mark(page, "main button", t.attachments.upload, "upload");
  await film.scrollTo(upload, 0.7, 0.45);
  const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 10_000 }), film.click(upload, { scroll: false })]);
  await chooser.accept([statement]);
  await waitText(page, path.basename(statement), 20_000);
  await page.waitForNetworkIdle({ idleTime: 300, timeout: 30_000 });
  await film.shot(1.2);
  await film.pointAt(await mark(page, "main a, main span", path.basename(statement), "file", { last: true }), { scroll: false });
  await film.shot(1.6);
  await film.still(path.join(OUT, "step-9.webp"));
  await go(page, `/payments?year=${thisMonth.slice(0, 4)}`);
  await film.shot(0.6);
  const exportLink = 'a[href^="/api/export/payments"]';
  await film.pointAt(exportLink, { scroll: false });
  await film.shot(0.4);
  await film.click(exportLink, { scroll: false });
  const csv = await page.evaluate(async (href) => (await fetch(href)).text(), await page.$eval(exportLink, (a) => a.getAttribute("href")!));
  const rows = parseCsv(csv.replace(/^﻿/, ""));
  const cols = (["received_on", "client", "invoice_number", "currency", "amount_credited", "received_mkd", "owed_mkd", "ujp_status"] as const)
    .map((k) => rows[0].indexOf(t.exports.payments[k]))
    .filter((i) => i >= 0);
  const table = rows.slice(0, 11).map((r) => cols.map((i) => r[i] ?? ""));
  // Built here: functions defined inside page.evaluate get tsx's helpers,
  // which don't exist in the page.
  const esc = (text: string) => text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  const tableHtml = `<div style="font-size:13px;color:#a1a1aa;margin-bottom:12px">payments-${thisMonth.slice(0, 4)}.csv</div><table style="border-collapse:collapse;font-size:14px;width:100%">${table
    .map(
      (r, i) =>
        `<tr style="${i === 0 ? "background:#1e293b;color:#cbd5e1" : i % 2 ? "" : "background:#141418"}">${r
          .map((c) => `<td style="border:1px solid #27272a;padding:7px 9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px">${esc(c)}</td>`)
          .join("")}</tr>`,
    )
    .join("")}</table>`;
  await page.evaluate((html) => {
    const view = document.createElement("div");
    view.style.cssText = "position:fixed;inset:0;z-index:2147483600;background:#0b0b0e;padding:28px 34px;font-family:var(--font-geist-mono),ui-monospace,monospace;color:#e4e4e7";
    view.innerHTML = html;
    document.body.append(view);
  }, tableHtml);
  film.pointerOn(false);
  await film.shot(3.2);
  film.pointerOn();

  // 10. The dashboard.
  await go(page, "/dashboard");
  film.chapter(9);
  await film.shot(2.0);
  await film.still(path.join(OUT, "step-10.webp"));
  await film.pointAt('main [data-slot="card"]', { scroll: false });
  await film.shot(1.6);
  await film.pointAt(await mark(page, '[data-slot="card-title"]', t.dashboard.ddvMonitor, "ddv"));
  await film.shot(1.8);
  await film.pointAt(await mark(page, '[data-slot="card-title"]', t.dashboard.recentInvoices, "recent"));
  await film.shot(1.8);

  // 11. The end card.
  film.chapter(10, { caption: false });
  film.pointerOn(false);
  await card(
    page,
    film,
    `<div>${logo}<div style="font-size:34px;font-weight:600;margin-bottom:14px">${t.demo.tryButton}</div><div style="font-size:24px;color:#93b4ff">${DEMO_SITE}</div></div>`,
    4.2,
  );
}

// In English whatever the app's language: the client is abroad, and so is
// its invoice's language.
function demoItem() {
  return "Website redesign, phase 2";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

/** mp4 (H.264), webm (VP9) if it's clearly smaller, a poster, and the chapters. */
async function encode(raw: string, film: Film) {
  const dur = Number(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", raw]).toString().trim(),
  );
  if (!Number.isFinite(dur)) throw new Error(`couldn't read the duration of ${raw}`);
  const vf = `fade=t=in:st=0:d=0.4,fade=t=out:st=${(dur - 0.6).toFixed(2)}:d=0.6`;
  const ff = (...args: string[]) => execFileSync("ffmpeg", ["-y", "-v", "error", "-i", raw, "-vf", vf, "-an", ...args]);
  const mp4 = path.join(OUT, "walkthrough.mp4");
  const webm = path.join(OUT, "walkthrough.webm");
  // Mostly still frames: a long keyframe interval and the still-image tuning
  // keep it under about 4 MB with the text sharp.
  ff("-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "30", "-preset", "veryslow", "-tune", "stillimage", "-g", "600", "-movflags", "+faststart", mp4);
  const tmpWebm = path.join(WORK, "walkthrough.webm");
  ff("-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-g", "600", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", tmpWebm);
  const mp4Size = statSync(mp4).size;
  const webmSize = statSync(tmpWebm).size;
  // Kept only when clearly smaller; the page offers it before the mp4.
  if (webmSize < mp4Size * 0.8) writeFileSync(webm, readFileSync(tmpWebm));
  else rmSync(webm, { force: true });
  const poster = path.join(WORK, "poster.png");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", "1.2", "-i", raw, "-frames:v", "1", poster]);
  await sharp(poster).webp({ quality: 80 }).toFile(path.join(OUT, "poster.webp"));
  writeFileSync(
    path.join(OUT, "chapters.json"),
    `${JSON.stringify({ duration: Math.round(dur * 10) / 10, webm: existsSync(webm), chapters: film.chapters }, null, 2)}\n`,
  );
  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;
  console.log(`wrote ${OUT}: walkthrough.mp4 ${mb(mp4Size)}${existsSync(webm) ? `, walkthrough.webm ${mb(webmSize)}` : ` (webm ${mb(webmSize)} not kept)`}, ${dur.toFixed(1)} s`);
}

mkdirSync(WORK, { recursive: true });
mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--lang=en-GB"] });
try {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await browser.setCookie({ name: "freelancr_locale", value: lang, domain: new URL(base).hostname, path: "/" });
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "deny" });
  const film = new Film(page, path.join(WORK, "frames"));
  await walkthrough(page, film);
  await encode(film.write(path.join(WORK, "raw.mp4")), film);
} finally {
  await browser.close();
  if (!process.env.KEEP_FRAMES) rmSync(WORK, { recursive: true, force: true });
}
