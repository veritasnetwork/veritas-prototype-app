'use client';

import { useEffect, useRef, memo } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { ChartDataPoint } from '@/types/api';

interface RelevanceHistoryChartProps {
  actualRelevance: ChartDataPoint[]; // BD relevance scores (ground truth)
  impliedRelevance: ChartDataPoint[]; // Market-implied relevance (predictions)
  rebaseEvents?: ChartDataPoint[]; // Settlement/rebase markers
  height?: number;
}

export const RelevanceHistoryChart = memo(function RelevanceHistoryChart({
  actualRelevance,
  impliedRelevance,
  rebaseEvents = [],
  height = 400,
}: RelevanceHistoryChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const impliedSeriesRef = useRef<any>(null);
  const actualSeriesRef = useRef<any>(null);

  // Create chart only once
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0a' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'transparent',
      },
      rightPriceScale: {
        borderColor: 'transparent',
        formatter: (price: number) => {
          // Format as percentage (0-1 range becomes 0-100%)
          if (price < 0 || !Number.isFinite(price)) return '0%';
          return `${(price * 100).toFixed(1)}%`;
        },
      },
      localization: {
        priceFormatter: (price: number) => {
          // Format as percentage (0-1 range becomes 0-100%)
          if (price < 0 || !Number.isFinite(price)) return '0%';
          return `${(price * 100).toFixed(1)}%`;
        },
      },
      crosshair: {
        vertLine: {
          width: 1,
          color: '#6b7280',
          style: 1, // Dashed
        },
        horzLine: {
          width: 1,
          color: '#6b7280',
          style: 1, // Dashed
        },
      },
    });

    chartRef.current = chart;

    // Configure price scale for 0-1 range
    chart.priceScale('right').applyOptions({
      scaleMargins: {
        top: 0.1,
        bottom: 0.1,
      },
    });

    // Add implied relevance area series (blue - market predictions)
    const impliedSeries = chart.addAreaSeries({
      topColor: 'rgba(59, 130, 246, 0.4)',     // Blue-500 with 40% opacity
      bottomColor: 'rgba(59, 130, 246, 0.05)', // Blue-500 with 5% opacity
      lineColor: 'rgba(59, 130, 246, 0.9)',    // Blue-500 with 90% opacity
      lineWidth: 2,
      priceScaleId: 'right',
      title: 'Market Prediction',
    });

    // Add actual relevance area series (cream/gold - BD scores from settlements)
    const actualSeries = chart.addAreaSeries({
      topColor: 'rgba(240, 234, 214, 0.5)',    // Cream with 50% opacity
      bottomColor: 'rgba(240, 234, 214, 0.05)', // Cream with 5% opacity
      lineColor: '#F0EAD6',                     // Solid cream line
      lineWidth: 3,
      priceScaleId: 'right',
      title: 'Settlements',
    });

    // Store series references
    impliedSeriesRef.current = impliedSeries;
    actualSeriesRef.current = actualSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [height]); // Only recreate chart when height changes

  // Separate effect for updating data
  useEffect(() => {
    if (!chartRef.current || !impliedSeriesRef.current || !actualSeriesRef.current) return;

    // Deduplicate and sort data by time (lightweight-charts requires strictly ascending timestamps)
    const deduplicateAndSort = (data: ChartDataPoint[]): ChartDataPoint[] => {
      // Group by timestamp and take the last value for each timestamp
      const byTime = new Map<number, number>();
      data.forEach(point => {
        byTime.set(point.time, point.value);
      });

      // Convert back to array and sort by time
      return Array.from(byTime.entries())
        .map(([time, value]) => ({ time, value }))
        .sort((a, b) => a.time - b.time);
    };

    console.log('[RelevanceHistoryChart] Updating data:', {
      impliedCount: impliedRelevance.length,
      actualCount: actualRelevance.length,
      latestImplied: impliedRelevance[impliedRelevance.length - 1],
    });

    // Update data if available
    if (impliedRelevance.length > 0) {
      const cleanedImplied = deduplicateAndSort(impliedRelevance);
      impliedSeriesRef.current.setData(cleanedImplied);
    }
    if (actualRelevance.length > 0) {
      const cleanedActual = deduplicateAndSort(actualRelevance);
      actualSeriesRef.current.setData(cleanedActual);
    }

    // Fit content if we have any data
    if (actualRelevance.length > 0 || impliedRelevance.length > 0) {
      chartRef.current.timeScale().fitContent();
    }
  }, [actualRelevance, impliedRelevance, rebaseEvents]);

  return (
    <div
      ref={chartContainerRef}
      className="w-full lightweight-charts-container rounded-lg overflow-hidden"
      style={{ height: `${height}px` }}
    />
  );
});
