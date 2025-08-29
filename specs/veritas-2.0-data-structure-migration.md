# Data Structure Migration Guide

## Overview
This document outlines the migration from a "belief prediction platform" to a "decentralized content ranking and discovery platform". The core change is that **content pieces now have multiple signals** (formerly beliefs) that can be weighted by different algorithms to create personalized feeds.

## Key Conceptual Changes
- **Beliefs** → **Content** (each piece of content)
- **Single belief score** → **Multiple signals** (truth, relevance, etc.)
- **Categories** → **Signals** (categories become just another signal)
- **Fixed ranking** → **Algorithm-based ranking** (users choose/create algorithms)

---

## 1. File Structure Changes

### Files to Rename
- `src/data/beliefs.json` → `src/data/content.json`
- `src/types/belief.types.ts` → Keep filename but update interfaces

### New Files to Create
- `src/data/algorithms.json`
- `src/data/signals-config.json`
- `src/lib/algorithmEngine.ts`
- `src/lib/signalUtils.ts`

---

## 2. Data Structure Definitions

### 2.1 Content Structure (formerly Belief)

```typescript
// src/types/belief.types.ts
// Keep the filename for backward compatibility, but update interfaces

export interface Content {
  id: string;
  
  // Content information (unchanged)
  heading: HeadingData;
  article: ArticleData;
  
  // NEW: Multiple signals replace objectRankingScores
  signals: SignalCollection;
  
  // Metadata
  isPremier?: boolean;
  createdAt: string;
  updatedAt: string;
  status?: 'active' | 'resolved';
  
  // REMOVED: category (now a signal)
  // REMOVED: objectRankingScores (replaced by signals)
  // REMOVED: charts array (generated from signal data)
}

export interface SignalCollection {
  [signalKey: string]: Signal;
}

export interface Signal {
  key: string;                    // Unique identifier (e.g., 'truth', 'relevance')
  name: string;                    // Display name (e.g., 'Truth Score')
  currentValue: number;            // Current value (0-100)
  historicalData: SignalDataPoint[];
  metadata: {
    contributors: number;          // Number of people who've contributed
    lastUpdated: string;          // ISO timestamp
    stake?: number;               // Optional: total stake on this signal
    volatility?: number;          // Optional: how much it changes
  };
}

export interface SignalDataPoint {
  timestamp: string;              // ISO timestamp
  value: number;                  // Signal value at this time (0-100)
  epochNumber?: number;           // Optional: which epoch this was from
}

// Keep Belief as alias for backward compatibility during migration
export type Belief = Content;
```

### 2.2 Algorithm Structure

```typescript
// src/types/algorithm.types.ts (new file)

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
```

### 2.3 Signal Configuration

```typescript
// src/types/signal.types.ts (new file)

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
```

---

## 3. Data Files

