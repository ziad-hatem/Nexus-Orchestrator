import { z } from "zod";
import {
  isOrganizationRole,
  ORGANIZATION_ROLES,
  type MembershipStatus,
  type OrganizationRole,
} from "@/lib/server/permissions";
import {
  WORKFLOW_LIFECYCLE_STATUSES,
  WORKFLOW_NODE_TYPES,
  WORKFLOW_RUN_STATUSES,
  WORKFLOW_SUPPORTED_TRIGGER_TYPES,
  WORKFLOW_ACTION_TYPES,
  WORKFLOW_CONDITION_BRANCH_KEYS,
  WORKFLOW_CONDITION_OPERATORS,
  WORKFLOW_CONDITION_RESOLVER_SCOPES,
  INTERNAL_EVENT_KEYS,
} from "@/lib/server/workflows/types";

export const roleSchema = z.enum(ORGANIZATION_ROLES);
export const membershipStatusSchema = z.enum(["active", "suspended"]);

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters long")
    .max(120, "Organization name must be 120 characters or fewer"),
});

export const createInviteSchema = z.object({
  email: z.email("A valid email address is required").transform((value) => value.trim().toLowerCase()),
  name: z
    .string()
    .trim()
    .max(120, "Invite name must be 120 characters or fewer")
    .optional()
    .or(z.literal(""))
    .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : undefined)),
  role: roleSchema,
});

export const updateMembershipSchema = z
  .object({
    role: roleSchema.optional(),
    status: membershipStatusSchema.optional(),
  })
  .refine(
    (value) => typeof value.role !== "undefined" || typeof value.status !== "undefined",
    {
      message: "At least one membership field must be provided",
      path: ["role"],
    },
  );

export const memberFilterSchema = z.object({
  query: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value ? value : undefined)),
  role: roleSchema.optional(),
  status: membershipStatusSchema.optional(),
});

export const auditFilterSchema = z.object({
  query: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value ? value : undefined)),
  action: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value ? value : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const workflowLifecycleStatusSchema = z.enum(
  WORKFLOW_LIFECYCLE_STATUSES,
);
export const workflowTriggerTypeSchema = z.enum(WORKFLOW_SUPPORTED_TRIGGER_TYPES);
export const workflowNodeTypeSchema = z.enum(WORKFLOW_NODE_TYPES);
export const internalEventKeySchema = z.enum(INTERNAL_EVENT_KEYS);
export const workflowActionTypeSchema = z.enum(WORKFLOW_ACTION_TYPES);
export const workflowConditionBranchKeySchema = z.enum(
  WORKFLOW_CONDITION_BRANCH_KEYS,
);
export const workflowConditionResolverScopeSchema = z.enum(
  WORKFLOW_CONDITION_RESOLVER_SCOPES,
);
export const workflowConditionOperatorSchema = z.enum(
  WORKFLOW_CONDITION_OPERATORS,
);
export const workflowRunStatusSchema = z.enum(WORKFLOW_RUN_STATUSES);

const workflowConfigRecordSchema = z.record(z.string(), z.unknown());

export const workflowMetadataSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Workflow name must be at least 2 characters long")
    .max(120, "Workflow name must be 120 characters or fewer"),
  description: z
    .string()
    .trim()
    .max(2000, "Workflow description is too long")
    .optional()
    .or(z.literal(""))
    .transform((value) => value?.trim() ?? ""),
  category: z
    .string()
    .trim()
    .min(2, "Workflow category is required")
    .max(80, "Workflow category is too long"),
  tags: z
    .array(z.string().trim().min(1).max(32))
    .max(12, "Workflow tags cannot exceed 12 entries")
    .default([]),
});

export const workflowTriggerConfigSchema = z.object({
  id: z.string().trim().min(1).max(120),
  type: z.enum([
    "schedule",
    ...WORKFLOW_SUPPORTED_TRIGGER_TYPES,
  ] as const),
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).default(""),
  config: workflowConfigRecordSchema.default({}),
});

export const workflowConditionConfigSchema = z.object({
  id: z.string().trim().min(1).max(120),
  label: z.string().trim().max(120).default(""),
  description: z.string().trim().max(400).default(""),
  resolver: z.object({
    scope: workflowConditionResolverScopeSchema.default("payload"),
    path: z.string().trim().max(240).default(""),
  }),
  operator: workflowConditionOperatorSchema.default("equals"),
  value: z
    .union([z.string().max(400), z.number().finite(), z.boolean(), z.null()])
    .optional()
    .default(""),
  legacyExpression: z
    .string()
    .trim()
    .max(400)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  legacyIssue: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

export const workflowActionConfigSchema = z.object({
  id: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).default(""),
  type: workflowActionTypeSchema,
  config: workflowConfigRecordSchema.default({}),
});

export const workflowCanvasNodeSchema = z.object({
  id: z.string().trim().min(1).max(120),
  type: workflowNodeTypeSchema,
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).default(""),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  config: workflowConfigRecordSchema.default({}),
});

