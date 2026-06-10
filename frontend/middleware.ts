import { NextResponse, NextRequest } from "next/server";
import { COOKIE_STORAGE_KEYS } from "@/lib/constant";
export async function middleware(req: NextRequest) {
    const token = req.cookies.get(COOKIE_STORAGE_KEYS.ACCESS_TOKEN)?.value;
    const publicRoutes = ["/login", "/register", "/forgot-password", "/verify-email", "/reset-password"];
    const protectedRoutes = ["/chat", "/profile"];
    const isPublicRoute = publicRoutes.some((route) => req.nextUrl.pathname.startsWith(route));
    const isProtectedRoute = protectedRoutes.some((route) => req.nextUrl.pathname.startsWith(route));

    if (isPublicRoute) {
        if (token) {
            return NextResponse.redirect(new URL("/chat", req.url))
        }
        return NextResponse.next();
    }

    if (isProtectedRoute && !token) {
        return NextResponse.redirect(new URL('/login', req.url));
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
