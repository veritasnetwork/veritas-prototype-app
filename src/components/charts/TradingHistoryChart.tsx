'use client';

import { useEffect, useRef, memo } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { ChartDataPoint, VolumeDataPoint } from '@/hooks/api/useTradeHistory';

interface TradingHistoryChartProps {
  priceLongData: ChartDataPoint[];
  priceShortData: ChartDataPoint[];
  volumeData: VolumeDataPoint[];
  height?: number;
}

export const TradingHistoryChart = memo(function TradingHistoryChart({
  priceLongData,
  priceShortData,
  volumeData,
  height = 400,
}: TradingHistoryChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const priceLongSeriesRef = useRef<any>(null);
  const priceShortSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  // Effect 1: Create chart once
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#0a0a0a' }, textColor: '#9ca3af' },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      width: chartContainerRef.current.clientWidth,
      height: height,
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: 'transparent' },
      rightPriceScale: { borderColor: 'transparent' },
      crosshair: {
        vertLine: { width: 1, color: '#6b7280', style: 1 },
        horzLine: { width: 1, color: '#6b7280', style: 1 },
      },
    });
    chartRef.current = chart;

    priceLongSeriesRef.current = chart.addAreaSeries({
      topColor: 'rgba(185, 217, 235, 0.4)',
      bottomColor: 'rgba(185, 217, 235, 0.02)',
      lineColor: '#B9D9EB',
      lineWidth: 2,
      priceScaleId: 'right',
      title: 'LONG',
    });

    priceShortSeriesRef.current = chart.addAreaSeries({
      topColor: 'rgba(249, 115, 22, 0.4)',
      bottomColor: 'rgba(249, 115, 22, 0.02)',
      lineColor: '#f97316',
      lineWidth: 2,
      priceScaleId: 'right',
      title: 'SHORT',
    });

    chart.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.25 } });

    volumeSeriesRef.current = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [height]);

  // Effect 2: Update data only
  useEffect(() => {
    if (!priceLongSeriesRef.current || !priceShortSeriesRef.current || !volumeSeriesRef.current) return;

    if (priceLongData.length > 0) priceLongSeriesRef.current.setData(priceLongData);
    if (priceShortData.length > 0) priceShortSeriesRef.current.setData(priceShortData);
    if (volumeData.length > 0) volumeSeriesRef.current.setData(volumeData);

    if (chartRef.current && (priceLongData.length > 0 || priceShortData.length > 0)) {
      chartRef.current.timeScale().fitContent();
    }
  }, [priceLongData, priceShortData, volumeData]);

  return (
    <div
      ref={chartContainerRef}
      className="w-full lightweight-charts-container rounded-lg overflow-hidden"
      style={{ height: `${height}px` }}
    />
  );
});
