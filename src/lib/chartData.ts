import { BeliefChartData, ChartConfig, RenderableChart } from '@/types/belief.types';

// Import the JSON data
import chartsData from '@/data/charts.json';
import renderedChartsData from '@/data/renderedcharts.json';

export async function getChartsForBelief(beliefId: string): Promise<RenderableChart[]> {
  try {
    const rawData = getRawChartData(beliefId);
    const configs = getChartConfigs(beliefId);
    
    if (!rawData || configs.length === 0) {
      return [];
    }

    return configs
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(config => combineAxisData(rawData, config))
      .filter(chart => chart.data.length > 0);
  } catch (error) {
    console.error(`Error loading charts for belief ${beliefId}:`, error);
    return [];
  }
}

export function getRawChartData(beliefId: string): BeliefChartData | null {
  return (chartsData as Record<string, BeliefChartData>)[beliefId] || null;
}

export function getChartConfigs(beliefId: string): ChartConfig[] {
  return (renderedChartsData as ChartConfig[]).filter(config => config.beliefId === beliefId);
}

export function combineAxisData(rawData: BeliefChartData, config: ChartConfig): RenderableChart {
  const xData = rawData[config.xAxis] || [];
  const yData = rawData[config.yAxis] || [];
  
  // Take minimum length to avoid mismatched arrays
  const minLength = Math.min(xData.length, yData.length);
  
  const data = Array.from({ length: minLength }, (_, i) => ({
    x: xData[i],
    y: Number(yData[i]) || 0,
    label: `${config.yAxis}: ${yData[i]}`
  }));

  return {
    config,
    data
  };
}

export function getFeedChart(beliefId: string): Promise<RenderableChart | null> {
  return getChartsForBelief(beliefId).then(charts => {
    const feedChart = charts.find(chart => chart.config.showInFeed);
    return feedChart || (charts.length > 0 ? charts[0] : null);
  });
} 