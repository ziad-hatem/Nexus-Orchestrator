import assert from "node:assert/strict";
import test from "node:test";
import {
  createOrganizationForUser,
  createOrganizationWithUniqueSlug,
  getPostAuthRedirectPath,
  orgServiceDeps,
} from "@/lib/server/org-service";
import { createSupabaseMock } from "@/tests/helpers/fake-supabase";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalOrgServiceDeps = { ...orgServiceDeps };

test.afterEach(() => {
  restoreMutableExports(orgServiceDeps, originalOrgServiceDeps);
});

test("createOrganizationWithUniqueSlug retries duplicate slugs until a unique value is reserved", async () => {
  const attemptedSlugs: string[] = [];
  orgServiceDeps.createSupabaseAdminClient = () =>
    createSupabaseMock({
      onQuery(state) {
        if (state.table !== "organizations" || state.action !== "insert") {
          throw new Error(`Unexpected query: ${state.table}.${state.action}`);
        }

        const payload = state.payload as { name: string; slug: string };
        attemptedSlugs.push(payload.slug);

        if (attemptedSlugs.length === 1) {
          return {
            data: null,
            error: { message: "duplicate key value violates unique constraint" },
          };
        }

        return {
          data: {
            id: "org_123",
            name: payload.name,
            slug: payload.slug,
            logo_url: null,
            created_at: "2026-03-23T00:00:00.000Z",
            updated_at: "2026-03-23T00:00:00.000Z",
          },
          error: null,
        };
      },
    }) as never;

  const organization = await createOrganizationWithUniqueSlug("Acme Ops");

  assert.deepEqual(attemptedSlugs, ["acme-ops", "acme-ops-2"]);
  assert.equal(organization.slug, "acme-ops-2");
});

test("createOrganizationForUser rolls back the new organization if audit logging fails", async () => {
  const operations: string[] = [];
  orgServiceDeps.createSupabaseAdminClient = () =>
    createSupabaseMock({
      onQuery(state) {
        operations.push(`${state.table}.${state.action}`);

        if (state.table === "organizations" && state.action === "insert") {
          return {
            data: {
              id: "org_rollback",
              name: "Rollback Org",
              slug: "rollback-org",
              logo_url: null,
              created_at: "2026-03-23T00:00:00.000Z",
              updated_at: "2026-03-23T00:00:00.000Z",
            },
            error: null,
          };
        }

        if (
          state.table === "organization_memberships" &&
          state.action === "insert"
        ) {
          return {
            data: {
              id: "membership_rollback",
              organization_id: "org_rollback",
              role: "org_admin",
              status: "active",
              joined_at: "2026-03-23T00:00:00.000Z",
              created_at: "2026-03-23T00:00:00.000Z",
              updated_at: "2026-03-23T00:00:00.000Z",
            },
            error: null,
          };
        }

        if (state.table === "organizations" && state.action === "delete") {
          return {
            data: null,
            error: null,
          };
        }

        throw new Error(`Unexpected query: ${state.table}.${state.action}`);
      },
    }) as never;
  orgServiceDeps.writeAuditLog = async () => {
    throw new Error("audit insert failed");
  };

  await assert.rejects(
    () =>
      createOrganizationForUser({
        userId: "user_rollback",
        name: "Rollback Org",
      }),
    /audit insert failed/,
  );

  assert.deepEqual(operations, [
    "organizations.insert",
    "organization_memberships.insert",
    "organizations.delete",
  ]);
});

test("getPostAuthRedirectPath prefers active memberships and honors the preferred org slug", async () => {
  orgServiceDeps.createSupabaseAdminClient = () =>
    createSupabaseMock({
      onQuery(state) {
        if (state.table === "organization_memberships") {
          return {
            data: [
              {
                id: "membership_a",
                organization_id: "org_a",
                role: "viewer",
                status: "suspended",
                joined_at: null,
                created_at: "2026-03-23T00:00:00.000Z",
                updated_at: "2026-03-23T00:00:00.000Z",
              },
              {
                id: "membership_b",
                organization_id: "org_b",
                role: "operator",
                status: "active",
                joined_at: null,
                created_at: "2026-03-23T00:00:00.000Z",
                updated_at: "2026-03-23T00:00:00.000Z",
              },
              {
                id: "membership_c",
                organization_id: "org_c",
                role: "org_admin",
                status: "active",
                joined_at: null,
                created_at: "2026-03-23T00:00:00.000Z",
                updated_at: "2026-03-23T00:00:00.000Z",
              },
            ],
            error: null,
          };
        }

        if (state.table === "organizations") {
          return {
            data: [
              {
                id: "org_a",
                name: "Alpha",
                slug: "alpha",
                logo_url: null,
                created_at: "2026-03-23T00:00:00.000Z",
                updated_at: "2026-03-23T00:00:00.000Z",
              },
              {
                id: "org_b",
                name: "Beta",
                slug: "beta",
                logo_url: null,
                created_at: "2026-03-23T00:00:00.000Z",
                updated_at: "2026-03-23T00:00:00.000Z",
              },
              {
                id: "org_c",
                name: "Gamma",
                slug: "gamma",
                logo_url: null,
                created_at: "2026-03-23T00:00:00.000Z",
                updated_at: "2026-03-23T00:00:00.000Z",
              },
            ],
            error: null,
          };
        }

        throw new Error(`Unexpected query: ${state.table}.${state.action}`);
      },
    }) as never;

  assert.equal(
    await getPostAuthRedirectPath("user_redirect", "gamma"),
    "/org/gamma",
  );
  assert.equal(
    await getPostAuthRedirectPath("user_redirect", "alpha"),
    "/org/select",
  );
});
