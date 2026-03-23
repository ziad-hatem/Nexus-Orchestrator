import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { SkipLink } from "@/app/components/a11y/skip-link";
import { ThemeScript } from "@/app/components/theme/theme-script";
import { deriveServerThemeSnapshot, THEME_COOKIE_NAME } from "@/lib/theme";
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
  description:
    "Enterprise Automation OS - Scale operations globally with high-performance multi-tenancy.",
  openGraph: {
    title: "Nexus Orchestrator",
    description: "Enterprise Automation OS",
    url: "https://nexus-orchestrator.ziadhatem.dev",
    siteName: "Nexus Orchestrator",
    images: [
      {
        url: "/opengraph-image.webp",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialTheme = deriveServerThemeSnapshot(
    cookieStore.get(THEME_COOKIE_NAME)?.value,
  );

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme={initialTheme.resolvedTheme}
      data-theme-preference={initialTheme.themePreference}
      className={`${geistSans.variable} ${geistMono.variable} h-fit antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeScript initialThemePreference={initialTheme.themePreference} />
        <SkipLink />
        <Providers
          initialResolvedTheme={initialTheme.resolvedTheme}
          initialThemePreference={initialTheme.themePreference}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
