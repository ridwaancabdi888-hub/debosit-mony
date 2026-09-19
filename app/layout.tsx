import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/auth";

import { AppShell } from "@/components/AppShell";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
import { TodayProvider } from "@/components/TodayProvider";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  type Language,
} from "@/i18n/translations";
import {
  LANGUAGE_STORAGE_KEY,
  THEME_INIT_SCRIPT,
} from "@/lib/client-storage";
import { todayIso } from "@/lib/dates";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Maareynta Lacagta",
  description:
    "Manage fixed-term deposits that return the principal plus a 35% profit.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1014" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Seeds the client's "today"; TodayProvider corrects it to the browser's
  // local date before paint so "Due Today" is right in every timezone.
  const serverToday = todayIso();

  // Cookie hint mirrored from localStorage, so the first paint is already in
  // the user's chosen language instead of flipping after hydration.
  const user = await getCurrentUser();

  const cookieValue = (await cookies()).get(LANGUAGE_STORAGE_KEY)?.value;
  const initialLanguage: Language = LANGUAGES.includes(
    cookieValue as Language,
  )
    ? (cookieValue as Language)
    : DEFAULT_LANGUAGE;

  return (
    <html
      lang={initialLanguage}
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved theme before first paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider>
          <LanguageProvider initialLanguage={initialLanguage}>
            <TodayProvider serverToday={serverToday}>
              <ToastProvider>
                <AppShell user={user}>{children}</AppShell>
              </ToastProvider>
            </TodayProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
