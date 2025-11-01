/**
 * Post Detail Page
 * Displays a single post with full content, trading interface, and metrics
 * Route: /post/[id]
 */

import { PostDetailPageClient } from '@/components/post/PostDetailPage';

// Force dynamic rendering - don't statically generate this page
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PostPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;

  return <PostDetailPageClient postId={id} />;
}
