import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n/client";
import { getDictionary, getLocale } from "@/lib/i18n/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  return {
    title: t.meta.title,
    description: t.meta.description,
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="antialiased min-h-screen bg-background text-foreground">
        <I18nProvider locale={locale} dictionary={dictionary}>
          {children}
          <Toaster richColors position="top-right" />
        </I18nProvider>
      </body>
    </html>
  );
}
