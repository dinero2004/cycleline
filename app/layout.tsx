import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CycleLine — Better routes for every ride",
  description: "Plan safer, faster and more comfortable cycling routes with clear comparisons and live ride context.",
  openGraph: {
    title: "CycleLine — Better routes for every ride",
    description: "Choose a safer, faster or flatter line and ride with better context.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "CycleLine — Better routes for every ride",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CycleLine — Better routes for every ride",
    description: "Choose a safer, faster or flatter line and ride with better context.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={spaceGrotesk.variable}>{children}</body>
    </html>
  );
}
