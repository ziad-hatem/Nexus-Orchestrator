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

export const orgAccessDeps = {
  auth,
  applyMonitoringContext,
  getRolePermissions,
  getOrganizationBySlug,
  listUserOrganizations,
  forbidden,
  notFound,
  unauthorized,
};

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
  const organization = await orgAccessDeps.getOrganizationBySlug(orgSlug);
  if (!organization) {
    return null;
  }

  const memberships = await orgAccessDeps.listUserOrganizations(userId);
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
      permissions: orgAccessDeps.getRolePermissions(membership?.role ?? "viewer"),
    };
  }

  return {
    userId,
    organization,
    membership,
    permissions: orgAccessDeps.getRolePermissions(membership.role),
  };
}

const getCachedOrgAccess = cache(resolveOrgAccessContext);

export async function requirePageOrgAccess(
  orgSlug: string,
  authorize?: (context: OrgAccessContext) => boolean,
): Promise<OrgAccessContext> {
  const session = await orgAccessDeps.auth();
  const userId = session?.user?.id;
  if (!userId) {
    orgAccessDeps.unauthorized();
    throw new Error("Unreachable unauthorized org access state");
  }

  const context = await getCachedOrgAccess(userId, orgSlug);
  if (!context) {
    orgAccessDeps.notFound();
    throw new Error("Unreachable missing organization state");
  }

  if (context.membership.membershipId === "" || context.membership.status !== "active") {
    orgAccessDeps.forbidden();
    throw new Error("Unreachable forbidden organization state");
  }

  if (authorize && !authorize(context)) {
    orgAccessDeps.forbidden();
    throw new Error("Unreachable role authorization state");
  }

  orgAccessDeps.applyMonitoringContext({
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

  const organization = await orgAccessDeps.getOrganizationBySlug(params.orgSlug);
  if (!organization) {
    return {
      ok: false,
      status: 404,
      error: "Organization not found",
    };
  }

  const memberships = await orgAccessDeps.listUserOrganizations(params.userId);
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

  orgAccessDeps.applyMonitoringContext({
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
      permissions: orgAccessDeps.getRolePermissions(membership.role),
    },
  };
}
