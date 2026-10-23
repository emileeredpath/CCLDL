import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  other: { "ccldl-release": "20261023-desktop-players" },
  title: "CCLDL · Chelmsford City Ladies Darts League",
  description:
    "Private committee workspace for Chelmsford City Ladies Darts League",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "CCLDL", statusBarStyle: "default" },
  icons: { apple: "/icon-192.png", icon: "/icon-192.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#be426d",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
