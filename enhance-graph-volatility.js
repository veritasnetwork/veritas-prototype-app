const fs = require('fs');

// Read the original data
const chartsData = JSON.parse(fs.readFileSync('./src/data/charts.json', 'utf8'));

// Categorize metrics by volatility level
const HIGH_VOLATILITY_METRICS = [
  // Market/Financial
  'x_user_decline_percent',
  'bluesky_growth_rate', 
  'threads_adoption_percent',
  'mastodon_user_increase',
  'ad_revenue_shift_percent',
  'cross_border_transactions',
  'investment_funding_billions',
  'production_cost_per_kg',
  'office_value_index',
  'vacancy_rate_percent',
  'rental_income_decline',
  'property_tax_revenue_loss',
  
  // Estimates/Projections (except quantum_advantage_estimate which is already perfect)
  'global_tension_index',
  'debris_density_index',
  'collision_risk_percentage',
  
  // Social/Behavioral
  'consumer_acceptance_score',
  'satellite_launches_monthly',
  'production_capacity_gwh',
  'transaction_cost_reduction'
];

const MODERATE_VOLATILITY_METRICS = [
  // Environmental
  'ocean_ph_levels',
  'temperature_anomaly_celsius',
  'ice_sheet_loss_gigatons',
  'tipping_point_risk_score',
  'plankton_community_stress',
  
  // Tech Progress
  'qubit_count_increase',
  'clinical_trials_active',
  'error_rate_reduction_factor',
  'cleanup_effectiveness_rate',
  'missile_production_monthly',
  'readiness_percentage',
  'coordination_index',
  'compute_governance_score',
  'market_penetration_percent',
  'debris_generation_rate'
];

const LOW_VOLATILITY_METRICS = [
  // Demographics
  'global_fertility_rate',
  'developed_nations_rate',
  'developing_nations_rate',
  'urban_fertility_decline',
  
  // Steady Progress
  'regulatory_frameworks',
  'countries_developing_cbdc',
  'approved_therapies_count',
  'energy_density_improvement',
  'international_agreements',
  'regulatory_approvals_count',
  'treatment_success_rate',
  'patient_access_millions',
  
  // Physical/Scientific
  'forest_cover_loss_percent',
  'coral_reef_decline_percent',
  'shellfish_population_loss',
  'charging_time_minutes',
  'conversion_to_residential',
  'population_coverage_percent',
  'financial_inclusion_improvement',
  'policy_effectiveness_score',
  'cost_reduction_percent',
  'coastal_economy_impact'
];

// High volatility function - creates dramatic swings
function addHighVolatility(data) {
  return data.map((value, index, array) => {
    // Skip initial zeros
    if (value === 0 && index < 2) return value;
    
    // Calculate base volatility (30-40% of value)
    const volatilityLevel = 0.35;
    const magnitude = Math.abs(value);
    
    // Random walk component
    let randomWalk = (Math.random() - 0.5) * magnitude * volatilityLevel;
    
    // Add momentum from previous change
    if (index > 0) {
      const prevChange = index > 1 ? (array[index - 1] - array[index - 2]) : 0;
      randomWalk += prevChange * 0.4 * Math.random(); // Momentum effect
    }
    
    // Occasional dramatic events (10% chance)
    if (Math.random() < 0.1) {
      const eventMultiplier = Math.random() < 0.5 ? 1.5 : 0.7; // Spike up or crash down
      randomWalk *= eventMultiplier;
    }
    
    // Add sine wave for cyclical behavior
    const cycleComponent = Math.sin(index * 0.5) * magnitude * 0.1;
    
    // Combine all components
    let noisyValue = value + randomWalk + cycleComponent;
    
    // Ensure reasonable bounds
    if (value > 0) {
      noisyValue = Math.max(value * 0.4, Math.min(value * 1.6, noisyValue));
    }
    
    return Math.max(0, noisyValue);
  });
}

// Moderate volatility - noticeable variation with trend preservation
function addModerateVolatility(data) {
  return data.map((value, index, array) => {
    if (value === 0 && index < 2) return value;
    
    const volatilityLevel = 0.18;
    const magnitude = Math.abs(value);
    
    // Base noise
    let noise = (Math.random() - 0.5) * magnitude * volatilityLevel;
    
    // Smoother momentum
    if (index > 0) {
      const trend = index > 1 ? (array[index - 1] - array[index - 2]) : 0;
      noise += trend * 0.2 * Math.random();
    }
    
    // Occasional moderate events (5% chance)
    if (Math.random() < 0.05) {
      noise *= 1.3;
    }
    
    // Add gentle wave
    const wave = Math.sin(index * 0.3) * magnitude * 0.05;
    
    let noisyValue = value + noise + wave;
    
    // Keep within reasonable bounds
    if (value > 0) {
      noisyValue = Math.max(value * 0.7, Math.min(value * 1.3, noisyValue));
    }
    
    return Math.max(0, noisyValue);
  });
}

