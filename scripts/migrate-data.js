const fs = require('fs');
const path = require('path');

// Load old data
const beliefsData = require('../src/data/beliefs.json');

// Signal mapping for categories
const CATEGORY_TO_SIGNAL_BOOST = {
  'technology': { 'technical_depth': 15, 'virality_potential': 10 },
  'politics': { 'controversy': 20, 'global_impact': 15 },
  'science': { 'scientific_accuracy': 15, 'technical_depth': 10 },
  'health': { 'actionability': 15, 'scientific_accuracy': 10 },
  'finance': { 'global_impact': 10, 'actionability': 15 },
  'sports': { 'emotional_impact': 15, 'virality_potential': 10 },
  'entertainment': { 'emotional_impact': 20, 'virality_potential': 15 },
  'environment': { 'global_impact': 20, 'scientific_accuracy': 15 },
  'climate': { 'global_impact': 25, 'scientific_accuracy': 20, 'actionability': 15 }
};

// Generate historical data points
function generateHistoricalData(currentValue, numPoints = 4, volatility = 0.15) {
  const data = [];
  const now = new Date();
  
  // Start from a reasonable base value
  let value = currentValue - (Math.random() * 20) + 10; // Start 10-30 points different
  value = Math.max(20, Math.min(100, value));
  
  for (let i = numPoints - 1; i >= 0; i--) {
    const timestamp = new Date(now - (i * 4 * 60 * 60 * 1000)); // 4 hours apart
    
    if (i === 0) {
      // Last value should match current
      value = currentValue;
    } else {
      // Gradual progression toward current value
      const targetDiff = currentValue - value;
      const stepSize = targetDiff / (i + 1);
      const variance = (Math.random() - 0.5) * 30 * volatility;
      value = value + stepSize + variance;
      value = Math.max(5, Math.min(100, value));
    }
    
    data.push({
      timestamp: timestamp.toISOString(),
      value: Math.round(value),
      epochNumber: numPoints - i
    });
  }
  
  return data;
}

