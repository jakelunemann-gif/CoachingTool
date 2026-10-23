import { NextResponse, type NextRequest } from "next/server";

// When APP_PASSWORD is set (any hosted deploy), every page and API route sits
// behind the browser's Basic auth prompt. The username can be anything; only
// the password is checked. Unset locally, so dev and e2e runs are untouched.
export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      if (decoded.slice(decoded.indexOf(":") + 1) === password) return NextResponse.next();
    } catch {
      // Malformed header: fall through to the prompt.
    }
  }

  return new NextResponse("Password required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Practice Planner", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
