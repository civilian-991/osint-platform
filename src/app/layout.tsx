import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { StackProvider, StackTheme } from "@stackframe/stack";
import { stackServerApp } from "@/lib/auth/stack";
import './globals.css';

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
        <StackProvider app={stackServerApp}>
          <StackTheme>
            {children}
          </StackTheme>
        </StackProvider>
      </body>
    </html>
  );
}
