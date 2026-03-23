"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { cn } from "@/app/components/ui/utils";
import { OrgSwitcher } from "@/app/components/workspace/org-switcher";
import { WorkspaceNav } from "@/app/components/workspace/workspace-nav";
import { WorkspaceStoreHydrator } from "@/app/components/workspace/workspace-store-hydrator";
import { WorkspaceFooter } from "@/app/components/workspace/workspace-footer";
import { WorkspaceUserCard } from "@/app/components/workspace/workspace-user-card";
import { MAIN_CONTENT_ID } from "@/lib/a11y";
import type { UserOrganizationMembership } from "@/lib/server/org-service";
import type { OrganizationRole } from "@/lib/server/permissions";

type WorkspaceShellProps = {
  children: ReactNode;
  organizationName: string;
  organizationSlug: string;
  role: OrganizationRole;
  memberships: UserOrganizationMembership[];
  canManageMembers: boolean;
  canViewAuditLogs: boolean;
  canViewExecutions: boolean;
  canViewOperations: boolean;
  canViewStreams: boolean;
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
  };
};

const SIDEBAR_COLLAPSED_STORAGE_KEY =
  "nexus-orchestrator:workspace-sidebar-collapsed";

function organizationMonogram(organizationName: string): string {
  return organizationName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

export function WorkspaceShell({
  children,
  organizationName,
  organizationSlug,
  role,
  memberships,
  canManageMembers,
  canViewAuditLogs,
  canViewExecutions,
  canViewOperations,
  canViewStreams,
  user,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) !== "true") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsSidebarCollapsed(true);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      String(isSidebarCollapsed),
    );
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (!isMobileSidebarOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsMobileSidebarOpen(false);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isMobileSidebarOpen, pathname]);

  useEffect(() => {
    if (!isMobileSidebarOpen) {
      return;
    }

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [isMobileSidebarOpen]);

  const desktopSidebarCollapsed = isSidebarCollapsed;
  const compactMonogram = organizationMonogram(organizationName);

  const sidebarContent = (collapsed: boolean, mobile = false) => (
    <div
      className={cn(
        "flex h-full flex-col transition-[gap] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        collapsed && !mobile && "items-center",
      )}
    >
      <div
        className={cn(
          "mb-8",
          collapsed && !mobile ? "flex w-full flex-col items-center" : "",
        )}
      >
        <div
          className={cn(
            "flex items-start justify-between gap-3",
            collapsed && !mobile ? "w-full flex-col items-center" : "",
          )}
        >
          <div
            className={cn(
              "flex items-start",
              collapsed && !mobile ? "flex-col items-center gap-4" : "gap-4",
            )}
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-[0_12px_30px_rgba(0,95,158,0.2)] overflow-hidden bg-white/5 p-2.5 border border-outline-variant/20">
              <img
                src="/website_logo.png"
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div
              aria-hidden={collapsed && !mobile}
              className={cn(
                "overflow-hidden transition-[max-width,opacity,margin,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                collapsed && !mobile
                  ? "ml-0 max-w-0 -translate-x-2 opacity-0"
                  : "ml-0 max-w-[14rem] translate-x-0 opacity-100",
              )}
            >
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                Nexus Orchestrator
              </p>
            </div>
          </div>

          {mobile ? (
            <button
              type="button"
              aria-label="Close workspace sidebar"
              className="glass-pill inline-flex h-11 w-11 items-center justify-center rounded-2xl text-[var(--on-surface)]"
              onClick={() => setIsMobileSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              aria-label={
                collapsed
                  ? "Expand workspace sidebar"
                  : "Collapse workspace sidebar"
              }
              aria-pressed={collapsed}
              className={cn(
                "glass-pill micro-interactive hidden h-11 w-11 items-center justify-center rounded-2xl text-[var(--on-surface)] lg:inline-flex",
                collapsed && "self-center",
              )}
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </div>

      <OrgSwitcher
        currentOrgSlug={organizationSlug}
        memberships={memberships}
        collapsed={collapsed && !mobile}
      />

      <WorkspaceNav
        organizationSlug={organizationSlug}
        canManageMembers={canManageMembers}
        canViewAuditLogs={canViewAuditLogs}
        canViewExecutions={canViewExecutions}
        canViewOperations={canViewOperations}
        canViewStreams={canViewStreams}
        collapsed={collapsed && !mobile}
      />

      {collapsed && !mobile ? (
        <Link
          href="/org/select"
          aria-label="Open organization selector"
          className="glass-pill micro-interactive mt-8 flex h-12 w-12 items-center justify-center rounded-2xl text-primary transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          title="Open organization selector"
        >
          <Building2 className="h-5 w-5" />
        </Link>
      ) : (
        <div className="glass-pill mt-8 rounded-2xl p-4 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
          <p className="label-caps">Workspace access</p>
          <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
            {
              memberships.filter((membership) => membership.status === "active")
                .length
            }{" "}
            active organizations
          </p>
          <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
            Stay inside the correct tenant by switching organizations before you
            manage people, roles, or audit data.
          </p>
          <Link
            href="/org/select"
            className="mt-4 inline-flex text-sm font-semibold text-primary transition-colors hover:text-[var(--primary-container)]"
          >
            Open organization selector
          </Link>
        </div>
      )}

      <WorkspaceUserCard
        organizationSlug={organizationSlug}
        fallbackUser={user}
        collapsed={collapsed && !mobile}
      />
    </div>
  );

  return (
    <div className="workspace-main flex min-h-screen flex-col px-4 py-6 sm:px-6 lg:px-8">
      <WorkspaceStoreHydrator
        currentOrganizationSlug={organizationSlug}
        currentOrganizationName={organizationName}
        currentRole={role}
        memberships={memberships}
        profile={{
          name: user.name,
          email: user.email,
          avatarUrl: user.image,
        }}
      />

      <div
        className={cn(
          "grid flex-1 gap-6 transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          desktopSidebarCollapsed
            ? "lg:grid-cols-[5.5rem_minmax(0,1fr)]"
            : "lg:grid-cols-[19rem_minmax(0,1fr)]",
        )}
      >
        <aside
          aria-label={`${organizationName} workspace sidebar`}
          className={cn(
            "glass-panel hidden overflow-hidden rounded-[2rem] transition-[padding,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:block",
            desktopSidebarCollapsed ? "p-3" : "p-5",
          )}
        >
          {sidebarContent(desktopSidebarCollapsed)}
        </aside>

        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className="glass-panel-soft rounded-[2rem] p-5 sm:p-6"
        >
          <div className="mb-5 flex items-center justify-between gap-3 lg:hidden">
            <button
              type="button"
              aria-controls="mobile-workspace-sidebar"
              aria-expanded={isMobileSidebarOpen}
              aria-label="Open workspace sidebar"
              className="glass-pill inline-flex h-12 w-12 items-center justify-center rounded-2xl text-[var(--on-surface)]"
              onClick={() => setIsMobileSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="glass-pill flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl px-4 py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Workspace
                </p>
                <p className="truncate text-sm font-semibold text-[var(--on-surface)]">
                  {organizationName}
                </p>
              </div>
              <ChevronLeft className="h-4 w-4 shrink-0 rotate-180 text-[var(--outline)]" />
            </div>
          </div>
          {children}
        </main>
      </div>

      {isMobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close workspace sidebar"
            className="absolute inset-0 bg-[rgba(8,17,29,0.42)]"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <aside
            id="mobile-workspace-sidebar"
            aria-label={`${organizationName} workspace sidebar`}
            className="glass-panel-strong absolute inset-y-3 left-3 w-[min(22rem,calc(100vw-1.5rem))] rounded-[2rem] p-5"
          >
            {sidebarContent(false, true)}
          </aside>
        </div>
      ) : null}

      <WorkspaceFooter className="mt-6" />
    </div>
  );
}
