import { ChartConfig, RenderableChart } from '@/types/content.types';

// Type for chart data
interface ChartData {
  [axisName: string]: (string | number)[];
}

// Import the JSON data
import chartsData from '@/data/charts.json';
import renderedChartsData from '@/data/renderedcharts.json';

// Legacy function name for backward compatibility
export async function getChartsForBelief(contentId: string): Promise<RenderableChart[]> {
  return getChartsForContent(contentId);
}

export async function getChartsForContent(contentId: string): Promise<RenderableChart[]> {
  try {
    const rawData = getRawChartData(contentId);
    const configs = getChartConfigs(contentId);
    
    if (!rawData || configs.length === 0) {
      return [];
    }

    return configs
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(config => combineAxisData(rawData, config))
      .filter(chart => chart.data.length > 0);
  } catch (error) {
    console.error(`Error loading charts for content ${contentId}:`, error);
    return [];
  }
}

export function getRawChartData(contentId: string): ChartData | null {
  return (chartsData as Record<string, ChartData>)[contentId] || null;
}

export function getChartConfigs(contentId: string): ChartConfig[] {
  return (renderedChartsData as ChartConfig[]).filter(config => config.beliefId === contentId);
}

export function combineAxisData(rawData: ChartData, config: ChartConfig): RenderableChart {
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

export function getFeedChart(contentId: string): Promise<RenderableChart | null> {
  return getChartsForContent(contentId).then(charts => {
    const feedChart = charts.find(chart => chart.config.showInFeed);
    return feedChart || (charts.length > 0 ? charts[0] : null);
  });
} 