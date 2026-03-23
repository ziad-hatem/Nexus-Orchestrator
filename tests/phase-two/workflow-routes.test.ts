import assert from "node:assert/strict";
import test from "node:test";
import {
  GET as getWorkflows,
  POST as postWorkflows,
  workflowsRouteDeps,
} from "@/app/api/orgs/[orgSlug]/workflows/route";
import {
  GET as getWorkflowDetail,
  workflowDetailRouteDeps,
} from "@/app/api/orgs/[orgSlug]/workflows/[workflowId]/route";
import {
  GET as getWorkflowDraft,
  PATCH as patchWorkflowDraft,
  workflowDraftRouteDeps,
} from "@/app/api/orgs/[orgSlug]/workflows/[workflowId]/draft/route";
import {
  POST as postWorkflowPublish,
  workflowPublishRouteDeps,
} from "@/app/api/orgs/[orgSlug]/workflows/[workflowId]/publish/route";
import {
  POST as postWorkflowArchive,
  workflowArchiveRouteDeps,
} from "@/app/api/orgs/[orgSlug]/workflows/[workflowId]/archive/route";
import {
  GET as getWorkflowVersions,
  workflowVersionsRouteDeps,
} from "@/app/api/orgs/[orgSlug]/workflows/[workflowId]/versions/route";
import {
  GET as getWorkflowVersion,
  workflowVersionRouteDeps,
} from "@/app/api/orgs/[orgSlug]/workflows/[workflowId]/versions/[versionNumber]/route";
import {
  getRolePermissions,
  type OrganizationRole,
} from "@/lib/server/permissions";
import {
  WorkflowConflictError,
  WorkflowNotFoundError,
  WorkflowValidationError,
} from "@/lib/server/workflows/service";
import { restoreMutableExports, readJson } from "@/tests/helpers/test-utils";

const originalWorkflowsRouteDeps = { ...workflowsRouteDeps };
const originalWorkflowDetailRouteDeps = { ...workflowDetailRouteDeps };
const originalWorkflowDraftRouteDeps = { ...workflowDraftRouteDeps };
const originalWorkflowPublishRouteDeps = { ...workflowPublishRouteDeps };
const originalWorkflowArchiveRouteDeps = { ...workflowArchiveRouteDeps };
const originalWorkflowVersionsRouteDeps = { ...workflowVersionsRouteDeps };
const originalWorkflowVersionRouteDeps = { ...workflowVersionRouteDeps };

