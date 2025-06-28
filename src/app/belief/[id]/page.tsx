import { BeliefDetailPage } from '@/components/belief-details/BeliefDetailPage';

interface BeliefDetailRouteProps {
  params: { id: string };
}

export default function BeliefDetailRoute({ params }: BeliefDetailRouteProps) {
  return <BeliefDetailPage beliefId={params.id} />;
}
