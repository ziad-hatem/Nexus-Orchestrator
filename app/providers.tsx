"use client";

import * as Sentry from "@sentry/nextjs";
import { RouteAnnouncer } from "@/app/components/a11y/route-announcer";
import { ThemeProvider } from "@/app/components/theme/theme-provider";
import { ThemeToggle } from "@/app/components/theme/theme-toggle";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { SessionProvider } from "next-auth/react";
import { useSession } from "next-auth/react";
import { Suspense, useEffect } from "react";
import { Toaster } from "sonner";

type ProvidersProps = {
  children: React.ReactNode;
};

function SentryUserContextBridge() {
  const { data: session, status } = useSession();
  const setSessionUser = useWorkspaceStore((state) => state.setSessionUser);
  const clearWorkspace = useWorkspaceStore((state) => state.clearWorkspace);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (!session?.user) {
      Sentry.setUser(null);
      clearWorkspace();
      return;
    }

    Sentry.setUser({
      id: session.user.id,
      email: session.user.email ?? undefined,
    });
    setSessionUser({
      id: session.user.id,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      image: session.user.image ?? null,
    });
  }, [clearWorkspace, session, setSessionUser, status]);

  return null;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <SentryUserContextBridge />
        <Suspense fallback={null}>
          <RouteAnnouncer />
        </Suspense>
        <ThemeToggle />
        {children}
        <Toaster position="top-center" richColors />
      </SessionProvider>
    </ThemeProvider>
  );
}
