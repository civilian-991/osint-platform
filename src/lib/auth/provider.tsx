'use client';

import { NeonAuthUIProvider } from '@neondatabase/auth/react/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from './neon';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <NeonAuthUIProvider
      authClient={auth}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => router.refresh()}
      redirectTo="/"
      Link={Link}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
