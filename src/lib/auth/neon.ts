'use client';

import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

// Create the auth client with React adapter for hooks
export const auth = createAuthClient(process.env.NEXT_PUBLIC_NEON_AUTH_URL!, {
  adapter: BetterAuthReactAdapter(),
});
