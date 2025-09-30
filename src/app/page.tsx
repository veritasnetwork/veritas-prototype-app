'use client';

import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LandingPage } from '@/components/auth/LandingPage';

export default function HomePage() {
  const { authenticated, ready } = usePrivy();
  const { hasAccess } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if fully authenticated with access
    if (ready && authenticated && hasAccess) {
      console.log('Home: User has access, redirecting to feed');
      router.replace('/feed');
    }
  }, [authenticated, hasAccess, ready, router]);

  // Always show the landing page - it will handle its own loading states
  return <LandingPage />;
}