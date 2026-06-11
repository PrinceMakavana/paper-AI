import { NextResponse, NextRequest } from "next/server";
import { COOKIE_STORAGE_KEYS } from "@/lib/constant";

function redirectPreservingSearch(req: NextRequest, pathname: string) {
    const url = new URL(pathname, req.url);
    url.search = req.nextUrl.search;
    return NextResponse.redirect(url);
}

function nextWithNoStore() {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "private, no-store");
    return res;
}

export async function middleware(req: NextRequest) {
    const token = req.cookies.get(COOKIE_STORAGE_KEYS.ACCESS_TOKEN)?.value;
    const publicRoutes = ["/login", "/register", "/forgot-password", "/verify-email", "/reset-password"];
    const protectedRoutes = ["/chat", "/profile"];
    const isPublicRoute = publicRoutes.some((route) => req.nextUrl.pathname.startsWith(route));
    const isProtectedRoute = protectedRoutes.some((route) => req.nextUrl.pathname.startsWith(route));

    if (isPublicRoute) {
        if (token && req.nextUrl.pathname.startsWith("/verify-email")) {
            return nextWithNoStore();
        }
        if (token) {
            return redirectPreservingSearch(req, "/chat");
        }
        return nextWithNoStore();
    }

    if (isProtectedRoute && !token) {
        return redirectPreservingSearch(req, "/login");
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/login",
        "/register",
        "/forgot-password",
        "/verify-email",
        "/reset-password",
        "/chat/:path*",
        "/profile"
    ],
};
