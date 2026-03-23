import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getPostAuthRedirectPath } from "@/lib/server/org-service";
import { ACTIVE_ORG_COOKIE } from "@/lib/topbar/constants";
import { LandingClient } from "@/app/components/marketing/landing-client";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <LandingClient />;
  }

  const cookieStore = await cookies();
  const preferredOrgSlug = cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;
  const destination = await getPostAuthRedirectPath(
    session.user.id,
    preferredOrgSlug,
  );

  redirect(destination);
}
