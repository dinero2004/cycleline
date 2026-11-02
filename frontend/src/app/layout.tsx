import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { OfflineStatus } from "@/components/offline-status";
import { Providers } from "@/providers";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["600"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Sonner reads its colours from these variables; they point at the theme tokens.
const toastStyle = {
  "--normal-bg": "var(--surface)",
  "--normal-border": "var(--line-soft)",
  "--normal-text": "var(--text)",
  "--border-radius": "var(--radius-card)",
  fontFamily: "var(--font-body)",
} as React.CSSProperties;

export const metadata: Metadata = {
  title: {
    default: "CycleLine — plan with intent",
    template: "%s · CycleLine",
  },
  description: "A personal cycling route planner for better rides, bikes, and weekly goals.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e1011" },
    { media: "(prefers-color-scheme: light)", color: "#f6f6f3" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${barlow.variable} ${inter.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* Sets data-theme before first paint so there is no flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
        <OfflineStatus />
        <Toaster position="top-right" closeButton style={toastStyle} />
      </body>
    </html>
  );
}
