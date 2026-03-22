export const ORGANIZATION_ROLES = [
  "org_admin",
  "workflow_editor",
  "operator",
  "viewer",
] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];
export type MembershipStatus = "active" | "suspended";

export type PermissionSet = {
  role: OrganizationRole;
  canAccessDashboard: boolean;
  canManageMembers: boolean;
  canCreateInvites: boolean;
  canViewAuditLogs: boolean;
  canManageOrganization: boolean;
};

const PERMISSIONS_BY_ROLE: Record<OrganizationRole, PermissionSet> = {
  org_admin: {
    role: "org_admin",
    canAccessDashboard: true,
    canManageMembers: true,
    canCreateInvites: true,
    canViewAuditLogs: true,
    canManageOrganization: true,
  },
  workflow_editor: {
    role: "workflow_editor",
    canAccessDashboard: true,
    canManageMembers: false,
    canCreateInvites: false,
    canViewAuditLogs: false,
    canManageOrganization: false,
  },
  operator: {
    role: "operator",
    canAccessDashboard: true,
    canManageMembers: false,
    canCreateInvites: false,
    canViewAuditLogs: true,
    canManageOrganization: false,
  },
  viewer: {
    role: "viewer",
    canAccessDashboard: true,
    canManageMembers: false,
    canCreateInvites: false,
    canViewAuditLogs: false,
    canManageOrganization: false,
  },
};

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  org_admin: "Org Admin",
  workflow_editor: "Workflow Editor",
  operator: "Operator",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<OrganizationRole, string> = {
  org_admin: "Manage members, invitations, audit access, and organization settings.",
  workflow_editor: "Create and manage workflows without access to team administration.",
  operator: "Operate the workspace and review audit activity without editing team access.",
  viewer: "Read-only access to the workspace dashboard and profile tools.",
};

export function isOrganizationRole(value: unknown): value is OrganizationRole {
  return typeof value === "string" && ORGANIZATION_ROLES.includes(value as OrganizationRole);
}

export function getRolePermissions(role: OrganizationRole): PermissionSet {
  return PERMISSIONS_BY_ROLE[role];
}

export function canAccessDashboard(role: OrganizationRole): boolean {
  return getRolePermissions(role).canAccessDashboard;
}

export function canManageMembers(role: OrganizationRole): boolean {
  return getRolePermissions(role).canManageMembers;
}

export function canCreateInvites(role: OrganizationRole): boolean {
  return getRolePermissions(role).canCreateInvites;
}

export function canViewAuditLogs(role: OrganizationRole): boolean {
  return getRolePermissions(role).canViewAuditLogs;
}

export function canManageOrganization(role: OrganizationRole): boolean {
  return getRolePermissions(role).canManageOrganization;
}
