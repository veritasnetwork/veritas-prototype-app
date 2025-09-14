'use client';

import { Sidebar } from '@/components/layout/Sidebar';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-h-screen lg:ml-28 px-4 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}