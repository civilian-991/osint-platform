import { stackServerApp } from "@/lib/auth/stack";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Get the user from Stack Auth
  const user = await stackServerApp.getUser();

  const isProtectedRoute =
    request.nextUrl.pathname === '/' ||
    request.nextUrl.pathname.startsWith('/aircraft') ||
    request.nextUrl.pathname.startsWith('/news') ||
    request.nextUrl.pathname.startsWith('/correlations') ||
    request.nextUrl.pathname.startsWith('/alerts');

  const isAuthRoute =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup');

  // Redirect to login if accessing protected route without auth
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect to dashboard if already logged in and accessing auth routes
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/cron (cron endpoints need their own auth)
     * - handler (Stack Auth handler)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/cron|handler).*)',
  ],
};