test.afterEach(() => {
  restoreMutableExports(workflowsRouteDeps, originalWorkflowsRouteDeps);
  restoreMutableExports(
    workflowDetailRouteDeps,
    originalWorkflowDetailRouteDeps,
  );
  restoreMutableExports(workflowDraftRouteDeps, originalWorkflowDraftRouteDeps);
  restoreMutableExports(
    workflowPublishRouteDeps,
    originalWorkflowPublishRouteDeps,
  );
  restoreMutableExports(
    workflowArchiveRouteDeps,
    originalWorkflowArchiveRouteDeps,
  );
  restoreMutableExports(
    workflowVersionsRouteDeps,
    originalWorkflowVersionsRouteDeps,
  );
  restoreMutableExports(
    workflowVersionRouteDeps,
    originalWorkflowVersionRouteDeps,
  );
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

function createOrgAccess(role: OrganizationRole) {
  return {
    ok: true as const,
    context: {
      userId: "user_route",
      organization: {
        id: "org_route",
        name: "Acme",
        slug: "acme",
        logo_url: null,
        created_at: "2026-03-23T00:00:00.000Z",
        updated_at: "2026-03-23T00:00:00.000Z",
      },
      membership: {
        membershipId: "membership_route",
        organizationId: "org_route",
        organizationName: "Acme",
        organizationSlug: "acme",
        organizationLogoUrl: null,
        role,
        status: "active" as const,
        joinedAt: "2026-03-23T00:00:00.000Z",
        createdAt: "2026-03-23T00:00:00.000Z",
      },
      permissions: getRolePermissions(role),
    },
  };
}

function createRouteErrorResponse(
  error: unknown,
  options: {
    status?: number;
    publicMessage?: string;
    fallbackMessage: string;
  },
) {
  return Response.json(
    {
      error:
        options.publicMessage ??
        (error instanceof Error ? error.message : options.fallbackMessage),
    },
    { status: options.status ?? 500 },
  );
}

test("GET /api/orgs/[orgSlug]/workflows returns workflow lists for viewers", async () => {
  let receivedFilters: unknown = null;

  workflowsRouteDeps.auth = (async () => createSession("user_route")) as never;
  workflowsRouteDeps.createRequestLogger = () => createLogger() as never;
  workflowsRouteDeps.getApiOrgAccess = async () => createOrgAccess("viewer");
  workflowsRouteDeps.listWorkflows = async ({ filters }) => {
    receivedFilters = filters;
    return {
      workflows: [
        {
          workflowId: "WFL-1234",
          slug: "incident-triage",
          name: "Incident triage",
          description: "Routes incidents",
          category: "Operations",
          tags: ["nexus"],
          status: "published",
          latestVersionNumber: 2,
          hasDraft: false,
          lastModifiedAt: "2026-03-23T00:00:00.000Z",
          modifiedBy: null,
          archivedAt: null,
        },
      ],
      total: 1,
      categories: ["Operations"],
      page: 2,
      pageSize: 1,
    };
  };

  const response = await getWorkflows(
    new Request(
      "https://example.com/api/orgs/acme/workflows?query=incident&status=published&page=2&pageSize=1",
    ),
    { params: Promise.resolve({ orgSlug: "acme" }) },
  );
  const payload = await readJson<{ total: number; page: number }>(response);

  assert.equal(response.status, 200);
  assert.equal(payload.total, 1);
  assert.equal(payload.page, 2);
  const appliedFilters = receivedFilters as {
    query?: string;
    status?: string;
  };
  assert.equal(appliedFilters.query, "incident");
  assert.equal(appliedFilters.status, "published");
});

test("POST /api/orgs/[orgSlug]/workflows enforces editor permissions and returns a draft redirect", async () => {
  workflowsRouteDeps.auth = (async () => createSession("user_route")) as never;
  workflowsRouteDeps.createRequestLogger = () => createLogger() as never;
  workflowsRouteDeps.getApiOrgAccess = async () => createOrgAccess("operator");

  const forbiddenResponse = await postWorkflows(
    new Request("https://example.com/api/orgs/acme/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Incident triage",
        category: "Operations",
      }),
    }),
    { params: Promise.resolve({ orgSlug: "acme" }) },
  );
  assert.equal(forbiddenResponse.status, 403);

  workflowsRouteDeps.getApiOrgAccess = async () =>
    createOrgAccess("workflow_editor");
  workflowsRouteDeps.createWorkflow = async () => ({
    workflowId: "WFL-1234",
    workflowName: "Incident triage",
    status: "draft_only",
    latestVersionNumber: null,
    draftId: "draft_1",
    draft: {
      metadata: {
        name: "Incident triage",
        description: "",
        category: "Operations",
        tags: [],
      },
      config: {
        trigger: {
          id: "trigger_1",
          type: "manual",
          label: "Manual trigger",
          description: "",
          config: {},
        },
        conditions: [],
        actions: [],
      },
      canvas: {
        nodes: [],
        edges: [],
      },
    },
    validationIssues: [],
    updatedAt: "2026-03-23T00:00:00.000Z",
    updatedBy: null,
    isArchived: false,
  });

  const response = await postWorkflows(
    new Request("https://example.com/api/orgs/acme/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Incident triage",
        category: "Operations",
        triggerType: "manual",
      }),
    }),
    { params: Promise.resolve({ orgSlug: "acme" }) },
  );
  const payload = await readJson<{ redirectPath: string }>(response);

  assert.equal(response.status, 201);
  assert.equal(payload.redirectPath, "/org/acme/workflows/WFL-1234/draft");
});

test("GET /api/orgs/[orgSlug]/workflows/[workflowId] maps missing workflows to 404", async () => {
  workflowDetailRouteDeps.auth = (async () =>
    createSession("user_route")) as never;
  workflowDetailRouteDeps.createRequestLogger = () => createLogger() as never;
  workflowDetailRouteDeps.getApiOrgAccess = async () =>
    createOrgAccess("viewer");
  workflowDetailRouteDeps.getWorkflowDetail = async () => {
    throw new WorkflowNotFoundError();
  };
  workflowDetailRouteDeps.handleRouteError = createRouteErrorResponse as never;

  const response = await getWorkflowDetail(
    new Request("https://example.com/api/orgs/acme/workflows/WFL-404"),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-404" }) },
  );
  const payload = await readJson<{ error: string }>(response);

  assert.equal(response.status, 404);
  assert.equal(payload.error, "Workflow not found");
});

