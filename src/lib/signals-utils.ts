import { Signal, SignalDataPoint, SignalCollection } from '@/types/belief.types';
import { Content } from '@/types/content.types';

// Define additional signals that should be present on all content
const ADDITIONAL_SIGNAL_CONFIGS = [
  { key: 'credibility', name: 'Credibility', baseValue: 75 },
  { key: 'urgency', name: 'Urgency', baseValue: 60 },
  { key: 'consensus', name: 'Consensus', baseValue: 70 },
  { key: 'bias_resistance', name: 'Bias Resistance', baseValue: 65 },
  { key: 'emotional_impact', name: 'Emotional Impact', baseValue: 45 },
  { key: 'source_diversity', name: 'Source Diversity', baseValue: 80 },
  { key: 'verifiability', name: 'Verifiability', baseValue: 72 },
  { key: 'expertise_required', name: 'Expertise Required', baseValue: 55 },
  { key: 'controversy_level', name: 'Controversy Level', baseValue: 40 },
  { key: 'time_sensitivity', name: 'Time Sensitivity', baseValue: 68 },
  { key: 'geographical_relevance', name: 'Geographical Relevance', baseValue: 85 },
  { key: 'economic_impact', name: 'Economic Impact', baseValue: 70 },
];

// Generate historical data for a signal
const generateSignalHistory = (baseValue: number, dataPoints: number = 12): SignalDataPoint[] => {
  const history: SignalDataPoint[] = [];
  const currentDate = new Date();
  let currentValue = baseValue;
  
  // Work backwards from current time
  for (let i = dataPoints - 1; i >= 0; i--) {
    const timestamp = new Date(currentDate);
    timestamp.setHours(timestamp.getHours() - (i * 4)); // Every 4 hours
    
    // Add some realistic variation
    const variation = (Math.random() - 0.5) * 15; // ±7.5% variation
    currentValue = Math.max(0, Math.min(100, baseValue + variation));
    
    history.push({
      timestamp: timestamp.toISOString(),
      value: Math.round(currentValue),
      epochNumber: dataPoints - i
    });
  }
  
  // Ensure the last value matches the current value
  if (history.length > 0) {
    history[history.length - 1].value = baseValue;
  }
  
  return history;
};

// Ensure content has all required signals
export const ensureContentSignals = (content: Content): SignalCollection => {
  const signals: SignalCollection = { ...content.signals };
  
  // Add any missing standard signals
  if (!signals.truth) {
    signals.truth = {
      key: 'truth',
      name: 'Truth Score',
      currentValue: 75,
      historicalData: generateSignalHistory(75),
      metadata: {
        contributors: Math.floor(Math.random() * 500) + 100,
        lastUpdated: new Date().toISOString(),
        stake: Math.floor(Math.random() * 20000) + 5000,
        volatility: Math.random() * 0.3
      }
    };
  }
  
  if (!signals.relevance) {
    signals.relevance = {
      key: 'relevance',
      name: 'Relevance',
      currentValue: 80,
      historicalData: generateSignalHistory(80),
      metadata: {
        contributors: Math.floor(Math.random() * 500) + 100,
        lastUpdated: new Date().toISOString(),
        stake: Math.floor(Math.random() * 20000) + 5000,
        volatility: Math.random() * 0.3
      }
    };
  }
  
  if (!signals.informativeness) {
    signals.informativeness = {
      key: 'informativeness',
      name: 'Informativeness',
      currentValue: 70,
      historicalData: generateSignalHistory(70),
      metadata: {
        contributors: Math.floor(Math.random() * 500) + 100,
        lastUpdated: new Date().toISOString(),
        stake: Math.floor(Math.random() * 20000) + 5000
      }
    };
  }
  
  // Add additional signals based on content context
  ADDITIONAL_SIGNAL_CONFIGS.forEach(config => {
    if (!signals[config.key]) {
      // Vary base value based on content
      const contentVariation = content.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 30 - 15;
      const adjustedValue = Math.max(0, Math.min(100, config.baseValue + contentVariation));
      
      signals[config.key] = {
        key: config.key,
        name: config.name,
        currentValue: adjustedValue,
        historicalData: generateSignalHistory(adjustedValue),
        metadata: {
          contributors: Math.floor(Math.random() * 300) + 50,
          lastUpdated: new Date().toISOString(),
          stake: Math.floor(Math.random() * 15000) + 2000,
          volatility: Math.random() * 0.4
        }
      };
    }
  });
  
  return signals;
};

// Get the last value from a signal's historical data
export const getSignalLastValue = (signal: Signal): number => {
  if (signal.historicalData && signal.historicalData.length > 0) {
    return signal.historicalData[signal.historicalData.length - 1].value;
  }
  return signal.currentValue;
};

// Get signal color based on its key
export const getSignalColor = (key: string, isDarkMode: boolean): string => {
  const colors: { [key: string]: { light: string; dark: string } } = {
    truth: { light: '#0C1D51', dark: '#B9D9EB' },
    relevance: { light: '#EA900E', dark: '#EA900E' },
    informativeness: { light: '#8B5CF6', dark: '#A78BFA' },
    credibility: { light: '#10B981', dark: '#34D399' },
    urgency: { light: '#EF4444', dark: '#F87171' },
    consensus: { light: '#3B82F6', dark: '#60A5FA' },
    bias_resistance: { light: '#6366F1', dark: '#818CF8' },
    emotional_impact: { light: '#EC4899', dark: '#F472B6' },
    source_diversity: { light: '#14B8A6', dark: '#2DD4BF' },
    verifiability: { light: '#8B5CF6', dark: '#A78BFA' },
    expertise_required: { light: '#F59E0B', dark: '#FBBf24' },
    controversy_level: { light: '#DC2626', dark: '#EF4444' },
    time_sensitivity: { light: '#7C3AED', dark: '#A78BFA' },
    geographical_relevance: { light: '#059669', dark: '#10B981' },
    economic_impact: { light: '#0891B2', dark: '#06B6D4' },
    global_impact: { light: '#991B1B', dark: '#DC2626' },
    category: { light: '#6B7280', dark: '#9CA3AF' }
  };
  
  const colorConfig = colors[key] || { light: '#6B7280', dark: '#9CA3AF' };
  return isDarkMode ? colorConfig.dark : colorConfig.light;
};

// Get icon for signal based on its key
export const getSignalIcon = (key: string) => {
  // This will be imported from lucide-react in the component
  const iconMap: { [key: string]: string } = {
    truth: 'Target',
    relevance: 'Brain',
    informativeness: 'TrendingUp',
    credibility: 'Shield',
    urgency: 'AlertCircle',
    consensus: 'Users',
    bias_resistance: 'Scale',
    emotional_impact: 'Heart',
    source_diversity: 'Network',
    verifiability: 'CheckCircle',
    expertise_required: 'GraduationCap',
    controversy_level: 'Zap',
    time_sensitivity: 'Clock',
    geographical_relevance: 'Globe',
    economic_impact: 'DollarSign',
    global_impact: 'Earth',
    category: 'Tag'
  };
  
  return iconMap[key] || 'Activity';
};