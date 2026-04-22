import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DT Reporting Agent",
  description: "Manager-subordinate reporting operating system prototype",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
