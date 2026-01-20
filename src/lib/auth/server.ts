import { createAuthClient } from '@neondatabase/auth';
import { cookies } from 'next/headers';

// Create a server-side auth client
export function createServerAuthClient() {
  return createAuthClient(process.env.NEXT_PUBLIC_NEON_AUTH_URL!);
}

// Get session from cookies for server-side use
export async function getServerSession() {
  const cookieStore = await cookies();
  // Check both secure (HTTPS/production) and non-secure (HTTP/development) cookie names
  const sessionCookie =
    cookieStore.get('__Secure-neon-auth.session_token') ||
    cookieStore.get('neon-auth.session_token');

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const auth = createServerAuthClient();
    const session = await auth.getSession();
    return session;
  } catch {
    return null;
  }
}
