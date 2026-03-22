import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SkipLink } from "@/app/components/a11y/skip-link";
import { ThemeScript } from "@/app/components/theme/theme-script";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nexus Orchestrator",
  description: "Authentication-enabled Nexus Orchestrator app.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme="light"
      data-theme-preference="system"
      className={`${geistSans.variable} ${geistMono.variable} h-fit antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col">
        <SkipLink />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