### 3.1 Content Data Structure
```json
// src/data/content.json
[
  {
    "id": "climate-tipping-2024",
    "heading": {
      "title": "Arctic Ice Sheet Reaches Critical Tipping Point",
      "subtitle": "New satellite data reveals accelerated melting patterns",
      "context": "Climate Science"
    },
    "article": {
      "content": "Recent satellite observations...",
      "credibility": "high",
      "headline": "Unprecedented Arctic Changes",
      "excerpt": "Scientists report that Arctic ice melting has accelerated beyond previous models...",
      "thumbnail": "/images/arctic-ice.jpg"
    },
    "signals": {
      "truth": {
        "key": "truth",
        "name": "Truth Score",
        "currentValue": 92,
        "historicalData": [
          { "timestamp": "2024-01-20T10:00:00Z", "value": 85, "epochNumber": 1 },
          { "timestamp": "2024-01-20T14:00:00Z", "value": 88, "epochNumber": 2 },
          { "timestamp": "2024-01-20するT18:00:00Z", "value": 91, "epochNumber": 3 },
          { "timestamp": "2024-01-20T22:00:00Z", "value": 92, "epochNumber": 4 }
        ],
        "metadata": {
          "contributors": 234,
          "lastUpdated": "2024-01-20T22:00:00Z",
          "stake": 15420,
          "volatility": 0.12
        }
      },
      "relevance": {
        "key": "relevance",
        "name": "Relevance",
        "currentValue": 94,
        "historicalData": [
          { "timestamp": "2024-01-20T10:00:00Z", "value": 78 },
          { "timestamp": "2024-01-20T14:00:00Z", "value": 85 },
          { "timestamp": "2024-01-20T18:00:00Z", "value": 92 },
          { "timestamp": "2024-01-20T22:00:00Z", "value": 94 }
        ],
        "metadata": {
          "contributors": 456,
          "lastUpdated": "2024-01-20T22:00:00Z",
          "stake": 23100
        }
      },
      "informativeness": {
        "key": "informativeness",
        "name": "Informativeness",
        "currentValue": 88,
        "historicalData": [
          { "timestamp": "2024-01-20T10:00:00Z", "value": 82 },
          { "timestamp": "2024-01-20T18:00:00Z", "value": 88 }
        ],
        "metadata": {
          "contributors": 123,
          "lastUpdated": "2024-01-20T18:00:00Z"
        }
      },
      "breaking_news": {
        "key": "breaking_news",
        "name": "Breaking News",
        "currentValue": 76,
        "historicalData": [
          { "timestamp": "2024-01-20T10:00:00Z", "value": 95 },
          { "timestamp": "2024-01-20T14:00:00Z", "value": 88 },
          { "timestamp": "2024-01-20T18:00:00Z", "value": 76 }
        ],
        "metadata": {
          "contributors": 89,
          "lastUpdated": "2024-01-20T18:00:00Z"
        }
      },
      "scientific_accuracy": {
        "key": "scientific_accuracy",
        "name": "Scientific Accuracy",
        "currentValue": 91,
        "historicalData": [
          { "timestamp": "2024-01-20T10:00:00Z", "value": 89 },
          { "timestamp": "2024-01-20T18:00:00Z", "value": 91 }
        ],
        "metadata": {
          "contributors": 45,
          "lastUpdated": "2024-01-20T18:00:00Z"
        }
      },
      "global_impact": {
        "key": "global_impact",
        "name": "Global Impact",
        "currentValue": 95,
        "historicalData": [
          { "timestamp": "2024-01-20T10:00:00Z", "value": 93 },
          { "timestamp": "2024-01-20T18:00:00Z", "value": 95 }
        ],
        "metadata": {
          "contributors": 178,
          "lastUpdated": "2024-01-20T18:00:00Z"
        }
      },
      "actionability": {
        "key": "actionability",
        "name": "Actionability",
        "currentValue": 62,
        "historicalData": [
          { "timestamp": "2024-01-20T10:00:00Z", "value": 58 },
          { "timestamp": "2024-01-20T18:00:00Z", "value": 62 }
        ],
        "metadata": {
          "contributors": 67,
          "lastUpdated": "2024-01-20T18:00:00Z"
        }
      },
      "controversy": {
        "key": "controversy",
        "name": "Controversy Level",
        "currentValue": 43,
        "historicalData": [
          { "timestamp": "2024-01-20T10:00:00Z", "value": 35 },
          { "timestamp": "2024-01-20T18:00:00Z", "value": 43 }
        ],
        "metadata": {
          "contributors": 234,
          "lastUpdated": "2024-01-20T18:00:00Z"
        }
      },
      "source_credibility": {
        "key": "source_credibility",
        "name": "Source Credibility",
        "currentValue": 88,
        "historicalData": [
          { "timestamp": "2024-01-20T10:00:00Z", "value": 88 }
        ],
        "metadata": {
          "contributors": 12,
          "lastUpdated": "2024-01-20T10:00:00Z"
        }
      },
      "emotional_impact": {
        "key": "emotional_impact",
        "name": "Emotional Impact",
        "currentValue": 71,
        "historicalData": [
          { "timestamp": "2024-01-20T10:00:00Z", "value": 68 },
          { "timestamp": "2024-01-20T18:00:00Z", "value": 71 }
        ],
        "metadata": {
          "contributors": 445,
          "lastUpdated": "2024-01-20T18:00:00Z"
        }
      },
      "technical_depth": {
        "key": "technical_depth", 
        "name": "Technical Depth",
        "currentValue": 79,
        "historicalData": [
          { "timestamp": "2024-01-20T10:00:00Z", "value": 79 }
        ],
        "metadata": {
          "contributors": 34,
          "lastUpdated": "2024-01-20T10:00:00Z"
        }
      },
      "virality_potential": {
        "key": "virality_potential",
        "name": "Virality Potential",
        "currentValue": 67,
        "historicalData": [
          { "timestamp": "2024-01-20T10:00:00Z", "value": 45 },
          { "timestamp": "2024-01-20T18:00:00Z", "value": 67 }
        ],
        "metadata": {
          "contributors": 123,
          "lastUpdated": "2024-01-20T18:00:00Z"
        }
      }
    },
    "isPremier": true,
    "createdAt": "2024-01-20T10:00:00Z",
    "updatedAt": "2024-01-20T22:00:00Z",
    "status": "active"
  }
]
```

