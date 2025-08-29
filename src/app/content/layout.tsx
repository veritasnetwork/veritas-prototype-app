'use client';

import { FeedProvider } from '@/contexts/FeedContext';

export default function ContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeedProvider>
      {children}
    </FeedProvider>
  );
}