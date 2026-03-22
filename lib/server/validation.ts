import { z } from "zod";
import {
  isOrganizationRole,
  ORGANIZATION_ROLES,
  type MembershipStatus,
  type OrganizationRole,
} from "@/lib/server/permissions";

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

export function parseRole(value: unknown): OrganizationRole | null {
  return isOrganizationRole(value) ? value : null;
}

export function parseMembershipStatus(value: unknown): MembershipStatus | null {
  return value === "active" || value === "suspended" ? value : null;
}
