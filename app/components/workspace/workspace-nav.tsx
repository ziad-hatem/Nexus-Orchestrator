"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShieldCheck, UserRound, Users2 } from "lucide-react";

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
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
        active
          ? "bg-[var(--surface-container-high)] text-primary"
          : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface)]"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}

export function WorkspaceNav({
  organizationSlug,
  canManageMembers,
  canViewAuditLogs,
}: {
  organizationSlug: string;
  canManageMembers: boolean;
  canViewAuditLogs: boolean;
}) {
  const pathname = usePathname();
  const basePath = `/org/${organizationSlug}`;
  const navItems: NavItem[] = [
    {
      href: basePath,
      label: "Dashboard",
      icon: LayoutDashboard,
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
    {
      href: `${basePath}/profile`,
      label: "Profile",
      icon: UserRound,
    },
  ];

  return (
    <nav aria-label="Workspace navigation" className="mt-8 space-y-2">
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
          />
        );
      })}
    </nav>
  );
}