### 3.2 Algorithms Data Structure
```json
// src/data/algorithms.json
[
  {
    "id": "balanced-discovery",
    "name": "Balanced Discovery",
    "description": "Equal weight to truth, relevance, and informativeness",
    "type": "preset",
    "weights": {
      "truth": 33,
      "relevance": 33,
      "informativeness": 34,
      "breaking_news": 20,
      "scientific_accuracy": 25,
      "global_impact": 20,
      "actionability": 15,
      "controversy": 10,
      "source_credibility": 25,
      "emotional_impact": 15,
      "technical_depth": 20,
      "virality_potential": 10
    },
    "popularity": 1523,
    "performance": 82,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-20T00:00:00Z"
  },
  {
    "id": "truth-seeker",
    "name": "Truth Seeker",
    "description": "Prioritizes factual accuracy and credibility",
    "type": "preset",
    "weights": {
      "truth": 100,
      "relevance": 20,
      "informativeness": 40,
      "breaking_news": 10,
      "scientific_accuracy": 90,
      "global_impact": 15,
      "actionability": 20,
      "controversy": 5,
      "source_credibility": 95,
      "emotional_impact": 5,
      "technical_depth": 60,
      "virality_potential": 5
    },
    "popularity": 892,
    "performance": 78,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-20T00:00:00Z"
  },
  {
    "id": "breaking-news",
    "name": "Breaking News",
    "description": "Focus on recent, high-impact developments",
    "type": "preset",
    "weights": {
      "truth": 40,
      "relevance": 90,
      "informativeness": 30,
      "breaking_news": 100,
      "scientific_accuracy": 20,
      "global_impact": 80,
      "actionability": 40,
      "controversy": 30,
      "source_credibility": 40,
      "emotional_impact": 50,
      "technical_depth": 10,
      "virality_potential": 70
    },
    "popularity": 2341,
    "performance": 71,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-20T00:00:00Z"
  },
  {
    "id": "deep-analysis",
    "name": "Deep Analysis",
    "description": "Prioritizes comprehensive, technical content",
    "type": "preset",
    "weights": {
      "truth": 70,
      "relevance": 40,
      "informativeness": 100,
      "breaking_news": 10,
      "scientific_accuracy": 80,
      "global_impact": 30,
      "actionability": 50,
      "controversy": 15,
      "source_credibility": 70,
      "emotional_impact": 10,
      "technical_depth": 100,
      "virality_potential": 5
    },
    "popularity": 432,
    "performance": 86,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-20T00:00:00Z"
  }
]
```

