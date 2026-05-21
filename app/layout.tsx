import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TokenMaxing",
  description: "AI token usage leaderboard",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
