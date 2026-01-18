import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth/provider';
import './globals.css';
import '@neondatabase/auth/ui/css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OSINT Aviation Platform',
  description: 'Military aviation monitoring and news correlation platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
