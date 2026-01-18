import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Singleton instance for client-side usage
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getClient() {
  if (typeof window === 'undefined') {
    throw new Error('getClient should only be used on the client side');
  }

  if (!browserClient) {
    browserClient = createClient();
  }

  return browserClient;
}
