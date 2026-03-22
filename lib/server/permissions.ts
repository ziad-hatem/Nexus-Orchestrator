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
  canViewWorkflows: boolean;
  canEditWorkflows: boolean;
  canPublishWorkflows: boolean;
  canArchiveWorkflows: boolean;
  canTriggerWorkflows: boolean;
  canViewStreams: boolean;
  canManageMembers: boolean;
  canCreateInvites: boolean;
  canViewAuditLogs: boolean;
  canManageOrganization: boolean;
};

const PERMISSIONS_BY_ROLE: Record<OrganizationRole, PermissionSet> = {
  org_admin: {
    role: "org_admin",
    canAccessDashboard: true,
    canViewWorkflows: true,
    canEditWorkflows: true,
    canPublishWorkflows: true,
    canArchiveWorkflows: true,
    canTriggerWorkflows: true,
    canViewStreams: true,
    canManageMembers: true,
    canCreateInvites: true,
    canViewAuditLogs: true,
    canManageOrganization: true,
  },
  workflow_editor: {
    role: "workflow_editor",
    canAccessDashboard: true,
    canViewWorkflows: true,
    canEditWorkflows: true,
    canPublishWorkflows: true,
    canArchiveWorkflows: true,
    canTriggerWorkflows: true,
    canViewStreams: true,
    canManageMembers: false,
    canCreateInvites: false,
    canViewAuditLogs: false,
    canManageOrganization: false,
  },
  operator: {
    role: "operator",
    canAccessDashboard: true,
    canViewWorkflows: true,
    canEditWorkflows: false,
    canPublishWorkflows: false,
    canArchiveWorkflows: false,
    canTriggerWorkflows: true,
    canViewStreams: true,
    canManageMembers: false,
    canCreateInvites: false,
    canViewAuditLogs: true,
    canManageOrganization: false,
  },
  viewer: {
    role: "viewer",
    canAccessDashboard: true,
    canViewWorkflows: true,
    canEditWorkflows: false,
    canPublishWorkflows: false,
    canArchiveWorkflows: false,
    canTriggerWorkflows: false,
    canViewStreams: false,
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

export function canViewWorkflows(role: OrganizationRole): boolean {
  return getRolePermissions(role).canViewWorkflows;
}

export function canEditWorkflows(role: OrganizationRole): boolean {
  return getRolePermissions(role).canEditWorkflows;
}

export function canPublishWorkflows(role: OrganizationRole): boolean {
  return getRolePermissions(role).canPublishWorkflows;
}

export function canArchiveWorkflows(role: OrganizationRole): boolean {
  return getRolePermissions(role).canArchiveWorkflows;
}

export function canTriggerWorkflows(role: OrganizationRole): boolean {
  return getRolePermissions(role).canTriggerWorkflows;
}

export function canViewStreams(role: OrganizationRole): boolean {
  return getRolePermissions(role).canViewStreams;
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
