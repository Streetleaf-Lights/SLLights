import { NextRequest, NextResponse } from "next/server";
import { decodeSessionToken, homeRouteForRole, isCustomerScoped } from "@/lib/auth-role";

// Routes reachable without a session.
const PUBLIC_PATHS = ["/signin", "/register", "/forgot-password", "/reset-password"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Server-side route enforcement. This matters beyond just hiding the
 * Customers link in the sidebar: getCustomers/getPoles/getUsers in apim.ts
 * are authorized only by the shared APIM subscription key, not a per-user
 * Bearer token, so APIM itself won't stop a Customer Admin (or anyone with
 * a direct URL) from reading another customer's data — this middleware is
 * the actual enforcement boundary for that, not just a UI nicety.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("session")?.value;
  const session = token ? decodeSessionToken(token) : null;

  if (!session) {
    const signInUrl = new URL("/signin", request.url);
    return NextResponse.redirect(signInUrl);
  }

  if (isCustomerScoped(session.role, session.customerId)) {
    // The Customers list spans every customer; anyone scoped to just one
    // (Customer Admin, or a Customer User) only has one. Route them to
    // their actual home page instead.
    if (pathname === "/" || pathname === "/customers" || pathname === "/customers/") {
      return NextResponse.redirect(
        new URL(homeRouteForRole(session.role, session.customerId), request.url),
      );
    }

    // /customers/{id}/... (project and pole detail pages included) is only
    // allowed for their own customer id.
    const customerRouteMatch = pathname.match(/^\/customers\/([^/]+)/);
    if (customerRouteMatch && customerRouteMatch[1] !== session.customerId) {
      return NextResponse.redirect(
        new URL(homeRouteForRole(session.role, session.customerId), request.url),
      );
    }
  } else if (pathname === "/projects" || pathname.startsWith("/projects/")) {
    // /projects is a customer-scoped person's own customer overview — it
    // only exists for them, everyone else gets sent to their own home page.
    return NextResponse.redirect(
      new URL(homeRouteForRole(session.role, session.customerId), request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  // Skip API routes (they read the session cookie themselves) and static
  // assets (anything with a file extension), plus Next's own internals.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
