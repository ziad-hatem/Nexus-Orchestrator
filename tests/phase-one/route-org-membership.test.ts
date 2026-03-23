import assert from "node:assert/strict";
import test from "node:test";
import { GET as getOrgs, POST as postOrgs, orgRouteDeps } from "@/app/api/orgs/route";
import {
  GET as getMembers,
  orgMembersRouteDeps,
} from "@/app/api/orgs/[orgSlug]/members/route";
import {
  PATCH as patchMember,
  orgMemberRouteDeps,
} from "@/app/api/orgs/[orgSlug]/members/[membershipId]/route";
import {
  GET as getInvites,
  POST as postInvites,
  orgInvitesRouteDeps,
} from "@/app/api/orgs/[orgSlug]/invites/route";
import { restoreMutableExports, readJson } from "@/tests/helpers/test-utils";

const originalOrgRouteDeps = { ...orgRouteDeps };
const originalOrgMembersRouteDeps = { ...orgMembersRouteDeps };
const originalOrgMemberRouteDeps = { ...orgMemberRouteDeps };
const originalOrgInvitesRouteDeps = { ...orgInvitesRouteDeps };

test.afterEach(() => {
  restoreMutableExports(orgRouteDeps, originalOrgRouteDeps);
  restoreMutableExports(orgMembersRouteDeps, originalOrgMembersRouteDeps);
  restoreMutableExports(orgMemberRouteDeps, originalOrgMemberRouteDeps);
  restoreMutableExports(orgInvitesRouteDeps, originalOrgInvitesRouteDeps);
});

function createLogger() {
  return {
    info() {},
    warn() {},
    error() {},
  };
}

function createSession(userId: string) {
  return {
    user: { id: userId },
    expires: "2099-01-01T00:00:00.000Z",
  };
}

test("GET /api/orgs returns 401 when no session is present", async () => {
  orgRouteDeps.auth = (async () => null) as never;
  orgRouteDeps.createRequestLogger = () => createLogger() as never;

  const response = await getOrgs(new Request("https://example.com/api/orgs"));
  const payload = await readJson<{ error: string }>(response);

  assert.equal(response.status, 401);
  assert.equal(payload.error, "Unauthorized");
});

test("POST /api/orgs returns 201 and sets the active organization cookie", async () => {
  orgRouteDeps.auth = (async () => createSession("user_orgs")) as never;
  orgRouteDeps.createRequestLogger = () => createLogger() as never;
  orgRouteDeps.createOrganizationForUser = async () => ({
    membershipId: "membership_orgs",
    organizationId: "org_created",
    organizationName: "Acme",
    organizationSlug: "acme",
    organizationLogoUrl: null,
    role: "org_admin",
    status: "active",
    joinedAt: null,
    createdAt: "2026-03-23T00:00:00.000Z",
  });

  const response = await postOrgs(
    new Request("https://example.com/api/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Acme" }),
    }),
  );
  const payload = await readJson<{
    redirectPath: string;
    organization: { organizationSlug: string };
  }>(response);

  assert.equal(response.status, 201);
  assert.equal(payload.redirectPath, "/org/acme");
  assert.equal(payload.organization.organizationSlug, "acme");
  assert.match(response.headers.get("set-cookie") ?? "", /active_org=acme/);
});