// Generate additional signals for content
function generateSignalsForContent(belief) {
  const signals = {};
  
  // Core signals from objectRankingScores (always present)
  if (belief.objectRankingScores) {
    signals.truth = {
      key: 'truth',
      name: 'Truth Score',
      currentValue: belief.objectRankingScores.truth || 75,
      historicalData: generateHistoricalData(belief.objectRankingScores.truth || 75, 5, 0.1),
      metadata: {
        contributors: Math.floor(Math.random() * 300) + 100,
        lastUpdated: new Date().toISOString(),
        stake: Math.floor(Math.random() * 30000) + 10000,
        volatility: 0.12
      }
    };
    
    signals.relevance = {
      key: 'relevance',
      name: 'Relevance',
      currentValue: belief.objectRankingScores.relevance || 70,
      historicalData: generateHistoricalData(belief.objectRankingScores.relevance || 70, 5, 0.2),
      metadata: {
        contributors: Math.floor(Math.random() * 400) + 150,
        lastUpdated: new Date().toISOString(),
        stake: Math.floor(Math.random() * 35000) + 12000,
        volatility: 0.18
      }
    };
    
    signals.informativeness = {
      key: 'informativeness',
      name: 'Informativeness',
      currentValue: belief.objectRankingScores.informativeness || 65,
      historicalData: generateHistoricalData(belief.objectRankingScores.informativeness || 65, 4, 0.15),
      metadata: {
        contributors: Math.floor(Math.random() * 200) + 50,
        lastUpdated: new Date().toISOString(),
        stake: Math.floor(Math.random() * 20000) + 5000
      }
    };
  }
  
  // Generate 8-12 additional signals based on content characteristics
  const allPossibleSignals = [
    { key: 'breaking_news', name: 'Breaking News', baseRange: [30, 90], volatility: 0.25 },
    { key: 'scientific_accuracy', name: 'Scientific Accuracy', baseRange: [50, 95], volatility: 0.08 },
    { key: 'global_impact', name: 'Global Impact', baseRange: [40, 85], volatility: 0.15 },
    { key: 'actionability', name: 'Actionability', baseRange: [30, 75], volatility: 0.2 },
    { key: 'controversy', name: 'Controversy Level', baseRange: [15, 70], volatility: 0.3 },
    { key: 'source_credibility', name: 'Source Credibility', baseRange: [60, 95], volatility: 0.05 },
    { key: 'emotional_impact', name: 'Emotional Impact', baseRange: [25, 80], volatility: 0.22 },
    { key: 'technical_depth', name: 'Technical Depth', baseRange: [35, 85], volatility: 0.12 },
    { key: 'virality_potential', name: 'Virality Potential', baseRange: [20, 75], volatility: 0.35 },
    { key: 'local_relevance', name: 'Local Relevance', baseRange: [30, 70], volatility: 0.18 },
    { key: 'educational_value', name: 'Educational Value', baseRange: [40, 90], volatility: 0.1 },
    { key: 'future_impact', name: 'Future Impact', baseRange: [35, 80], volatility: 0.15 }
  ];
  
  // Determine how many additional signals (aim for 10-15 total)
  const targetSignalCount = Math.floor(Math.random() * 6) + 10; // 10-15 signals
  const additionalSignalsNeeded = Math.max(7, targetSignalCount - 3); // At least 7 more
  
  // Shuffle and select signals
  const shuffled = allPossibleSignals.sort(() => Math.random() - 0.5);
  const selectedSignals = shuffled.slice(0, additionalSignalsNeeded);
  
  selectedSignals.forEach(signalDef => {
    const { key, name, baseRange, volatility } = signalDef;
    
    // Generate realistic value based on content type and category
    let value = Math.floor(Math.random() * (baseRange[1] - baseRange[0]) + baseRange[0]);
    
    // Apply category-specific boosts
    const categoryBoosts = CATEGORY_TO_SIGNAL_BOOST[belief.category?.toLowerCase()];
    if (categoryBoosts && categoryBoosts[key]) {
      value = Math.min(100, value + categoryBoosts[key]);
    }
    
    // Adjust based on content characteristics
    if (belief.isPremier && ['breaking_news', 'global_impact', 'relevance'].includes(key)) {
      value = Math.min(100, value + 15);
    }
    
    // Special adjustments based on article credibility
    if (belief.article?.credibility === 'high' && key === 'source_credibility') {
      value = Math.max(75, value);
    }
    
    // Generate historical data points (3-5 points for additional signals)
    const numHistoricalPoints = Math.floor(Math.random() * 3) + 3;
    
    signals[key] = {
      key,
      name,
      currentValue: value,
      historicalData: generateHistoricalData(value, numHistoricalPoints, volatility),
      metadata: {
        contributors: Math.floor(Math.random() * 150) + 10,
        lastUpdated: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        stake: Math.random() > 0.5 ? Math.floor(Math.random() * 15000) + 1000 : undefined,
        volatility: Math.random() > 0.6 ? volatility : undefined
      }
    };
  });
  
  return signals;
}

// Convert belief to content
function convertBeliefToContent(belief, index) {
  const content = {
    id: belief.id,
    heading: belief.heading,
    article: belief.article,
    signals: generateSignalsForContent(belief),
    isPremier: belief.isPremier || false,
    createdAt: belief.createdAt || new Date(Date.now() - (20 - index) * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    status: belief.status === 'resolved' || belief.status === 'closed' ? 'resolved' : 'active'
  };
  
  // Log signal count for verification
  const signalCount = Object.keys(content.signals).length;
  console.log(`  - ${belief.id}: ${signalCount} signals`);
  
  return content;
}

// Perform migration
console.log('🔄 Starting migration...\n');
const contentData = beliefsData.map((belief, index) => convertBeliefToContent(belief, index));

// Save new content data
const contentPath = path.join(__dirname, '../src/data/content.json');
fs.writeFileSync(
  contentPath,
  JSON.stringify(contentData, null, 2)
);

// Save backup of original data
const backupPath = path.join(__dirname, '../src/data/beliefs.backup.json');
if (!fs.existsSync(backupPath)) {
  fs.writeFileSync(
    backupPath,
    JSON.stringify(beliefsData, null, 2)
  );
  console.log('\n✅ Backup saved to beliefs.backup.json');
}

console.log(`\n✅ Successfully migrated ${contentData.length} beliefs to content format`);
console.log(`✅ New content saved to content.json`);

// Verify signal counts
const signalStats = contentData.map(c => Object.keys(c.signals).length);
console.log(`\n📊 Signal Statistics:`);
console.log(`  - Min signals: ${Math.min(...signalStats)}`);
console.log(`  - Max signals: ${Math.max(...signalStats)}`);
console.log(`  - Avg signals: ${(signalStats.reduce((a, b) => a + b, 0) / signalStats.length).toFixed(1)}`);