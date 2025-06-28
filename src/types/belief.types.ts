export interface BaseBelief {
  id: string;
  title: string;
  description: string;
  category: string;
  createdAt: string;
  status: 'active' | 'resolved' | 'closed';
  totalStake: number;
  participantCount: number;
  consensusLevel: number; // 0-1 scale
  entropy: number;
}

export interface ContinuousBelief extends BaseBelief {
  type: 'continuous';
  distribution: {
    mean: number;
    variance: number;
    min?: number;
    max?: number;
  };
  unit: string; // e.g., "USD", "°C", etc.
}

export interface DiscreteBelief extends BaseBelief {
  type: 'discrete';
  options: Array<{
    id: string;
    label: string;
    probability: number;
  }>;
}

export type Belief = ContinuousBelief | DiscreteBelief;

export type ComponentVariant = 'card' | 'detail';
