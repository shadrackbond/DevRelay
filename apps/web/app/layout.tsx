import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevRelay",
  description: "Borderless AI incident response for modern software teams",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
