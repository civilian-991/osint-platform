'use client';

import { AuthView } from '@neondatabase/auth/react/ui';
import { Plane } from 'lucide-react';
import Link from 'next/link';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg shadow-lg border border-border p-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <Plane className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">OSINT Aviation</span>
          </div>

          <AuthView path="sign-up" />

          {/* Sign in link */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
