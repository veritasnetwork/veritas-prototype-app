export type ComponentType = 'heading' | 'chart' | 'article' | 'metadata';
export type ComponentVariant = 'card' | 'detail';

export interface EditableComponent {
  id: string;
  type: ComponentType;
  beliefId: string;
  currentVersion: unknown; // Specific to component type
  proposedChanges: Array<{
    id: string;
    proposedBy: string;
    proposal: unknown;
    votes: { up: number; down: number };
    createdAt: string;
  }>;
}
