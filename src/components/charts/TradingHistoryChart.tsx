'use client';

import { useEffect, useRef, memo } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { ChartDataPoint, VolumeDataPoint } from '@/hooks/api/useTradeHistory';

interface TradingHistoryChartProps {
  priceData: ChartDataPoint[];
  volumeData: VolumeDataPoint[];
  height?: number;
}

export const TradingHistoryChart = memo(function TradingHistoryChart({
  priceData,
  volumeData,
  height = 400,
}: TradingHistoryChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const priceSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

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
        width: chartContainerRef.current!.clientWidth,
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

      // Add price area series (top)
      const priceSeries = chart.addAreaSeries({
        topColor: 'rgba(185, 217, 235, 0.3)',
        bottomColor: 'rgba(185, 217, 235, 0.02)',
        lineColor: '#B9D9EB',
        lineWidth: 2,
        priceScaleId: 'right', // Explicitly use right price scale
      });

      priceSeriesRef.current = priceSeries;

      // Configure price scale (top 80% of chart)
      chart.priceScale('right').applyOptions({
        scaleMargins: {
          top: 0.1,
          bottom: 0.25, // Leave 25% for volume at bottom
        },
      });

      // Add volume histogram series (bottom) - colors set per bar (green for buy, red for sell)
      const volumeSeries = chart.addHistogramSeries({
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
      });

      volumeSeriesRef.current = volumeSeries;

      // Configure volume scale (bottom 15% of chart)
      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.85,
          bottom: 0,
        },
      });

      // Update data if available
      if (priceData.length > 0) {
        priceSeries.setData(priceData);
        chart.timeScale().fitContent();
      }

      if (volumeData.length > 0) {
        volumeSeries.setData(volumeData);
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
  }, [height, priceData, volumeData]);

  return (
    <div
      ref={chartContainerRef}
      className="w-full lightweight-charts-container rounded-lg overflow-hidden"
      style={{ height: `${height}px` }}
    />
  );
});
