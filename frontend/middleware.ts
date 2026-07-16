import { NextResponse, NextRequest } from "next/server";
import { COOKIE_STORAGE_KEYS } from "@/lib/constant";

function getClientIp(req: NextRequest): string {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0]?.trim() || "unknown";
    }
    return (
        req.headers.get("x-real-ip") ||
        req.headers.get("cf-connecting-ip") ||
        "unknown"
    );
}

function logRequest(req: NextRequest) {
    const ip = getClientIp(req);
    const path = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    console.log(`[FE] ${ip} ${req.method} ${path}`);
}

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
    logRequest(req);

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
    // Log all page/API hits; skip Next internals and common static assets
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?)$).*)",
    ],
};
