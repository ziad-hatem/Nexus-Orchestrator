import assert from "node:assert/strict";
import test from "node:test";
import {
  createTriggerBindingRow,
  markTriggerBindingSecretUsed,
  triggerRepositoryDeps,
} from "@/lib/server/triggers/repository";
import { restoreMutableExports } from "@/tests/helpers/test-utils";

const originalTriggerRepositoryDeps = { ...triggerRepositoryDeps };

test.afterEach(() => {
  restoreMutableExports(triggerRepositoryDeps, originalTriggerRepositoryDeps);
});

function createBindingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "binding_1",
    organization_id: "org_1",
    workflow_id: "workflow_db_1",
    workflow_version_id: "version_db_1",
    source_type: "webhook",
    match_key: "/hooks/acme/orders",
    config_snapshot: {
      id: "trigger_1",
      type: "webhook",
      label: "Webhook",
      description: "",
      config: { path: "/hooks/acme/orders", method: "POST" },
    },
    secret_hash: "hash_1",
    secret_last_four: "1234",
    is_active: true,
    created_by: "user_1",
    updated_by: "user_1",
    created_at: "2026-03-23T00:00:00.000Z",
    updated_at: "2026-03-23T00:00:00.000Z",
    ...overrides,
  };
}

test("createTriggerBindingRow retries without phase-eight secret usage columns on legacy schemas", async () => {
  const state = {
    insertCount: 0,
  };

  triggerRepositoryDeps.createSupabaseAdminClient = () =>
    ({
      from(table: string) {
        assert.equal(table, "workflow_trigger_bindings");

        return {
          insert(payload: Record<string, unknown>) {
            state.insertCount += 1;

            return {
              select() {
                return {
                  async single() {
                    if (state.insertCount === 1) {
                      return {
                        data: null,
                        error: {
                          message:
                            "Could not find the 'secret_last_used_at' column of 'workflow_trigger_bindings' in the schema cache",
                        },
                      };
                    }

                    return {
                      data: createBindingRecord(payload),
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      },
    }) as never;

  const binding = await createTriggerBindingRow({
    organizationId: "org_1",
    workflowDbId: "workflow_db_1",
    workflowVersionId: "version_db_1",
    sourceType: "webhook",
    matchKey: "/hooks/acme/orders",
    configSnapshot: {
      id: "trigger_1",
      type: "webhook",
      label: "Webhook",
      description: "",
      config: { path: "/hooks/acme/orders", method: "POST" },
    },
    secretHash: "hash_1",
    secretLastFour: "1234",
    userId: "user_1",
  });

  assert.equal(state.insertCount, 2);
  assert.equal(binding.secret_rotated_at, null);
  assert.equal(binding.secret_last_used_at, null);
  assert.equal(binding.match_key, "/hooks/acme/orders");
});

test("markTriggerBindingSecretUsed becomes a no-op when the legacy schema is missing the usage column", async () => {
  triggerRepositoryDeps.createSupabaseAdminClient = () =>
    ({
      from(table: string) {
        assert.equal(table, "workflow_trigger_bindings");

        return {
          update() {
            return {
              async eq(column: string, value: string) {
                assert.equal(column, "id");
                assert.equal(value, "binding_1");

                return {
                  error: {
                    message:
                      "Could not find the 'secret_last_used_at' column of 'workflow_trigger_bindings' in the schema cache",
                  },
                };
              },
            };
          },
        };
      },
    }) as never;

  await assert.doesNotReject(() => markTriggerBindingSecretUsed("binding_1"));
});
