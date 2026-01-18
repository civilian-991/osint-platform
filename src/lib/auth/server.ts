import { createAuthClient } from '@neondatabase/auth';
import { cookies } from 'next/headers';

// Create a server-side auth client
export function createServerAuthClient() {
  return createAuthClient(process.env.NEXT_PUBLIC_NEON_AUTH_URL!);
}

// Get session from cookies for server-side use
export async function getServerSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('better-auth.session_token');

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
