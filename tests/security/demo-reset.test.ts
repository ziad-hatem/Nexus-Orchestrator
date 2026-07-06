import assert from "node:assert/strict";
import test from "node:test";
import { selectSoleMemberOrgIds } from "@/app/api/internal/demo/reset/route";

test("selectSoleMemberOrgIds only wipes orgs where the demo user is the sole member", () => {
  const demoUserId = "demo-user";
  const memberships = [
    { organization_id: "demo-only-org", user_id: demoUserId },
    { organization_id: "shared-org", user_id: demoUserId },
    { organization_id: "shared-org", user_id: "real-user" },
    { organization_id: "other-org", user_id: "real-user" },
  ];

  assert.deepEqual(selectSoleMemberOrgIds(demoUserId, memberships), [
    "demo-only-org",
  ]);
});

test("selectSoleMemberOrgIds returns nothing when the demo user has no memberships", () => {
  assert.deepEqual(selectSoleMemberOrgIds("demo-user", []), []);
});
