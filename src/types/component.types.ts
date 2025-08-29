import { HeadingData, ArticleData } from './content.types';

export type ComponentType = 'heading' | 'chart' | 'article' | 'metadata';
export type ComponentVariant = 'card' | 'detail' | 'news';

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
  contentId?: string; // New prop for identifying the content
  beliefId?: string; // Legacy prop for backward compatibility
  variant: ComponentVariant;
  showOnlyFeedChart?: boolean;
  isEditable?: boolean;
  onEdit?: () => void;
}

export interface EditableComponent {
  id: string;
  type: ComponentType;
  contentId: string;
  beliefId?: string; // Legacy prop for backward compatibility
  currentVersion: Record<string, unknown>;
  proposedChanges: Array<{
    id: string;
    proposedBy: string;
    proposal: Record<string, unknown>;
    votes: { up: number; down: number };
    createdAt: string;
  }>;
}