test("GET /api/orgs/[orgSlug]/members returns 403 when the role cannot manage members", async () => {
  orgMembersRouteDeps.auth = (async () => createSession("user_members")) as never;
  orgMembersRouteDeps.createRequestLogger = () => createLogger() as never;
  orgMembersRouteDeps.getApiOrgAccess = async () => ({
    ok: true,
    context: {
      userId: "user_members",
      organization: {
        id: "org_members",
        name: "Acme",
        slug: "acme",
        logo_url: null,
        created_at: "2026-03-23T00:00:00.000Z",
        updated_at: "2026-03-23T00:00:00.000Z",
      },
      membership: {
        membershipId: "membership_viewer",
        organizationId: "org_members",
        organizationName: "Acme",
        organizationSlug: "acme",
        organizationLogoUrl: null,
        role: "viewer",
        status: "active",
        joinedAt: null,
        createdAt: "2026-03-23T00:00:00.000Z",
      },
      permissions: {
        role: "viewer",
        canAccessDashboard: true,
        canViewWorkflows: true,
        canEditWorkflows: false,
        canPublishWorkflows: false,
        canArchiveWorkflows: false,
        canTriggerWorkflows: false,
        canViewStreams: false,
        canViewExecutions: true,
        canViewOperations: false,
        canCancelRuns: false,
        canRetryRuns: false,
        canManageMembers: false,
        canCreateInvites: false,
        canViewAuditLogs: false,
        canManageOrganization: false,
      },
    },
  });

  const response = await getMembers(
    new Request("https://example.com/api/orgs/acme/members"),
    { params: Promise.resolve({ orgSlug: "acme" }) },
  );
  const payload = await readJson<{ error: string }>(response);

  assert.equal(response.status, 403);
  assert.equal(payload.error, "Forbidden");
});

test("GET /api/orgs/[orgSlug]/members returns members and invites for org admins", async () => {
  orgMembersRouteDeps.auth = (async () => createSession("user_members")) as never;
  orgMembersRouteDeps.createRequestLogger = () => createLogger() as never;
  orgMembersRouteDeps.getApiOrgAccess = async () => ({
    ok: true,
    context: {
      userId: "user_members",
      organization: {
        id: "org_members",
        name: "Acme",
        slug: "acme",
        logo_url: null,
        created_at: "2026-03-23T00:00:00.000Z",
        updated_at: "2026-03-23T00:00:00.000Z",
      },
      membership: {
        membershipId: "membership_admin",
        organizationId: "org_members",
        organizationName: "Acme",
        organizationSlug: "acme",
        organizationLogoUrl: null,
        role: "org_admin",
        status: "active",
        joinedAt: null,
        createdAt: "2026-03-23T00:00:00.000Z",
      },
      permissions: {} as never,
    },
  });
  orgMembersRouteDeps.listOrganizationMembers = async () => ({
    members: [
      {
        membershipId: "member_1",
        userId: "user_1",
        name: "Teammate",
        email: "teammate@example.com",
        avatarUrl: null,
        role: "viewer",
        status: "active",
        joinedAt: null,
        createdAt: "2026-03-23T00:00:00.000Z",
        permissions: {} as never,
      },
    ],
    invites: [
      {
        id: "invite_1",
        organizationId: "org_members",
        email: "invitee@example.com",
        name: "Invitee",
        role: "operator",
        expiresAt: "2026-03-30T00:00:00.000Z",
        createdAt: "2026-03-23T00:00:00.000Z",
        isExpired: false,
      },
    ],
  });

  const response = await getMembers(
    new Request("https://example.com/api/orgs/acme/members?role=viewer"),
    { params: Promise.resolve({ orgSlug: "acme" }) },
  );
  const payload = await readJson<{
    members: Array<{ membershipId: string }>;
    invites: Array<{ id: string }>;
  }>(response);

  assert.equal(response.status, 200);
  assert.equal(payload.members[0]?.membershipId, "member_1");
  assert.equal(payload.invites[0]?.id, "invite_1");
});

