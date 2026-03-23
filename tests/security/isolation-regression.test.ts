import assert from "node:assert/strict";
import test from "node:test";
import {
  canCancelRuns,
  canRetryRuns,
  canTriggerWorkflows,
  canViewAuditLogs,
  canViewExecutions,
  canViewOperations,
  canViewStreams,
  getRolePermissions,
  ORGANIZATION_ROLES,
} from "@/lib/server/permissions";

test("viewer role remains read-only across hardened tenant surfaces", () => {
  assert.equal(canViewExecutions("viewer"), true);
  assert.equal(canViewAuditLogs("viewer"), false);
  assert.equal(canViewOperations("viewer"), false);
  assert.equal(canViewStreams("viewer"), false);
  assert.equal(canTriggerWorkflows("viewer"), false);
  assert.equal(canCancelRuns("viewer"), false);
  assert.equal(canRetryRuns("viewer"), false);
});

test("operator, editor, and admin roles retain operational access without widening viewer access", () => {
  for (const role of ORGANIZATION_ROLES) {
    const permissions = getRolePermissions(role);
    assert.equal(typeof permissions.canViewExecutions, "boolean");
  }

  for (const role of ["operator", "workflow_editor", "org_admin"] as const) {
    assert.equal(canViewExecutions(role), true);
    assert.equal(canCancelRuns(role), true);
    assert.equal(canRetryRuns(role), true);
  }
});
