import { NextResponse, NextRequest } from "next/server";
import { COOKIE_STORAGE_KEYS } from "@/lib/constant";

function isUsableIp(value: string | null | undefined): value is string {
    if (!value) return false;
    const ip = value.trim();
    if (!ip || ip === "unknown") return false;
    // Coolify/internal proxy peer — not a real client IP
    if (ip.startsWith("vsock:")) return false;
    return true;
}

/** Prefer Cloudflare client IP; skip Coolify/internal vsock hops. */
function getClientIp(req: NextRequest): string {
    const candidates = [
        req.headers.get("cf-connecting-ip"),
        req.headers.get("true-client-ip"),
        ...(req.headers.get("x-forwarded-for")?.split(",").map((p) => p.trim()) ?? []),
        req.headers.get("x-real-ip"),
    ];

    for (const candidate of candidates) {
        if (isUsableIp(candidate)) return candidate.trim();
    }

    return "unknown";
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
