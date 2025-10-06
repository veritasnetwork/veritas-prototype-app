'use client';

import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function LandingPage() {
  const { login, authenticated, ready } = usePrivy();
  const { hasAccess, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && authenticated && hasAccess) {
      router.replace('/feed');
    }
  }, [authenticated, hasAccess, isLoading, router]);

  const handleLoginClick = async () => {
    if (!ready) return;

    try {
      await login();
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  if (isLoading || !ready) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#B9D9EB]"></div>
      </div>
    );
  }

  if (authenticated && hasAccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#B9D9EB]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center overflow-hidden relative">
      <div className="absolute top-8 left-8 flex items-center gap-3">
        <img
          src="/icons/logo.png"
          alt="Veritas Logo"
          className="w-8 h-8"
        />
        <span className="text-[#F0EAD6] font-bold text-xl tracking-wider font-mono">VERITAS</span>
      </div>

      <div className="text-center">
        <h1 className="text-[#F0EAD6] text-2xl font-medium mb-12 tracking-wide font-mono">
          DISCOVER WHAT HUMANITY TRULY BELIEVES.
        </h1>
        <button
          onClick={handleLoginClick}
          disabled={!ready}
          className="bg-[#B9D9EB] hover:bg-[#0C1D51] text-[#0C1D51] hover:text-[#B9D9EB] border border-[#0C1D51] hover:border-[#B9D9EB] font-medium py-4 px-8 rounded font-mono disabled:opacity-50 transition-all duration-300 ease-in-out"
        >
          CONNECT WALLET
        </button>
      </div>
    </div>
  );
}