export const workflowCanvasEdgeSchema = z.object({
  id: z.string().trim().min(1).max(200),
  source: z.string().trim().min(1).max(120),
  target: z.string().trim().min(1).max(120),
  branchKey: workflowConditionBranchKeySchema
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

export const workflowDraftConfigSchema = z.object({
  trigger: workflowTriggerConfigSchema.nullable(),
  conditions: z.array(workflowConditionConfigSchema).default([]),
  actions: z.array(workflowActionConfigSchema).default([]),
});

export const workflowCanvasSchema = z.object({
  nodes: z.array(workflowCanvasNodeSchema).default([]),
  edges: z.array(workflowCanvasEdgeSchema).default([]),
});

export const workflowListFilterSchema = z.object({
  query: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value ? value : undefined)),
  status: workflowLifecycleStatusSchema.optional(),
  category: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => (value ? value : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const createWorkflowSchema = workflowMetadataSchema.extend({
  triggerType: workflowTriggerTypeSchema.optional(),
});

export const updateWorkflowDraftSchema = z
  .object({
    metadata: workflowMetadataSchema.partial().optional(),
    config: workflowDraftConfigSchema.partial().optional(),
    canvas: workflowCanvasSchema.optional(),
  })
  .refine(
    (value) =>
      value.metadata !== undefined ||
      value.config !== undefined ||
      value.canvas !== undefined,
    {
      message: "At least one workflow draft section must be provided",
      path: ["metadata"],
    },
  );

export const publishWorkflowSchema = z.object({
  notes: z
    .string()
    .trim()
    .max(500, "Publish notes must be 500 characters or fewer")
    .optional()
    .or(z.literal(""))
    .transform((value) => (typeof value === "string" ? value.trim() : "")),
});

export const archiveWorkflowSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, "Archive reason must be 500 characters or fewer")
    .optional()
    .or(z.literal(""))
    .transform((value) => (typeof value === "string" ? value.trim() : "")),
});

export const workflowIdSchema = z
  .string()
  .trim()
  .min(4, "Workflow id is required")
  .max(64, "Workflow id is too long");

export const workflowVersionNumberSchema = z.coerce
  .number()
  .int()
  .min(1, "Workflow version is invalid");

export const manualTriggerRequestSchema = z.object({
  payload: workflowConfigRecordSchema.optional(),
  idempotencyKey: z
    .string()
    .trim()
    .max(200, "Idempotency key is too long")
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export const regenerateWebhookSecretSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(200, "Reason is too long")
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export const streamFilterSchema = z.object({
  query: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value ? value : undefined)),
  source: workflowTriggerTypeSchema.optional(),
  status: z.enum(["accepted", "rejected", "duplicate", "rate_limited"]).optional(),
  workflowId: workflowIdSchema.optional(),
  eventKey: internalEventKeySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const triggerAttemptFilterSchema = z.object({
  status: z.enum(["accepted", "rejected", "duplicate", "rate_limited"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(25).default(10),
});

export const internalEventIngestionSchema = z.object({
  eventId: z.string().trim().min(1).max(200),
  eventKey: internalEventKeySchema,
  source: z.string().trim().min(1).max(120),
  payload: workflowConfigRecordSchema.default({}),
  occurredAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.literal(""))
    .transform((value) => (typeof value === "string" && value ? value : undefined)),
});

export const executionListFilterSchema = z.object({
  query: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value ? value : undefined)),
  status: workflowRunStatusSchema.optional(),
  source: workflowTriggerTypeSchema.optional(),
  workflowId: workflowIdSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const executionRunIdSchema = z
  .string()
  .trim()
  .min(4, "Run id is required")
  .max(64, "Run id is too long");

export const cancelRunSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(300, "Cancellation reason must be 300 characters or fewer")
    .optional()
    .or(z.literal(""))
    .transform((value) => (typeof value === "string" && value ? value : undefined)),
});

export const orgSlugSchema = z
  .string()
  .trim()
  .min(1, "Organization slug is required")
  .max(120, "Organization slug is too long")
  .regex(/^[a-z0-9-]+$/, "Organization slug is invalid");

export function normalizeOptionalText(
  value: unknown,
  maxLength: number,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const parsed = z.email().safeParse(trimmed);
  return parsed.success ? parsed.data : null;
}

export function normalizeOrgSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "workspace";
}

export function normalizeWebhookPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (!normalized.startsWith("/hooks/")) {
    return normalized.startsWith("/hooks")
      ? normalized.replace(/^\/hooks/, "/hooks/")
      : `/hooks/${normalized.replace(/^\/+/, "")}`;
  }

  return normalized.replace(/\/{2,}/g, "/");
}

export function parseRole(value: unknown): OrganizationRole | null {
  return isOrganizationRole(value) ? value : null;
}

export function parseMembershipStatus(value: unknown): MembershipStatus | null {
  return value === "active" || value === "suspended" ? value : null;
}
