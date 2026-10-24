import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_PATHS, SESSION_COOKIE } from "@/lib/auth/cookie";

// Sends visitors without a session cookie to the login page. The cookie is
// only checked for presence here; pages and actions validate it against the
// database through requireUser().
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_PATHS.includes(pathname) || req.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = new URL("/login", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // API routes answer with 401 themselves instead of redirecting.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
