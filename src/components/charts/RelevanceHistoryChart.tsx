'use client';

import { useEffect, useRef, memo } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { ChartDataPoint } from '@/types/api';

interface RelevanceHistoryChartProps {
  actualRelevance: ChartDataPoint[]; // BD relevance scores (ground truth)
  impliedRelevance: ChartDataPoint[]; // Market-implied relevance (predictions)
  height?: number;
}

export const RelevanceHistoryChart = memo(function RelevanceHistoryChart({
  actualRelevance,
  impliedRelevance,
  height = 400,
}: RelevanceHistoryChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

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

    // Add implied relevance line series (blue, dashed - market predictions)
    const impliedSeries = chart.addLineSeries({
      color: '#3b82f6',  // Blue-500
      lineWidth: 2,
      lineStyle: 2,      // Dashed line
      priceScaleId: 'right',
      title: 'Market Prediction',
    });

    // Add actual relevance area series (green - ground truth)
    const actualSeries = chart.addAreaSeries({
      topColor: 'rgba(34, 197, 94, 0.3)',      // Green
      bottomColor: 'rgba(34, 197, 94, 0.02)',  // Green fade
      lineColor: '#22c55e',                     // Green-500
      lineWidth: 2,
      priceScaleId: 'right',
      title: 'Actual Relevance',
    });

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

    // Update data if available
    if (impliedRelevance.length > 0) {
      const cleanedImplied = deduplicateAndSort(impliedRelevance);
      impliedSeries.setData(cleanedImplied);
    }
    if (actualRelevance.length > 0) {
      const cleanedActual = deduplicateAndSort(actualRelevance);
      actualSeries.setData(cleanedActual);
    }

    // Fit content if we have any data
    if (actualRelevance.length > 0 || impliedRelevance.length > 0) {
      chart.timeScale().fitContent();
    }

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
  }, [height, actualRelevance, impliedRelevance]);

  return (
    <div
      ref={chartContainerRef}
      className="w-full lightweight-charts-container rounded-lg overflow-hidden"
      style={{ height: `${height}px` }}
    />
  );
});
