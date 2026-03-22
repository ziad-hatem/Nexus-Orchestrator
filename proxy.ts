import { NextResponse, type NextRequest } from "next/server";
import {
  ACTIVE_ORG_COOKIE,
  ACTIVE_ORG_COOKIE_MAX_AGE_SECONDS,
  FLAT_ROUTE_REDIRECTS,
} from "@/lib/topbar/constants";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const orgMatch = pathname.match(/^\/org\/([^/]+)/);

  if (orgMatch?.[1]) {
    const response = NextResponse.next();
    response.cookies.set(ACTIVE_ORG_COOKIE, decodeURIComponent(orgMatch[1]), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ACTIVE_ORG_COOKIE_MAX_AGE_SECONDS,
    });
    return response;
  }

  const targetSuffix =
    FLAT_ROUTE_REDIRECTS[pathname as keyof typeof FLAT_ROUTE_REDIRECTS];
  if (typeof targetSuffix === "string") {
    const activeOrgSlug = request.cookies.get(ACTIVE_ORG_COOKIE)?.value?.trim();
    const destination = activeOrgSlug
      ? `/org/${activeOrgSlug}${targetSuffix}`
      : "/";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/workflows", "/team", "/audit", "/profile", "/org/:path*"],
};
