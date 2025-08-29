import { Content } from '@/types/belief.types';
import { Algorithm } from '@/types/algorithm.types';

/**
 * Calculate a weighted score for a piece of content based on an algorithm
 */
export function calculateContentScore(
  content: Content,
  algorithm: Algorithm
): number {
  let totalScore = 0;
  let totalWeight = 0;
  
  // Calculate weighted average of signals
  Object.entries(algorithm.weights).forEach(([signalKey, weight]) => {
    const signal = content.signals[signalKey];
    if (signal && weight > 0) {
      totalScore += signal.currentValue * weight;
      totalWeight += weight;
    }
  });
  
  // Return normalized score (0-100)
  return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
}

/**
 * Rank a list of content based on an algorithm
 */
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

/**
 * Explain how a piece of content ranks based on an algorithm
 */
export function explainRanking(
  content: Content,
  algorithm: Algorithm
): { signal: string; name: string; contribution: number; weight: number; value: number }[] {
  const explanations: { 
    signal: string; 
    name: string; 
    contribution: number; 
    weight: number;
    value: number;
  }[] = [];
  
  let totalWeight = 0;
  
  // Calculate total weight for normalization
  Object.entries(algorithm.weights).forEach(([signalKey, weight]) => {
    const signal = content.signals[signalKey];
    if (signal && weight > 0) {
      totalWeight += weight;
    }
  });
  
  Object.entries(algorithm.weights).forEach(([signalKey, weight]) => {
    const signal = content.signals[signalKey];
    if (signal && weight > 0) {
      explanations.push({
        signal: signalKey,
        name: signal.name,
        contribution: Math.round((signal.currentValue * weight) / totalWeight),
        weight: weight,
        value: signal.currentValue
      });
    }
  });
  
  // Sort by contribution
  explanations.sort((a, b) => b.contribution - a.contribution);
  
  return explanations;
}

/**
 * Get the top signals contributing to a content's ranking
 */
export function getTopContributingSignals(
  content: Content,
  algorithm: Algorithm,
  limit: number = 3
): string[] {
  const explanations = explainRanking(content, algorithm);
  return explanations.slice(0, limit).map(e => e.signal);
}

/**
 * Create a custom algorithm from user-defined weights
 */
export function createCustomAlgorithm(
  weights: { [signalKey: string]: number },
  name: string = 'Custom Algorithm',
  description: string = 'User-defined algorithm'
): Algorithm {
  return {
    id: `custom-${Date.now()}`,
    name,
    description,
    type: 'user',
    weights,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Normalize algorithm weights to sum to 100
 */
export function normalizeWeights(weights: { [key: string]: number }): { [key: string]: number } {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (total === 0) return weights;
  
  const normalized: { [key: string]: number } = {};
  Object.entries(weights).forEach(([key, weight]) => {
    normalized[key] = Math.round((weight / total) * 100);
  });
  
  return normalized;
}

/**
 * Combine multiple algorithms with weights
 */
export function combineAlgorithms(
  algorithms: { algorithm: Algorithm; weight: number }[]
): Algorithm {
  const combinedWeights: { [key: string]: number } = {};
  
  algorithms.forEach(({ algorithm, weight }) => {
    Object.entries(algorithm.weights).forEach(([signalKey, signalWeight]) => {
      if (!combinedWeights[signalKey]) {
        combinedWeights[signalKey] = 0;
      }
      combinedWeights[signalKey] += signalWeight * weight;
    });
  });
  
  return createCustomAlgorithm(
    normalizeWeights(combinedWeights),
    'Combined Algorithm',
    'Combination of multiple algorithms'
  );
}

/**
 * Filter content by minimum signal thresholds
 */
export function filterBySignalThresholds(
  contentList: Content[],
  thresholds: { [signalKey: string]: number }
): Content[] {
  return contentList.filter(content => {
    for (const [signalKey, minValue] of Object.entries(thresholds)) {
      const signal = content.signals[signalKey];
      if (!signal || signal.currentValue < minValue) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Get content diversity score (how varied the top signals are)
 */
export function getContentDiversity(contentList: Content[], algorithm: Algorithm): number {
  if (contentList.length === 0) return 0;
  
  const signalCounts: { [key: string]: number } = {};
  
  contentList.forEach(content => {
    const topSignals = getTopContributingSignals(content, algorithm, 1);
    topSignals.forEach(signal => {
      signalCounts[signal] = (signalCounts[signal] || 0) + 1;
    });
  });
  
  // Calculate entropy as diversity measure
  const total = contentList.length;
  let entropy = 0;
  
  Object.values(signalCounts).forEach(count => {
    const probability = count / total;
    if (probability > 0) {
      entropy -= probability * Math.log2(probability);
    }
  });
  
  // Normalize to 0-100
  const maxEntropy = Math.log2(Object.keys(signalCounts).length);
  return maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) : 0;
}

/**
 * Recommend algorithms based on user preferences
 */
export function recommendAlgorithms(
  preferredSignals: string[],
  availableAlgorithms: Algorithm[]
): Algorithm[] {
  const scored = availableAlgorithms.map(algorithm => {
    let score = 0;
    preferredSignals.forEach(signal => {
      score += algorithm.weights[signal] || 0;
    });
    return { algorithm, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.algorithm);
}

/**
 * Calculate algorithm similarity
 */
export function calculateAlgorithmSimilarity(algo1: Algorithm, algo2: Algorithm): number {
  const allSignals = new Set([
    ...Object.keys(algo1.weights),
    ...Object.keys(algo2.weights)
  ]);
  
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  allSignals.forEach(signal => {
    const weight1 = algo1.weights[signal] || 0;
    const weight2 = algo2.weights[signal] || 0;
    
    dotProduct += weight1 * weight2;
    magnitude1 += weight1 * weight1;
    magnitude2 += weight2 * weight2;
  });
  
  const denominator = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
  if (denominator === 0) return 0;
  
  // Cosine similarity (0-100)
  return Math.round((dotProduct / denominator) * 100);
}