// Low volatility - smooth with minor variations
function addLowVolatility(data) {
  return data.map((value, index, array) => {
    if (value === 0 && index < 2) return value;
    
    const volatilityLevel = 0.08;
    const magnitude = Math.abs(value);
    
    // Gentle noise
    let noise = (Math.random() - 0.5) * magnitude * volatilityLevel;
    
    // Strong trend preservation
    if (index > 0 && index < array.length - 1) {
      // Smooth between neighbors
      const expectedValue = index > 1 ? 
        array[index - 1] + (array[index - 1] - array[index - 2]) : value;
      noise *= 0.5; // Reduce noise to maintain smoothness
    }
    
    let noisyValue = value + noise;
    
    // Very tight bounds
    if (value > 0) {
      noisyValue = Math.max(value * 0.9, Math.min(value * 1.1, noisyValue));
    }
    
    return Math.max(0, noisyValue);
  });
}

// Special handling for quantum advantage estimate (keep existing pattern)
function preserveQuantumAdvantage(data) {
  // This one is already perfect with its volatility, just return it
  return data;
}

// Process the data
const enhancedData = {};

Object.keys(chartsData).forEach(beliefId => {
  const beliefData = chartsData[beliefId];
  enhancedData[beliefId] = {};
  
  Object.keys(beliefData).forEach(metric => {
    // Skip time arrays
    if (metric.includes('time_') || metric.includes('Week ')) {
      enhancedData[beliefId][metric] = beliefData[metric];
      return;
    }
    
    const data = beliefData[metric];
    let processedData;
    
    // Special case for quantum advantage estimate
    if (metric === 'quantum_advantage_estimate') {
      processedData = preserveQuantumAdvantage(data);
    }
    // Apply high volatility
    else if (HIGH_VOLATILITY_METRICS.includes(metric)) {
      processedData = addHighVolatility(data);
    }
    // Apply moderate volatility
    else if (MODERATE_VOLATILITY_METRICS.includes(metric)) {
      processedData = addModerateVolatility(data);
    }
    // Apply low volatility
    else if (LOW_VOLATILITY_METRICS.includes(metric)) {
      processedData = addLowVolatility(data);
    }
    // Default to moderate if not categorized
    else {
      console.log(`Uncategorized metric: ${metric}, applying moderate volatility`);
      processedData = addModerateVolatility(data);
    }
    
    // Round appropriately based on metric type
    enhancedData[beliefId][metric] = processedData.map(value => {
      // Special handling for different metric types
      if (metric === 'ocean_ph_levels') {
        return Math.round(value * 100) / 100; // 2 decimal places for pH
      } else if (metric === 'quantum_advantage_estimate') {
        return Math.round(value); // Keep as whole years
      } else if (metric.includes('billions') || metric.includes('millions')) {
        return Math.round(value * 10) / 10; // 1 decimal for large numbers
      } else if (metric.includes('percent') || metric.includes('rate') || metric.includes('score')) {
        return Math.round(value * 10) / 10; // 1 decimal for percentages
      } else if (value < 1) {
        return Math.round(value * 100) / 100; // 2 decimals for small numbers
      } else if (value < 10) {
        return Math.round(value * 10) / 10; // 1 decimal for medium numbers
      } else {
        return Math.round(value); // No decimals for large numbers
      }
    });
  });
});

// Write the enhanced data
fs.writeFileSync('./src/data/charts.json', JSON.stringify(enhancedData, null, 2));

console.log('✅ Successfully enhanced graph volatility!');
console.log('📊 Applied different volatility levels:');
console.log(`   - High volatility: ${HIGH_VOLATILITY_METRICS.length} metrics`);
console.log(`   - Moderate volatility: ${MODERATE_VOLATILITY_METRICS.length} metrics`);
console.log(`   - Low volatility: ${LOW_VOLATILITY_METRICS.length} metrics`);
console.log('📈 Graphs now have more realistic, varied patterns!');