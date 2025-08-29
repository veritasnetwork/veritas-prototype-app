// Algorithm types for Veritas 2.0

export interface Algorithm {
  id: string;
  name: string;
  description: string;
  type: 'preset' | 'community' | 'user';
  
  // Signal weights (0-100, representing importance)
  weights: {
    [signalKey: string]: number;
  };
  
  // Metadata
  creator?: string;
  popularity?: number;           // How many users use this
  performance?: number;          // Success rate/satisfaction
  createdAt: string;
  updatedAt: string;
}

export interface UserAlgorithmSettings {
  selectedAlgorithmId: string | null;
  customWeights?: {
    [signalKey: string]: number;
  };
}

// Signal configuration types
export interface SignalConfig {
  key: string;
  name: string;
  description: string;
  category: SignalCategory;
  defaultWeight: number;        // Default importance in algorithms
  color: string;                // For graph visualization
  icon?: string;                // Optional icon identifier
}

export type SignalCategory = 
  | 'accuracy'      // truth, fact-checking, verification
  | 'impact'        // relevance, importance, urgency
  | 'quality'       // informativeness, depth, clarity
  | 'temporal'      // recency, trending, breaking
  | 'engagement'    // controversy, discussion, shareability
  | 'domain';       // category-specific (tech, politics, etc.)