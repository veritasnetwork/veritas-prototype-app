'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Clock, TrendingUp, BarChart3 } from 'lucide-react';

export type SortOption = 'recent' | 'volume' | 'relevant';

interface FilterDropdownProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
  isCompact?: boolean;
}

const sortOptions: { value: SortOption; label: string; icon: any }[] = [
  { value: 'recent', label: 'Most Recent', icon: Clock },
  { value: 'volume', label: 'Most Volume', icon: BarChart3 },
  { value: 'relevant', label: 'Most Relevant', icon: TrendingUp },
];

export function FilterDropdown({ currentSort, onSortChange, isCompact = false }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const currentOption = sortOptions.find(opt => opt.value === currentSort) || sortOptions[0];
  const CurrentIcon = currentOption.icon;

  return (
    <div
      className="w-full rounded-xl transition-all duration-300 overflow-hidden"
      ref={dropdownRef}
    >
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-full flex items-center justify-center transition-all duration-200 hover:bg-gray-700/50 ${
          isCompact ? 'h-[72px] flex-col p-0.5' : 'h-[30px] px-3'
        }`}
      >
        <div className={`flex items-center gap-2 ${isCompact ? 'flex-col' : ''}`}>
          {!isCompact && (
            <span className="text-xs font-semibold text-white">{currentOption.label}</span>
          )}
          <ChevronDown
            className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Expanded Options - part of same container */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {sortOptions.map((option, index) => {
          const Icon = option.icon;
          const isSelected = option.value === currentSort;

          return (
            <button
              key={option.value}
              onClick={() => {
                onSortChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2.5 flex items-center justify-center transition-colors ${
                isSelected
                  ? 'text-white'
                  : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
              }`}
            >
              <span className="text-xs font-medium">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
