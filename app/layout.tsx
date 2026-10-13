/* Root layout: fonts (self-hosted via next/font/local → --nf-display / --nf-body / --nf-mono), PWA metadata,
   viewport (viewport-fit=cover, theme-color), and the server-side device guess for the first paint. */
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { guessDevice } from "@/lib/device-guess";
import Providers from "./providers";
import "./globals.css";
import "../styles/mobile.css";
import "../styles/desktop.css";

// Same families/weights as the prototype's Google Fonts link (Schibsted Grotesk 500–800, Onest 400–700,
// JetBrains Mono 500–700), bundled as variable woff2 files so builds never depend on fonts.googleapis.com.
const display = localFont({ src: "./fonts/SchibstedGrotesk-Latin.woff2", weight: "500 800", variable: "--nf-display", display: "swap", fallback: ["Onest", "system-ui", "sans-serif"] });
const body = localFont({ src: "./fonts/Onest-Latin.woff2", weight: "400 700", variable: "--nf-body", display: "swap", fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"] });
const mono = localFont({ src: "./fonts/JetBrainsMono-Latin.woff2", weight: "500 700", variable: "--nf-mono", display: "swap", fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"] });

export const metadata: Metadata = {
  title: "PARKLY — Parking, reserved",
  description: "PARKLY: reserve a parking space in Delhi NCR before you arrive. Price fixed upfront, scan to enter.",
  applicationName: "PARKLY",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "PARKLY", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A0F0C",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const device = guessDevice(await headers());
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className={device === "mobile" ? "m" : "d"} suppressHydrationWarning>
        <Providers device={device}>{children}</Providers>
      </body>
    </html>
  );
}
