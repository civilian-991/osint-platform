'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/auth/neon';
import Link from 'next/link';
import { Plane, Map, Newspaper, Link2, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const session = auth.useSession();

  useEffect(() => {
    // If logged in, redirect to dashboard
    if (session.data?.user) {
      router.push('/aircraft');
    }
  }, [session.data, router]);

  // Show loading while checking session
  if (session.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plane className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">OSINT Aviation</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm hover:text-primary transition-colors">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Military Aviation Monitoring & Intelligence Platform
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Track military aircraft in real-time, correlate with news events, and gain insights through automated analysis.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Start Monitoring
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="px-6 py-3 border border-border rounded-md hover:bg-muted transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Key Features</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={Map}
              title="Real-Time Tracking"
              description="Monitor military aircraft across the Middle East with live position updates and interactive mapping."
            />
            <FeatureCard
              icon={Newspaper}
              title="News Aggregation"
              description="Automatic collection and filtering of relevant news from trusted sources with credibility scoring."
            />
            <FeatureCard
              icon={Link2}
              title="Smart Correlation"
              description="AI-powered analysis to detect connections between aircraft activity and news events."
            />
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Coverage Area</h2>
          <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
            Monitoring military aviation activity across key regions in the Middle East and Eastern Mediterranean.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              'Lebanon',
              'Israel',
              'Syria',
              'Iran',
              'Iraq',
              'Turkey',
              'Egypt',
              'Cyprus',
              'GCC States',
            ].map((region) => (
              <span
                key={region}
                className="px-4 py-2 bg-primary/10 text-primary rounded-full"
              >
                {region}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" />
            <span className="font-bold">OSINT Aviation</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Open source intelligence for aviation monitoring
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Map;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
