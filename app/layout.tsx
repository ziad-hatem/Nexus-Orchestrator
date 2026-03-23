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
  description: "Authentication-enabled Nexus Orchestrator app.",
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
      <head>
        <ThemeScript initialThemePreference={initialTheme.themePreference} />
      </head>
      <body className="min-h-full flex flex-col">
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
