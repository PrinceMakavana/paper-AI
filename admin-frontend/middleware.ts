import { NextRequest, NextResponse } from "next/server";
import { COOKIE_STORAGE_KEYS } from "@/lib/constants";

function redirectTo(req: NextRequest, pathname: string) {
  return NextResponse.redirect(new URL(pathname, req.url));
}

export function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_STORAGE_KEYS.ACCESS_TOKEN)?.value;
  const isLoginRoute = req.nextUrl.pathname === "/login";

  if (isLoginRoute) {
    if (token) {
      return redirectTo(req, "/");
    }

    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  if (!token) {
    return redirectTo(req, "/login");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login"],
};