test("GET and PATCH draft routes handle conflicts, validation, and success", async () => {
  workflowDraftRouteDeps.auth = (async () =>
    createSession("user_route")) as never;
  workflowDraftRouteDeps.createRequestLogger = () => createLogger() as never;
  workflowDraftRouteDeps.getApiOrgAccess = async () =>
    createOrgAccess("workflow_editor");
  workflowDraftRouteDeps.handleRouteError = createRouteErrorResponse as never;
  workflowDraftRouteDeps.getOrCreateWorkflowDraft = async () => {
    throw new WorkflowConflictError("Archived workflows cannot be edited.");
  };

  const conflictResponse = await getWorkflowDraft(
    new Request("https://example.com/api/orgs/acme/workflows/WFL-1234/draft"),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1234" }) },
  );
  assert.equal(conflictResponse.status, 409);

  const invalidPatchResponse = await patchWorkflowDraft(
    new Request("https://example.com/api/orgs/acme/workflows/WFL-1234/draft", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1234" }) },
  );
  assert.equal(invalidPatchResponse.status, 400);

  workflowDraftRouteDeps.updateWorkflowDraft = async () => ({
    workflowId: "WFL-1234",
    workflowName: "Incident triage",
    status: "published_with_draft",
    latestVersionNumber: 2,
    draftId: "draft_1",
    draft: {
      metadata: {
        name: "Draft name",
        description: "",
        category: "Operations",
        tags: [],
      },
      config: {
        trigger: null,
        conditions: [],
        actions: [],
      },
      canvas: {
        nodes: [],
        edges: [],
      },
    },
    validationIssues: [],
    updatedAt: "2026-03-23T00:00:00.000Z",
    updatedBy: null,
    isArchived: false,
  });

  const successResponse = await patchWorkflowDraft(
    new Request("https://example.com/api/orgs/acme/workflows/WFL-1234/draft", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metadata: {
          name: "Draft name",
        },
      }),
    }),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1234" }) },
  );
  const successPayload = await readJson<{ draft: { status: string } }>(
    successResponse,
  );

  assert.equal(successResponse.status, 200);
  assert.equal(successPayload.draft.status, "published_with_draft");
});

test("POST publish returns validation issues and successful snapshots", async () => {
  workflowPublishRouteDeps.auth = (async () =>
    createSession("user_route")) as never;
  workflowPublishRouteDeps.createRequestLogger = () => createLogger() as never;
  workflowPublishRouteDeps.getApiOrgAccess = async () =>
    createOrgAccess("workflow_editor");
  workflowPublishRouteDeps.handleRouteError = createRouteErrorResponse as never;
  workflowPublishRouteDeps.publishWorkflow = async () => {
    throw new WorkflowValidationError([
      {
        path: "config.trigger",
        code: "missing_trigger",
        message: "Trigger required",
        severity: "error",
      },
    ]);
  };

  const invalidResponse = await postWorkflowPublish(
    new Request(
      "https://example.com/api/orgs/acme/workflows/WFL-1234/publish",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Release note" }),
      },
    ),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1234" }) },
  );
  const invalidPayload = await readJson<{ issues: Array<{ code: string }> }>(
    invalidResponse,
  );

  assert.equal(invalidResponse.status, 409);
  assert.equal(invalidPayload.issues[0]?.code, "missing_trigger");

  workflowPublishRouteDeps.publishWorkflow = async () => ({
    versionNumber: 3,
    metadata: {
      name: "Incident triage",
      description: "",
      category: "Operations",
      tags: [],
    },
    config: {
      trigger: null,
      conditions: [],
      actions: [],
    },
    canvas: {
      nodes: [],
      edges: [],
    },
    notes: "Release note",
    validationIssues: [],
    publishedAt: "2026-03-23T00:00:00.000Z",
    publishedBy: null,
  });

  const successResponse = await postWorkflowPublish(
    new Request(
      "https://example.com/api/orgs/acme/workflows/WFL-1234/publish",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Release note" }),
      },
    ),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1234" }) },
  );
  const successPayload = await readJson<{ version: { versionNumber: number } }>(
    successResponse,
  );

  assert.equal(successResponse.status, 201);
  assert.equal(successPayload.version.versionNumber, 3);
});

