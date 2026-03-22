import { canManageMembers } from "@/lib/server/permissions";
import { requirePageOrgAccess } from "@/lib/server/org-access";
import { listOrganizationMembers } from "@/lib/server/membership-service";
import { memberFilterSchema } from "@/lib/server/validation";
import { firstSearchParam } from "@/lib/search-params";
import { MemberTable } from "@/app/components/team/member-table";
import { TeamStoreHydrator } from "@/app/components/team/team-store-hydrator";

type TeamPageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeamPage({
  params,
  searchParams,
}: TeamPageProps) {
  const { orgSlug } = await params;
  const context = await requirePageOrgAccess(
    orgSlug,
    (candidate) => canManageMembers(candidate.membership.role),
  );
  const resolvedSearchParams = await searchParams;
  const parsedFilters = memberFilterSchema.safeParse({
    query: firstSearchParam(resolvedSearchParams.query),
    role: firstSearchParam(resolvedSearchParams.role),
    status: firstSearchParam(resolvedSearchParams.status),
  });
  const filters = parsedFilters.success ? parsedFilters.data : {};
  const { members, invites } = await listOrganizationMembers(
    context.organization.id,
    filters,
  );

  return (
    <>
      <TeamStoreHydrator
        members={members}
        invites={invites}
        filters={filters}
      />
      <MemberTable
        orgSlug={orgSlug}
        members={members}
        invites={invites}
        filters={filters}
      />
    </>
  );
}
