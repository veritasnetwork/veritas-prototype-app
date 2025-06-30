import { BeliefDetailPage } from '@/components/belief-details/BeliefDetailPage';

interface BeliefDetailRouteProps {
  params: Promise<{ id: string }>;
}

export default async function BeliefDetailRoute({ params }: BeliefDetailRouteProps) {
  const { id } = await params;
  return <BeliefDetailPage beliefId={id} />;
}
