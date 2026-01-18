'use client';

import { AuthView } from '@neondatabase/auth/react/ui';
import { Plane } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function AuthPage() {
  const params = useParams();
  const path = params.path as string;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg shadow-lg border border-border p-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <Plane className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">OSINT Aviation</span>
          </div>

          <AuthView path={path} />
        </div>
      </div>
    </div>
  );
}
