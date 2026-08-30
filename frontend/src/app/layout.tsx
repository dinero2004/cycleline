import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "@/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const siteOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: {
    default: "CycleLine — Better routes for every ride",
    template: "%s · CycleLine",
  },
  description: "Choose a safer, faster or flatter cycling line and ride with better context.",
  openGraph: {
    title: "CycleLine — Better routes for every ride",
    description: "Choose a safer, faster or flatter cycling line and ride with better context.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "CycleLine — Better routes for every ride" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CycleLine — Better routes for every ride",
    description: "Choose a safer, faster or flatter cycling line and ride with better context.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable}`}
      data-scroll-behavior="smooth"
    >
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