### 3.3 Signal Configuration
```json
// src/data/signals-config.json
{
  "signals": [
    {
      "key": "truth",
      "name": "Truth Score",
      "description": "Factual accuracy and verifiability of claims",
      "category": "accuracy",
      "defaultWeight": 50,
      "color": "#0C1D51",
      "icon": "Shield"
    },
    {
      "key": "relevance",
      "name": "Relevance",
      "description": "Current importance and timeliness",
      "category": "impact",
      "defaultWeight": 50,
      "color": "#EA900E",
      "icon": "Target"
    },
    {
      "key": "informativeness",
      "name": "Informativeness",
      "description": "Novel information and learning value",
      "category": "quality",
      "defaultWeight": 50,
      "color": "#B9D9EB",
      "icon": "Brain"
    },
    {
      "key": "breaking_news",
      "name": "Breaking News",
      "description": "Recency and urgency of information",
      "category": "temporal",
      "defaultWeight": 30,
      "color": "#FF6B6B",
      "icon": "Zap"
    },
    {
      "key": "scientific_accuracy",
      "name": "Scientific Accuracy",
      "description": "Adherence to scientific method and peer review",
      "category": "accuracy",
      "defaultWeight": 40,
      "color": "#4ECDC4",
      "icon": "Microscope"
    },
    {
      "key": "global_impact",
      "name": "Global Impact",
      "description": "Worldwide significance and reach",
      "category": "impact",
      "defaultWeight": 35,
      "color": "#95E77E",
      "icon": "Globe"
    },
    {
      "key": "actionability",
      "name": "Actionability",
      "description": "Practical steps and implementable insights",
      "category": "quality",
      "defaultWeight": 30,
      "color": "#FFD93D",
      "icon": "CheckSquare"
    },
    {
      "key": "controversy",
      "name": "Controversy Level",
      "description": "Degree of debate and disagreement",
      "category": "engagement",
      "defaultWeight": 20,
      "color": "#FF8C42",
      "icon": "MessageSquare"
    },
    {
      "key": "source_credibility",
      "name": "Source Credibility",
      "description": "Reputation and track record of sources",
      "category": "accuracy",
      "defaultWeight": 45,
      "color": "#6C5CE7",
      "icon": "Award"
    },
    {
      "key": "emotional_impact",
      "name": "Emotional Impact",
      "description": "Emotional resonance and human interest",
      "category": "engagement",
      "defaultWeight": 25,
      "color": "#FD79A8",
      "icon": "Heart"
    },
    {
      "key": "technical_depth",
      "name": "Technical Depth",
      "description": "Level of technical detail and expertise",
      "category": "quality",
      "defaultWeight": 35,
      "color": "#00B894",
      "icon": "Code"
    },
    {
      "key": "virality_potential",
      "name": "Virality Potential",
      "description": "Likelihood of widespread sharing",
      "category": "engagement",
      "defaultWeight": 20,
      "color": "#FDCB6E",
      "icon": "Share2"
    }
  ],
  "categories": {
    "accuracy": {
      "name": "Accuracy & Truth",
      "description": "Signals related to factual correctness",
      "color": "#0C1D51"
    },
    "impact": {
      "name": "Impact & Relevance",
      "description": "Signals related to importance and significance",
      "color": "#EA900E"
    },
    "quality": {
      "name": "Content Quality",
      "description": "Signals related to depth and clarity",
      "color": "#B9D9EB"
    },
    "temporal": {
      "name": "Time Sensitivity",
      "description": "Signals related to recency and timing",
      "color": "#FF6B6B"
    },
    "engagement": {
      "name": "Engagement",
      "description": "Signals related to user interaction and sharing",
      "color": "#FFD93D"
    }
  }
}
```

---

## 4. Migration Script

Create a migration script to convert existing data:

