/**
 * Post Detail Page
 * Displays a single post with full content, trading interface, and metrics
 * Route: /post/[id]
 */

import { PostDetailPageClient } from '@/components/post/PostDetailPage';

interface PostPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;

  return <PostDetailPageClient postId={id} />;
}
