import { ContentDetailPage } from '@/components/content-details/ContentDetailPage';

interface ContentDetailRouteProps {
  params: Promise<{ id: string }>;
}

export default async function ContentDetailRoute({ params }: ContentDetailRouteProps) {
  const { id } = await params;
  return <ContentDetailPage contentId={id} />;
}