test("PATCH /api/orgs/[orgSlug]/members/[membershipId] validates request bodies", async () => {
  orgMemberRouteDeps.auth = (async () => createSession("user_members")) as never;
  orgMemberRouteDeps.createRequestLogger = () => createLogger() as never;

  const response = await patchMember(
    new Request("https://example.com/api/orgs/acme/members/member_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
    {
      params: Promise.resolve({
        orgSlug: "acme",
        membershipId: "member_1",
      }),
    },
  );
  const payload = await readJson<{ error: string }>(response);

  assert.equal(response.status, 400);
  assert.match(payload.error, /At least one membership field must be provided/);
});

test("PATCH /api/orgs/[orgSlug]/members/[membershipId] maps last-admin conflicts to 409", async () => {
  orgMemberRouteDeps.auth = (async () => createSession("user_members")) as never;
  orgMemberRouteDeps.createRequestLogger = () => createLogger() as never;
  orgMemberRouteDeps.getApiOrgAccess = async () => ({
    ok: true,
    context: {
      userId: "user_members",
      organization: {
        id: "org_members",
        name: "Acme",
        slug: "acme",
        logo_url: null,
        created_at: "2026-03-23T00:00:00.000Z",
        updated_at: "2026-03-23T00:00:00.000Z",
      },
      membership: {
        membershipId: "membership_admin",
        organizationId: "org_members",
        organizationName: "Acme",
        organizationSlug: "acme",
        organizationLogoUrl: null,
        role: "org_admin",
        status: "active",
        joinedAt: null,
        createdAt: "2026-03-23T00:00:00.000Z",
      },
      permissions: {} as never,
    },
  });
  orgMemberRouteDeps.updateOrganizationMembership = async () => {
    throw new Error("This organization must always have at least one active org admin.");
  };
  orgMemberRouteDeps.handleRouteError = ((
    _error: unknown,
    details: { publicMessage?: string; status?: number },
  ) =>
    Response.json(
      { error: details.publicMessage },
      { status: details.status },
    )) as never;

  const response = await patchMember(
    new Request("https://example.com/api/orgs/acme/members/member_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "suspended" }),
    }),
    {
      params: Promise.resolve({
        orgSlug: "acme",
        membershipId: "member_1",
      }),
    },
  );
  const payload = await readJson<{ error: string }>(response);

  assert.equal(response.status, 409);
  assert.match(payload.error, /at least one active org admin/i);
});

test("GET and POST /api/orgs/[orgSlug]/invites enforce role checks and create invites", async () => {
  orgInvitesRouteDeps.auth = (async () => createSession("user_invites")) as never;
  orgInvitesRouteDeps.createRequestLogger = () => createLogger() as never;
  orgInvitesRouteDeps.getApiOrgAccess = async () => ({
    ok: true,
    context: {
      userId: "user_invites",
      organization: {
        id: "org_invites",
        name: "Acme",
        slug: "acme",
        logo_url: null,
        created_at: "2026-03-23T00:00:00.000Z",
        updated_at: "2026-03-23T00:00:00.000Z",
      },
      membership: {
        membershipId: "membership_admin",
        organizationId: "org_invites",
        organizationName: "Acme",
        organizationSlug: "acme",
        organizationLogoUrl: null,
        role: "org_admin",
        status: "active",
        joinedAt: null,
        createdAt: "2026-03-23T00:00:00.000Z",
      },
      permissions: {} as never,
    },
  });
  orgInvitesRouteDeps.listOrganizationMembers = async () => ({
    members: [],
    invites: [
      {
        id: "invite_existing",
        organizationId: "org_invites",
        email: "existing@example.com",
        name: null,
        role: "viewer",
        expiresAt: "2026-03-30T00:00:00.000Z",
        createdAt: "2026-03-23T00:00:00.000Z",
        isExpired: false,
      },
    ],
  });
  orgInvitesRouteDeps.createOrganizationInvite = async () => ({
    id: "invite_created",
    organizationId: "org_invites",
    organizationName: "Acme",
    organizationSlug: "acme",
    email: "new@example.com",
    role: "operator",
    displayName: "New Person",
    expiresAt: "2026-03-30T00:00:00.000Z",
    acceptedAt: null,
    revokedAt: null,
    isExpired: false,
  });

  const getResponse = await getInvites(
    new Request("https://example.com/api/orgs/acme/invites"),
    { params: Promise.resolve({ orgSlug: "acme" }) },
  );
  const getPayload = await readJson<{ invites: Array<{ id: string }> }>(getResponse);
  assert.equal(getResponse.status, 200);
  assert.equal(getPayload.invites[0]?.id, "invite_existing");

  const postResponse = await postInvites(
    new Request("https://example.com/api/orgs/acme/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "new@example.com",
        name: "New Person",
        role: "operator",
      }),
    }),
    { params: Promise.resolve({ orgSlug: "acme" }) },
  );
  const postPayload = await readJson<{ invite: { id: string } }>(postResponse);
  assert.equal(postResponse.status, 201);
  assert.equal(postPayload.invite.id, "invite_created");
});
