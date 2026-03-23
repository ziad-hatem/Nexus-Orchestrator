"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Radio,
  ShieldCheck,
  UserRound,
  Users2,
} from "lucide-react";
import { cn } from "@/app/components/ui/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

function WorkspaceNavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        "flex items-center rounded-2xl py-3 text-sm font-semibold transition-[background-color,color,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        collapsed ? "justify-center px-3" : "gap-3 px-4",
        active
          ? "bg-[var(--surface-container-high)] text-primary"
          : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface)]",
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span
        aria-hidden={collapsed}
        className={cn(
          "overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          collapsed
            ? "ml-0 max-w-0 -translate-x-2 opacity-0"
            : "ml-0 max-w-[9rem] translate-x-0 opacity-100",
        )}
      >
        {label}
      </span>
    </Link>
  );
}

export function WorkspaceNav({
  organizationSlug,
  canManageMembers,
  canViewAuditLogs,
  canViewExecutions,
  canViewOperations,
  canViewStreams,
  collapsed = false,
}: {
  organizationSlug: string;
  canManageMembers: boolean;
  canViewAuditLogs: boolean;
  canViewExecutions: boolean;
  canViewOperations: boolean;
  canViewStreams: boolean;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const basePath = `/org/${organizationSlug}`;
  const navItems: NavItem[] = [
    {
      href: basePath,
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: `${basePath}/workflows`,
      label: "Workflows",
      icon: GitBranch,
    },
    ...(canManageMembers
      ? [
          {
            href: `${basePath}/team`,
            label: "Team",
            icon: Users2,
          },
        ]
      : []),
    ...(canViewAuditLogs
      ? [
          {
            href: `${basePath}/audit`,
            label: "Audit",
            icon: ShieldCheck,
          },
        ]
      : []),
    ...(canViewStreams
      ? [
          {
            href: `${basePath}/streams`,
            label: "Streams",
            icon: Radio,
          },
        ]
      : []),
    ...(canViewExecutions
      ? [
          {
            href: `${basePath}/executions`,
            label: "Executions",
            icon: ListChecks,
          },
        ]
      : []),
    ...(canViewOperations
      ? [
          {
            href: `${basePath}/operations`,
            label: "Operations",
            icon: ShieldCheck,
          },
        ]
      : []),
    {
      href: `${basePath}/profile`,
      label: "Profile",
      icon: UserRound,
    },
  ];

  return (
    <nav
      aria-label="Workspace navigation"
      className={cn("mt-8 space-y-2", collapsed && "mt-6")}
    >
      {navItems.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== basePath && pathname.startsWith(`${item.href}/`));

        return (
          <WorkspaceNavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={active}
            collapsed={collapsed}
          />
        );
      })}
    </nav>
  );
}
