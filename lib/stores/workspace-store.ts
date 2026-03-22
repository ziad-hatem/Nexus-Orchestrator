import { create } from "zustand";
import type {
  AuditLogWithActor,
} from "@/lib/server/audit-log";
import type {
  OrganizationMember,
  PendingOrganizationInvite,
} from "@/lib/server/membership-service";
import type {
  MembershipStatus,
  OrganizationRole,
} from "@/lib/server/permissions";
import type {
  DashboardSummary,
  UserOrganizationMembership,
} from "@/lib/server/org-service";
import type {
  WorkflowDetail,
  WorkflowDraftState,
  WorkflowIngestionEventSummary,
  WorkflowLifecycleStatus,
  WorkflowPublishedSnapshot,
  WorkflowSummary,
  WorkflowTriggerDetails,
  WorkflowVersionSummary,
} from "@/lib/server/workflows/types";

export type SessionUserState = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

export type WorkspaceProfile = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export type TeamDirectoryFilters = {
  query?: string;
  role?: OrganizationRole;
  status?: MembershipStatus;
};

export type AuditFeedFilters = {
  query?: string;
  action?: string;
};

export type WorkflowDirectoryFilters = {
  query?: string;
  status?: WorkflowLifecycleStatus;
  category?: string;
};

type WorkspaceStoreState = {
  hydrated: boolean;
  sessionUser: SessionUserState | null;
  currentOrganizationSlug: string | null;
  currentOrganizationName: string | null;
  currentRole: OrganizationRole | null;
  memberships: UserOrganizationMembership[];
  profile: WorkspaceProfile;
  dashboardSummary: DashboardSummary | null;
  recentAuditActivity: AuditLogWithActor[];
  teamMembers: OrganizationMember[];
  teamInvites: PendingOrganizationInvite[];
  teamFilters: TeamDirectoryFilters;
  auditLogs: AuditLogWithActor[];
  auditTotal: number;
  auditPage: number;
  auditPageSize: number;
  auditFilters: AuditFeedFilters;
  auditAvailableActions: string[];
  workflowItems: WorkflowSummary[];
  workflowTotal: number;
  workflowPage: number;
  workflowPageSize: number;
  workflowFilters: WorkflowDirectoryFilters;
  workflowCategories: string[];
  activeWorkflowDetail: WorkflowDetail | null;
  activeWorkflowDraft: WorkflowDraftState | null;
  activeWorkflowTrigger: WorkflowTriggerDetails | null;
  workflowVersions: WorkflowVersionSummary[];
  activeWorkflowVersion: WorkflowPublishedSnapshot | null;
  workflowStreams: WorkflowIngestionEventSummary[];
  workflowStreamsTotal: number;
  workflowStreamsPage: number;
  workflowStreamsPageSize: number;
  setSessionUser: (sessionUser: SessionUserState | null) => void;
  setMemberships: (memberships: UserOrganizationMembership[]) => void;
  setWorkspace: (payload: {
    currentOrganizationSlug: string;
    currentOrganizationName: string;
    currentRole: OrganizationRole;
    memberships: UserOrganizationMembership[];
  }) => void;
  setCurrentOrganization: (payload: {
      organizationSlug: string;
      organizationName?: string | null;
      role?: OrganizationRole | null;
  }) => void;
  upsertMembership: (membership: UserOrganizationMembership) => void;
  setProfile: (profile: WorkspaceProfile) => void;
  setDashboardData: (payload: {
    summary: DashboardSummary;
    recentActivity: AuditLogWithActor[];
  }) => void;
  setTeamDirectory: (payload: {
    members: OrganizationMember[];
    invites: PendingOrganizationInvite[];
    filters: TeamDirectoryFilters;
  }) => void;
  setAuditFeed: (payload: {
    logs: AuditLogWithActor[];
    total: number;
    page: number;
    pageSize: number;
    filters: AuditFeedFilters;
    availableActions: string[];
  }) => void;
  setWorkflowDirectory: (payload: {
    items: WorkflowSummary[];
    total: number;
    page: number;
    pageSize: number;
    filters: WorkflowDirectoryFilters;
    categories: string[];
  }) => void;
  setWorkflowDetail: (detail: WorkflowDetail | null) => void;
  setWorkflowDraft: (draft: WorkflowDraftState | null) => void;
  setWorkflowTrigger: (trigger: WorkflowTriggerDetails | null) => void;
  setWorkflowVersions: (versions: WorkflowVersionSummary[]) => void;
  setWorkflowVersion: (version: WorkflowPublishedSnapshot | null) => void;
  setWorkflowStreams: (payload: {
    items: WorkflowIngestionEventSummary[];
    total: number;
    page: number;
    pageSize: number;
  }) => void;
  clearWorkspace: () => void;
};

const emptyProfile: WorkspaceProfile = {
  name: null,
  email: null,
  avatarUrl: null,
};

const emptyTeamFilters: TeamDirectoryFilters = {};
const emptyAuditFilters: AuditFeedFilters = {};
const emptyWorkflowFilters: WorkflowDirectoryFilters = {};