```javascript
// scripts/migrate-data.js

const fs = require('fs');
const path = require('path');

// Load old data
const beliefsData = require('../src/data/beliefs.json');

// Signal mapping for categories
const CATEGORY_TO_SIGNAL_VALUE = {
  'technology': { 'tech_focus': 100 },
  'politics': { 'political_relevance': 100 },
  'science': { 'scientific_accuracy': 85, 'technical_depth': 80 },
  'health': { 'health_impact': 100 },
  'finance': { 'financial_relevance': 100 },
  'sports': { 'sports_coverage': 100 },
  'entertainment': { 'entertainment_value': 100 }
};

// Generate historical data points
function generateHistoricalData(currentValue, numPoints = 4) {
  const data = [];
  const now = new Date();
  
  for (let i = numPoints - 1; i >= 0; i--) {
    const timestamp = new Date(now - (i * 4 * 60 * 60 * 1000)); // 4 hours apart
    const variance = (Math.random() - 0.5) * 20; // ±10 variance
    const value = Math.max(0, Math.min(100, currentValue + variance));
    
    data.push({
      timestamp: timestamp.toISOString(),
      value: Math.round(value),
      epochNumber: numPoints - i
    });
  }
  
  // Ensure last value matches current
  data[data.length - 1].value = currentValue;
  
  return data;
}

// Generate additional signals for content
function generateAdditionalSignals(belief) {
  const signals = {};
  
  // Core signals from objectRankingScores
  if (belief.objectRankingScores) {
    signals.truth = {
      key: 'truth',
      name: 'Truth Score',
      currentValue: belief.objectRankingScores.truth || 75,
      historicalData: generateHistoricalData(belief.objectRankingScores.truth || 75),
      metadata: {
        contributors: Math.floor(Math.random() * 500) + 50,
        lastUpdated: new Date().toISOString(),
        stake: Math.floor(Math.random() * 50000) + 5000
      }
    };
    
    signals.relevance = {
      key: 'relevance',
      name: 'Relevance',
      currentValue: belief.objectRankingScores.relevance || 70,
      historicalData: generateHistoricalData(belief.objectRankingScores.relevance || 70),
      metadata: {
        contributors: Math.floor(Math.random() * 500) + 50,
        lastUpdated: new Date().toISOString(),
        stake: Math.floor(Math.random() * 50000) + 5000
      }
    };
    
    signals.informativeness = {
      key: 'informativeness',
      name: 'Informativeness',
      currentValue: belief.objectRankingScores.informativeness || 65,
      historicalData: generateHistoricalData(belief.objectRankingScores.informativeness || 65),
      metadata: {
        contributors: Math.floor(Math.random() * 500) + 50,
        lastUpdated: new Date().toISOString()
      }
    };
  }
  
  // Generate 8-12 additional signals
  const additionalSignalKeys = [
    'breaking_news',
    'scientific_accuracy',
    'global_impact',
    'actionability',
    'controversy',
    'source_credibility',
    'emotional_impact',
    'technical_depth',
    'virality_potential'
  ];
  
  additionalSignalKeys.forEach(key => {
    // Generate realistic values based on content type
    let value = Math.floor(Math.random() * 40) + 40; // 40-80 range
    
    // Adjust based on category
    if (belief.category === 'science' && key === 'scientific_accuracy') {
      value = Math.floor(Math.random() * 20) + 75; // 75-95 for science content
    }
    if (belief.category === 'politics' && key === 'controversy') {
      value = Math.floor(Math.random() * 30) + 60; // 60-90 for political content
    }
    
    signals[key] = {
      key,
      name: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      currentValue: value,
      historicalData: generateHistoricalData(value, 3),
      metadata: {
        contributors: Math.floor(Math.random() * 200) + 10,
        lastUpdated: new Date().toISOString()
      }
    };
  });
  
  return signals;
}

// Convert belief to content
function convertBeliefToContent(belief) {
  return {
    id: belief.id,
    heading: belief.heading,
    article: belief.article,
    signals: generateAdditionalSignals(belief),
    isPremier: belief.isPremier || false,
    createdAt: belief.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: belief.status || 'active'
  };
}

// Perform migration
const contentData = beliefsData.map(convertBeliefToContent);

// Save new content data
fs.writeFileSync(
  path.join(__dirname, '../src/data/content.json'),
  JSON.stringify(contentData, null, 2)
);

// Save backup of original data
fs.writeFileSync(
  path.join(__dirname, '../src/data/beliefs.backup.json'),
  JSON.stringify(beliefsData, null, 2)
);

console.log(`✅ Migrated ${contentData.length} beliefs to content format`);
console.log('✅ Backup saved to beliefs.backup.json');
```

---

## 5. Code Updates Required

### 5.1 Update Data Access Layer

```typescript
// src/lib/data.ts

import contentData from '@/data/content.json';
import algorithmsData from '@/data/algorithms.json';
import signalsConfig from '@/data/signals-config.json';

// Rename functions but keep old names as aliases
export const getAllContent = (): Content[] => {
  return contentData as Content[];
};
export const getAllBeliefs = getAllContent; // Backward compatibility

export const getContentById = (id: string): Content | null => {
  return contentData.find(c => c.id === id) || null;
};
export const getBeliefById = getContentById; // Backward compatibility

export const getAllAlgorithms = (): Algorithm[] => {
  return algorithmsData as Algorithm[];
};

export const getAlgorithmById = (id: string): Algorithm | null => {
  return algorithmsData.find(a => a.id === id) || null;
};

export const getSignalConfig = (signalKey: string) => {
  return signalsConfig.signals.find(s => s.key === signalKey);
};
```

### 5.2 Create Algorithm Engine

