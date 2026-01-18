import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Check for session cookie (Neon Auth uses this cookie name)
  const sessionCookie = request.cookies.get('__Secure-neon-auth.session_token');
  const isAuthenticated = !!sessionCookie?.value;

  const isProtectedRoute =
    request.nextUrl.pathname === '/' ||
    request.nextUrl.pathname.startsWith('/map') ||
    request.nextUrl.pathname.startsWith('/aircraft') ||
    request.nextUrl.pathname.startsWith('/news') ||
    request.nextUrl.pathname.startsWith('/correlations') ||
    request.nextUrl.pathname.startsWith('/alerts') ||
    request.nextUrl.pathname.startsWith('/watchlists') ||
    request.nextUrl.pathname.startsWith('/settings');

  const isAuthRoute =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup') ||
    request.nextUrl.pathname.startsWith('/auth');

  // Redirect to sign-in if accessing protected route without auth
  if (isProtectedRoute && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/sign-in';
    return NextResponse.redirect(url);
  }

  // Redirect to dashboard if already logged in and accessing auth routes
  if (isAuthRoute && isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/aircraft';
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
     * - api/auth (auth API routes)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/cron|api/auth).*)',
  ],
};
