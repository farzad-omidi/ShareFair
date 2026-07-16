import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import { LanguageProvider } from "@/lib/i18n/context";

export const metadata: Metadata = {
  title: "ShareFair — Fair shared expenses",
  description:
    "Track and split shared expenses fairly with roommates, partners, family, or a trip crew.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ShareFair",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#bfcaa8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d120e" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          {children}
          <RegisterServiceWorker />
        </LanguageProvider>
      </body>
    </html>
  );
}
