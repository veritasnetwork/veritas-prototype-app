'use client';

import { useEffect, useRef, memo } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { ChartDataPoint } from '@/types/api';

interface RelevanceHistoryChartProps {
  relevanceData: ChartDataPoint[];
  height?: number;
}

export const RelevanceHistoryChart = memo(function RelevanceHistoryChart({
  relevanceData,
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

    // Add relevance area series (green theme)
    const relevanceSeries = chart.addAreaSeries({
      topColor: 'rgba(34, 197, 94, 0.3)',      // Green
      bottomColor: 'rgba(34, 197, 94, 0.02)',  // Green fade
      lineColor: '#22c55e',                     // Green-500
      lineWidth: 2,
      priceScaleId: 'right',
    });

    // Configure price scale for 0-1 range
    chart.priceScale('right').applyOptions({
      scaleMargins: {
        top: 0.1,
        bottom: 0.1,
      },
    });

    // Update data if available
    if (relevanceData.length > 0) {
      relevanceSeries.setData(relevanceData);
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
  }, [height, relevanceData]);

  return (
    <div
      ref={chartContainerRef}
      className="w-full lightweight-charts-container rounded-lg overflow-hidden"
      style={{ height: `${height}px` }}
    />
  );
});
