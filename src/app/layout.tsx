import type { Metadata } from 'next';
import { JetBrains_Mono, Outfit } from 'next/font/google';
import { AuthProvider } from '@/lib/auth/provider';
import './globals.css';
import '@neondatabase/auth/ui/css';

// Primary display font - geometric, modern
const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

// Monospace font for technical data
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

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
    <html lang="en" className="dark">
      <body className={`${outfit.variable} ${jetbrainsMono.variable} font-sans`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
