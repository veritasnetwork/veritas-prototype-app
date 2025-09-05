// Signal generation utilities
import { SignalCollection, Signal } from '@/types/belief.types';

// Generate a single signal with historical data
const generateSignal = (value: number, key: string, name: string): Signal => {
  const historicalData = [];
  const currentDate = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(currentDate);
    date.setHours(date.getHours() - (i * 4));
    historicalData.push({
      timestamp: date.toISOString(),
      value: Math.max(0, Math.min(100, value + (Math.random() - 0.5) * 10)),
      epochNumber: 12 - i
    });
  }

  return {
    key,
    name,
    currentValue: value,
    historicalData,
    metadata: {
      contributors: Math.floor(Math.random() * 500) + 100,
      lastUpdated: new Date().toISOString(),
      stake: Math.floor(Math.random() * 20000) + 5000,
      volatility: Math.random() * 0.3
    }
  };
};

// Generate comprehensive signal collection for content
export const generateSignalCollection = (
  truthValue: number,
  relevanceValue: number,
  informativenessValue: number
): SignalCollection => {
  return {
    truth: generateSignal(truthValue, 'truth', 'Truth Score'),
    relevance: generateSignal(relevanceValue, 'relevance', 'Relevance'),
    informativeness: generateSignal(informativenessValue, 'informativeness', 'Informativeness'),
    breaking_news: generateSignal(55 + Math.floor(Math.random() * 30) - 15, 'breaking_news', 'Breaking News'),
    scientific_accuracy: generateSignal(70 + Math.floor(Math.random() * 20) - 10, 'scientific_accuracy', 'Scientific Accuracy'),
    global_impact: generateSignal(60 + Math.floor(Math.random() * 25) - 12, 'global_impact', 'Global Impact'),
    actionability: generateSignal(65 + Math.floor(Math.random() * 20) - 10, 'actionability', 'Actionability'),
    controversy: generateSignal(40 + Math.floor(Math.random() * 30) - 15, 'controversy', 'Controversy'),
    source_credibility: generateSignal(75 + Math.floor(Math.random() * 15) - 7, 'source_credibility', 'Source Credibility'),
    emotional_impact: generateSignal(50 + Math.floor(Math.random() * 25) - 12, 'emotional_impact', 'Emotional Impact'),
    technical_depth: generateSignal(68 + Math.floor(Math.random() * 20) - 10, 'technical_depth', 'Technical Depth'),
    virality_potential: generateSignal(45 + Math.floor(Math.random() * 30) - 15, 'virality_potential', 'Virality Potential'),
    local_relevance: generateSignal(58 + Math.floor(Math.random() * 25) - 12, 'local_relevance', 'Local Relevance'),
    educational_value: generateSignal(73 + Math.floor(Math.random() * 18) - 9, 'educational_value', 'Educational Value'),
    future_impact: generateSignal(62 + Math.floor(Math.random() * 22) - 11, 'future_impact', 'Future Impact'),
    verifiability: generateSignal(72 + Math.floor(Math.random() * 20) - 10, 'verifiability', 'Verifiability')
  };
};