import { Feed } from '@/components/feed/Feed';

// Force dynamic rendering - prevent any static generation
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function FeedPage() {
  return <Feed />;
}