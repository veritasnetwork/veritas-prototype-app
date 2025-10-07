import { PostDetailView } from '@/components/post/PostDetailView';

export default function PostDetailPage({ params }: { params: { id: string } }) {
  return <PostDetailView postId={params.id} />;
}