test("POST archive returns archived detail and GET version validates version numbers", async () => {
  workflowArchiveRouteDeps.auth = (async () =>
    createSession("user_route")) as never;
  workflowArchiveRouteDeps.createRequestLogger = () => createLogger() as never;
  workflowArchiveRouteDeps.getApiOrgAccess = async () =>
    createOrgAccess("org_admin");
  workflowArchiveRouteDeps.archiveWorkflow = async () => ({
    workflowId: "WFL-1234",
    slug: "incident-triage",
    name: "Incident triage",
    description: "",
    category: "Operations",
    tags: [],
    status: "archived",
    latestVersionNumber: 2,
    hasDraft: false,
    lastModifiedAt: "2026-03-23T00:00:00.000Z",
    modifiedBy: null,
    archivedAt: "2026-03-24T00:00:00.000Z",
    createdAt: "2026-03-23T00:00:00.000Z",
    createdBy: null,
    versionCount: 2,
    draftUpdatedAt: null,
    draftUpdatedBy: null,
    validationIssues: [],
    latestPublishedSnapshot: null,
  });

  const archiveResponse = await postWorkflowArchive(
    new Request(
      "https://example.com/api/orgs/acme/workflows/WFL-1234/archive",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Deprecated" }),
      },
    ),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1234" }) },
  );
  const archivePayload = await readJson<{ detail: { status: string } }>(
    archiveResponse,
  );

  assert.equal(archiveResponse.status, 200);
  assert.equal(archivePayload.detail.status, "archived");

  workflowVersionRouteDeps.auth = (async () =>
    createSession("user_route")) as never;
  workflowVersionRouteDeps.createRequestLogger = () => createLogger() as never;
  workflowVersionRouteDeps.getApiOrgAccess = async () =>
    createOrgAccess("viewer");

  const invalidVersionResponse = await getWorkflowVersion(
    new Request(
      "https://example.com/api/orgs/acme/workflows/WFL-1234/versions/not-a-number",
    ),
    {
      params: Promise.resolve({
        orgSlug: "acme",
        workflowId: "WFL-1234",
        versionNumber: "not-a-number",
      }),
    },
  );
  assert.equal(invalidVersionResponse.status, 400);

  workflowVersionRouteDeps.getWorkflowVersionSnapshot = async () => ({
    versionNumber: 2,
    metadata: {
      name: "Incident triage",
      description: "",
      category: "Operations",
      tags: [],
    },
    config: {
      trigger: null,
      conditions: [],
      actions: [],
    },
    canvas: {
      nodes: [],
      edges: [],
    },
    notes: null,
    validationIssues: [],
    publishedAt: "2026-03-23T00:00:00.000Z",
    publishedBy: null,
  });

  const versionResponse = await getWorkflowVersion(
    new Request(
      "https://example.com/api/orgs/acme/workflows/WFL-1234/versions/2",
    ),
    {
      params: Promise.resolve({
        orgSlug: "acme",
        workflowId: "WFL-1234",
        versionNumber: "2",
      }),
    },
  );
  const versionPayload = await readJson<{ version: { versionNumber: number } }>(
    versionResponse,
  );

  assert.equal(versionResponse.status, 200);
  assert.equal(versionPayload.version.versionNumber, 2);
});

test("GET versions returns immutable version history for viewers", async () => {
  workflowVersionsRouteDeps.auth = (async () =>
    createSession("user_route")) as never;
  workflowVersionsRouteDeps.createRequestLogger = () => createLogger() as never;
  workflowVersionsRouteDeps.getApiOrgAccess = async () =>
    createOrgAccess("viewer");
  workflowVersionsRouteDeps.listWorkflowVersions = async () => [
    {
      workflowId: "WFL-1234",
      versionNumber: 1,
      createdAt: "2026-03-23T00:00:00.000Z",
      publishedBy: null,
      notes: "Initial publish",
      validationIssueCount: 0,
      isCurrent: true,
    },
  ];

  const response = await getWorkflowVersions(
    new Request(
      "https://example.com/api/orgs/acme/workflows/WFL-1234/versions",
    ),
    { params: Promise.resolve({ orgSlug: "acme", workflowId: "WFL-1234" }) },
  );
  const payload = await readJson<{
    versions: Array<{ versionNumber: number }>;
  }>(response);

  assert.equal(response.status, 200);
  assert.equal(payload.versions[0]?.versionNumber, 1);
});
