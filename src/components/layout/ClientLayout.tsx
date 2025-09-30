'use client';

import { useAuth } from '@/providers/AuthProvider';
import { usePrivy } from '@privy-io/react-auth';
import { Sidebar } from '@/components/layout/Sidebar';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { authenticated } = usePrivy();
  const { hasAccess } = useAuth();

  // Only show sidebar for authenticated users with access
  const showSidebar = authenticated && hasAccess;

  return (
    <div className="flex">
      {showSidebar && <Sidebar />}
      <main className={`flex-1 min-h-screen ${showSidebar ? 'lg:ml-28 px-4 lg:px-8 py-8' : ''}`}>
        {children}
      </main>
    </div>
  );
}