const orgScopedInitialState = {
  dashboardSummary: null as DashboardSummary | null,
  recentAuditActivity: [] as AuditLogWithActor[],
  teamMembers: [] as OrganizationMember[],
  teamInvites: [] as PendingOrganizationInvite[],
  teamFilters: emptyTeamFilters,
  auditLogs: [] as AuditLogWithActor[],
  auditTotal: 0,
  auditPage: 1,
  auditPageSize: 20,
  auditFilters: emptyAuditFilters,
  auditAvailableActions: [] as string[],
  workflowItems: [] as WorkflowSummary[],
  workflowTotal: 0,
  workflowPage: 1,
  workflowPageSize: 12,
  workflowFilters: emptyWorkflowFilters,
  workflowCategories: [] as string[],
  activeWorkflowDetail: null as WorkflowDetail | null,
  activeWorkflowDraft: null as WorkflowDraftState | null,
  activeWorkflowTrigger: null as WorkflowTriggerDetails | null,
  workflowVersions: [] as WorkflowVersionSummary[],
  activeWorkflowVersion: null as WorkflowPublishedSnapshot | null,
  workflowStreams: [] as WorkflowIngestionEventSummary[],
  workflowStreamsTotal: 0,
  workflowStreamsPage: 1,
  workflowStreamsPageSize: 20,
};

const initialState = {
  hydrated: false,
  sessionUser: null as SessionUserState | null,
  currentOrganizationSlug: null,
  currentOrganizationName: null,
  currentRole: null,
  memberships: [] as UserOrganizationMembership[],
  profile: emptyProfile,
  ...orgScopedInitialState,
};

export const useWorkspaceStore = create<WorkspaceStoreState>((set) => ({
  ...initialState,
  setSessionUser: (sessionUser) =>
    set((state) => ({
      ...state,
      hydrated: true,
      sessionUser,
    })),
  setMemberships: (memberships) =>
    set((state) => {
      const matchingMembership = state.currentOrganizationSlug
        ? memberships.find(
            (membership) =>
              membership.organizationSlug === state.currentOrganizationSlug,
          )
        : null;

      return {
        ...state,
        hydrated: true,
        memberships,
        currentOrganizationName:
          matchingMembership?.organizationName ?? state.currentOrganizationName,
        currentRole: matchingMembership?.role ?? state.currentRole,
      };
    }),
  setWorkspace: (payload) =>
    set((state) => ({
      ...state,
      hydrated: true,
      currentOrganizationSlug: payload.currentOrganizationSlug,
      currentOrganizationName: payload.currentOrganizationName,
      currentRole: payload.currentRole,
      memberships: payload.memberships,
    })),
  setCurrentOrganization: (payload) =>
    set((state) => {
      const matchingMembership = state.memberships.find(
        (membership) => membership.organizationSlug === payload.organizationSlug,
      );

      return {
        ...state,
        hydrated: true,
        currentOrganizationSlug: payload.organizationSlug,
        currentOrganizationName:
          payload.organizationName ??
          matchingMembership?.organizationName ??
          state.currentOrganizationName,
        currentRole:
          payload.role ?? matchingMembership?.role ?? state.currentRole,
        ...orgScopedInitialState,
      };
    }),
  upsertMembership: (membership) =>
    set((state) => {
      const memberships = state.memberships.some(
        (existingMembership) =>
          existingMembership.membershipId === membership.membershipId,
      )
        ? state.memberships.map((existingMembership) =>
            existingMembership.membershipId === membership.membershipId
              ? membership
              : existingMembership,
          )
        : [...state.memberships, membership];

      const isCurrentOrganization =
        state.currentOrganizationSlug === membership.organizationSlug;

      return {
        ...state,
        hydrated: true,
        memberships,
        currentOrganizationName: isCurrentOrganization
          ? membership.organizationName
          : state.currentOrganizationName,
        currentRole: isCurrentOrganization
          ? membership.role
          : state.currentRole,
      };
    }),
  setProfile: (profile) =>
    set((state) => ({
      ...state,
      hydrated: true,
      profile,
    })),
  setDashboardData: (payload) =>
    set((state) => ({
      ...state,
      hydrated: true,
      dashboardSummary: payload.summary,
      recentAuditActivity: payload.recentActivity,
    })),
  setTeamDirectory: (payload) =>
    set((state) => ({
      ...state,
      hydrated: true,
      teamMembers: payload.members,
      teamInvites: payload.invites,
      teamFilters: payload.filters,
    })),
  setAuditFeed: (payload) =>
    set((state) => ({
      ...state,
      hydrated: true,
      auditLogs: payload.logs,
      auditTotal: payload.total,
      auditPage: payload.page,
      auditPageSize: payload.pageSize,
      auditFilters: payload.filters,
      auditAvailableActions: payload.availableActions,
    })),
  setWorkflowDirectory: (payload) =>
    set((state) => ({
      ...state,
      hydrated: true,
      workflowItems: payload.items,
      workflowTotal: payload.total,
      workflowPage: payload.page,
      workflowPageSize: payload.pageSize,
      workflowFilters: payload.filters,
      workflowCategories: payload.categories,
    })),
  setWorkflowDetail: (detail) =>
    set((state) => ({
      ...state,
      hydrated: true,
      activeWorkflowDetail: detail,
    })),
  setWorkflowDraft: (draft) =>
    set((state) => ({
      ...state,
      hydrated: true,
      activeWorkflowDraft: draft,
    })),
  setWorkflowTrigger: (trigger) =>
    set((state) => ({
      ...state,
      hydrated: true,
      activeWorkflowTrigger: trigger,
    })),
  setWorkflowVersions: (versions) =>
    set((state) => ({
      ...state,
      hydrated: true,
      workflowVersions: versions,
    })),
  setWorkflowVersion: (version) =>
    set((state) => ({
      ...state,
      hydrated: true,
      activeWorkflowVersion: version,
    })),
  setWorkflowStreams: (payload) =>
    set((state) => ({
      ...state,
      hydrated: true,
      workflowStreams: payload.items,
      workflowStreamsTotal: payload.total,
      workflowStreamsPage: payload.page,
      workflowStreamsPageSize: payload.pageSize,
    })),
  clearWorkspace: () => ({
    ...initialState,
  }),
}));
