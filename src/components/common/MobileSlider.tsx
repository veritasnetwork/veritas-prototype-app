/**
 * MobileSlider Component
 * A slider with improved touch targets for mobile devices
 */

'use client';

import { useRef } from 'react';
import './MobileSlider.css';

interface MobileSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  disabled?: boolean;
  className?: string;
  trackClassName?: string;
  thumbClassName?: string;
  label?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
}

export function MobileSlider({
  min,
  max,
  value,
  onChange,
  step = 1,
  disabled = false,
  className = '',
  trackClassName = '',
  thumbClassName = '',
  label,
  showValue = true,
  formatValue = (v) => `${v}`,
}: MobileSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null);

  const percentage = ((value - min) / (max - min)) * 100;

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (disabled || !sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = clientX - rect.left;
    const width = rect.width;

    const rawValue = (x / width) * (max - min) + min;
    const steppedValue = Math.round(rawValue / step) * step;
    const clampedValue = Math.max(min, Math.min(max, steppedValue));

    onChange(clampedValue);
  };

  return (
    <div className={`mobile-slider ${className}`}>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-gray-400">{label}</label>
          {showValue && (
            <span className="text-sm font-medium text-[#B9D9EB]">
              {formatValue(value)}
            </span>
          )}
        </div>
      )}

      {/* Larger touch target wrapper */}
      <div
        ref={sliderRef}
        className={`relative py-4 -my-4 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={handleTrackClick}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={handleTrackClick}
      >
        {/* Track */}
        <div className={`relative h-1 bg-[#2a2a2a] rounded-full ${trackClassName}`}>
          {/* Filled portion */}
          <div
            className="absolute left-0 top-0 h-full bg-[#B9D9EB] rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />

          {/* Thumb with larger touch area */}
          <div
            className="absolute top-1/2 -translate-y-1/2 transition-all"
            style={{ left: `${percentage}%` }}
          >
            {/* Invisible larger touch target */}
            <div className="absolute -inset-4 rounded-full" />

            {/* Visible thumb */}
            <div className={`
              relative w-4 h-4 -ml-2
              bg-[#B9D9EB] rounded-full shadow-lg
              ring-2 ring-[#0f0f0f]
              transition-transform hover:scale-110 active:scale-125
              ${thumbClassName}
            `} />
          </div>
        </div>

        {/* Native input for accessibility (hidden) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          aria-label={label}
        />
      </div>

      {/* Optional tick marks for key values */}
      {(max === 100 || max === 1) && (
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      )}
    </div>
  );
}