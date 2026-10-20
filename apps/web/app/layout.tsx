import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppShell } from "./components/AppShell";
import "./globals.css";

const publicSans = localFont({
  src: "./fonts/PublicSans.ttf",
  display: "swap",
  variable: "--font-public-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: { default: "DevRelay", template: "%s · DevRelay" },
  description: "Borderless AI incident response for modern software teams",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={publicSans.variable}>
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