```typescript
// src/lib/algorithmEngine.ts

import { Content, Algorithm } from '@/types/belief.types';

export function calculateContentScore(
  content: Content,
  algorithm: Algorithm
): number {
  let totalScore = 0;
  let totalWeight = 0;
  
  // Calculate weighted average of signals
  Object.entries(algorithm.weights).forEach(([signalKey, weight]) => {
    const signal = content.signals[signalKey];
    if (signal) {
      totalScore += signal.currentValue * weight;
      totalWeight += weight;
    }
  });
  
  // Return normalized score (0-100)
  return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
}

export function rankContent(
  contentList: Content[],
  algorithm: Algorithm
): Content[] {
  // Calculate scores and sort
  const scoredContent = contentList.map(content => ({
    content,
    score: calculateContentScore(content, algorithm)
  }));
  
  // Sort by score (highest first)
  scoredContent.sort((a, b) => b.score - a.score);
  
  return scoredContent.map(item => item.content);
}

export function explainRanking(
  content: Content,
  algorithm: Algorithm
): { signal: string; contribution: number }[] {
  const explanations = [];
  
  Object.entries(algorithm.weights).forEach(([signalKey, weight]) => {
    const signal = content.signals[signalKey];
    if (signal && weight > 0) {
      explanations.push({
        signal: signal.name,
        contribution: Math.round((signal.currentValue * weight) / 100)
      });
    }
  });
  
  // Sort by contribution
  explanations.sort((a, b) => b.contribution - a.contribution);
  
  return explanations;
}
```

### 5.3 Update Context Providers

```typescript
// src/contexts/FeedContext.tsx

import { createContext, useContext, useState, useMemo } from 'react';
import { Content, Algorithm } from '@/types/belief.types';
import { getAllContent, getAllAlgorithms } from '@/lib/data';
import { rankContent } from '@/lib/algorithmEngine';

interface FeedContextType {
  content: Content[];
  rankedContent: Content[];
  selectedAlgorithm: Algorithm | null;
  customWeights: { [key: string]: number } | null;
  
  setSelectedAlgorithm: (algorithm: Algorithm) => void;
  setCustomWeights: (weights: { [key: string]: number }) => void;
}

export function FeedProvider({ children }) {
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<Algorithm | null>(
    getAllAlgorithms()[0] || null
  );
  const [customWeights, setCustomWeights] = useState(null);
  
  const content = useMemo(() => getAllContent(), []);
  
  const rankedContent = useMemo(() => {
    if (!selectedAlgorithm) return content;
    
    // Use custom weights if set, otherwise use algorithm weights
    const algorithm = customWeights 
      ? { ...selectedAlgorithm, weights: customWeights }
      : selectedAlgorithm;
    
    return rankContent(content, algorithm);
  }, [content, selectedAlgorithm, customWeights]);
  
  // ... rest of context implementation
}
```

---

## 6. Component Updates

### 6.1 Update Type Imports
Replace all instances of:
```typescript
import { Belief } from '@/types/belief.types';
```
With:
```typescript
import { Content, Signal } from '@/types/belief.types';
// Use Content internally, Belief is kept as alias
```

### 6.2 Update Property Access
Replace all instances of:
```typescript
belief.objectRankingScores.truth
belief.objectRankingScores.relevance
belief.objectRankingScores.informativeness
```
With:
```typescript
content.signals.truth?.currentValue || 0
content.signals.relevance?.currentValue || 0
content.signals.informativeness?.currentValue || 0
```

### 6.3 Update IntelligenceEvolution Component
The component should now:
1. Display 8-15 signal graphs
2. Read historical data from `signal.historicalData`
3. Show current value from `signal.currentValue`
4. Use signal colors from config

---

## 7. Testing Checklist

After migration, verify:

- [ ] All content items have 8-15 signals
- [ ] Historical data generates correctly
- [ ] Feed displays with new signal structure
- [ ] Algorithm ranking works correctly
- [ ] Signal contributions can be submitted
- [ ] Graphs show historical signal evolution
- [ ] No console errors
- [ ] Backward compatibility maintained
- [ ] Data migration script completes successfully

---

## 8. Rollback Plan

If issues arise:
1. Restore `beliefs.json` from `beliefs.backup.json`
2. Revert type changes in `belief.types.ts`
3. Remove new algorithm files
4. Restore original component code from git

---

## Notes for Implementation

1. **Start with data migration** - Run the script first to generate new data structure
2. **Update types** - Modify interfaces to support new structure
3. **Update data layer** - Modify data access functions
4. **Update components gradually** - Start with feed, then detail page
5. **Test thoroughly** - Each component as you update it
6. **Keep backward compatibility** - Use aliases and fallbacks during transition

This migration maintains backward compatibility while enabling the new multi-signal, algorithm-driven content ranking system.