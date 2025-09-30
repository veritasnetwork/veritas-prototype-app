'use client';

import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Feed } from '@/components/feed/Feed';

export default function FeedPage() {
  const { authenticated, ready } = usePrivy();
  const { hasAccess, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait for Privy to be ready before making decisions
    if (!ready) return;

    // Only redirect if we're done loading and user doesn't have access
    if (!isLoading && (!authenticated || !hasAccess)) {
      console.log('Feed: No access, redirecting to landing page');
      router.replace('/');
    }
  }, [authenticated, hasAccess, isLoading, ready, router]);

  // Show loading while Privy is initializing or auth is being checked
  if (!ready || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#B9D9EB]"></div>
      </div>
    );
  }

  // Don't render anything if not authenticated - redirect will happen
  if (!authenticated || !hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#B9D9EB]"></div>
      </div>
    );
  }

  return <Feed />;
}