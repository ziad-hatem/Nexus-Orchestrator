import { cache } from "react";
import { auth } from "@/auth";
import { applyMonitoringContext } from "@/lib/observability/error-tracking";
import {
  getRolePermissions,
  type MembershipStatus,
  type OrganizationRole,
} from "@/lib/server/permissions";
import {
  getOrganizationBySlug,
  listUserOrganizations,
  type OrganizationRecord,
  type UserOrganizationMembership,
} from "@/lib/server/org-service";
import { forbidden, notFound, unauthorized } from "next/navigation";

export type OrgAccessContext = {
  userId: string;
  organization: OrganizationRecord;
  membership: UserOrganizationMembership;
  permissions: ReturnType<typeof getRolePermissions>;
};

export type ApiOrgAccessResult =
  | { ok: true; context: OrgAccessContext }
  | { ok: false; status: 401 | 403 | 404; error: string };

type MembershipRecord = {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationLogoUrl: string | null;
  role: OrganizationRole;
  status: MembershipStatus;
  joinedAt: string | null;
  createdAt: string;
};

async function resolveOrgAccessContext(
  userId: string,
  orgSlug: string,
): Promise<OrgAccessContext | null> {
  const organization = await getOrganizationBySlug(orgSlug);
  if (!organization) {
    return null;
  }

  const memberships = await listUserOrganizations(userId);
  const membership = memberships.find(
    (candidate) => candidate.organizationId === organization.id,
  );

  if (!membership || membership.status !== "active") {
    return {
      userId,
      organization,
      membership: membership ?? ({
        membershipId: "",
        organizationId: organization.id,
        organizationName: organization.name,
        organizationSlug: organization.slug,
        organizationLogoUrl: organization.logo_url,
        role: "viewer",
        status: "suspended",
        joinedAt: null,
        createdAt: organization.created_at,
      } satisfies MembershipRecord),
      permissions: getRolePermissions(membership?.role ?? "viewer"),
    };
  }

  return {
    userId,
    organization,
    membership,
    permissions: getRolePermissions(membership.role),
  };
}

const getCachedOrgAccess = cache(resolveOrgAccessContext);

export async function requirePageOrgAccess(
  orgSlug: string,
  authorize?: (context: OrgAccessContext) => boolean,
): Promise<OrgAccessContext> {
  const session = await auth();
  if (!session?.user?.id) {
    unauthorized();
  }

  const context = await getCachedOrgAccess(session.user.id, orgSlug);
  if (!context) {
    notFound();
  }

  if (context.membership.membershipId === "" || context.membership.status !== "active") {
    forbidden();
  }

  if (authorize && !authorize(context)) {
    forbidden();
  }

  applyMonitoringContext({
    userId: context.userId,
    organizationId: context.organization.id,
    organizationSlug: context.organization.slug,
    membershipId: context.membership.membershipId,
    role: context.membership.role,
  });

  return context;
}

export async function getApiOrgAccess(params: {
  orgSlug: string;
  userId?: string | null;
}): Promise<ApiOrgAccessResult> {
  if (!params.userId) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  const organization = await getOrganizationBySlug(params.orgSlug);
  if (!organization) {
    return {
      ok: false,
      status: 404,
      error: "Organization not found",
    };
  }

  const memberships = await listUserOrganizations(params.userId);
  const membership = memberships.find(
    (candidate) => candidate.organizationId === organization.id,
  );

  if (!membership || membership.status !== "active") {
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
    };
  }

  applyMonitoringContext({
    userId: params.userId,
    organizationId: organization.id,
    organizationSlug: organization.slug,
    membershipId: membership.membershipId,
    role: membership.role,
  });

  return {
    ok: true,
    context: {
      userId: params.userId,
      organization,
      membership,
      permissions: getRolePermissions(membership.role),
    },
  };
}
