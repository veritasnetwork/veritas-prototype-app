import { HeadingData, ArticleData } from './belief.types';

export type ComponentType = 'heading' | 'chart' | 'article' | 'metadata';
export type ComponentVariant = 'card' | 'detail';

export interface HeadingComponentProps {
  heading: HeadingData;
  variant: ComponentVariant;
  theme?: 'light' | 'dark';
  isEditable?: boolean;
  onEdit?: () => void;
}

export interface ArticleComponentProps {
  article: ArticleData;
  variant: ComponentVariant;
  isEditable?: boolean;
  onEdit?: () => void;
}

export interface ChartComponentProps {
  charts: unknown[]; // Keep for backward compatibility
  beliefId?: string; // New prop for identifying the belief
  variant: ComponentVariant;
  showOnlyFeedChart?: boolean;
  isEditable?: boolean;
  onEdit?: () => void;
}

export interface EditableComponent {
  id: string;
  type: ComponentType;
  beliefId: string;
  currentVersion: Record<string, unknown>;
  proposedChanges: Array<{
    id: string;
    proposedBy: string;
    proposal: Record<string, unknown>;
    votes: { up: number; down: number };
    createdAt: string;
  }>;
}
