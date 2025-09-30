'use client';

import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@privy-io/react-auth';
import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAccess?: boolean;
}

export function ProtectedRoute({ children, requireAccess = false }: ProtectedRouteProps) {
  const { authenticated } = usePrivy();
  const { hasAccess, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // If authentication is required but user is not authenticated
    if (!authenticated) {
      router.push('/');
      return;
    }

    // If access is required but user doesn't have access
    if (requireAccess && !hasAccess) {
      router.push('/invite');
      return;
    }
  }, [authenticated, hasAccess, isLoading, requireAccess, router]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Don't render protected content until auth checks pass
  if (!authenticated || (requireAccess && !hasAccess)) {
    return null;
  }

  return <>{children}</>;
}