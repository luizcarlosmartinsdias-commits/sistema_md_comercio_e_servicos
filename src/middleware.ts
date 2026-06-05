import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

const loginPath = '/login';
const dashboardPath = '/dashboard';
const protectedPrefixes = ['/dashboard', '/requests'];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const isAuthenticated = Boolean(token);

  if (pathname === loginPath && isAuthenticated) {
    return NextResponse.redirect(new URL(dashboardPath, request.url));
  }

  if (isProtectedPath(pathname) && !isAuthenticated) {
    const loginUrl = new URL(loginPath, request.url);
    loginUrl.searchParams.set('callbackUrl', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export const config = { matcher: ['/login', '/dashboard/:path*', '/requests/:path*'] };
