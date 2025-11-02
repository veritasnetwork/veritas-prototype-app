import { ReactNode } from 'react';

/**
 * Mobile-adaptive layout components for responsive UI patterns
 */

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

/**
 * Bottom sheet modal - mobile-optimized alternative to centered modals
 * On desktop (md+), renders as a centered modal
 * On mobile, slides up from bottom with touch-friendly close gestures
 */
export function BottomSheet({ isOpen, onClose, children, title }: BottomSheetProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center z-50">
        <div className="bg-bg-secondary rounded-t-2xl md:rounded-2xl max-h-[90vh] md:max-h-[80vh] w-full md:max-w-lg overflow-hidden flex flex-col animate-slide-up md:animate-fade-in">
          {/* Handle bar (mobile only) */}
          <div className="md:hidden flex justify-center py-3 border-b border-border-primary">
            <div className="w-12 h-1 bg-border-primary rounded-full" />
          </div>

          {/* Header */}
          {title && (
            <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
              <h2 className="text-lg font-semibold">{title}</h2>
              <button
                onClick={onClose}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                ✕
              </button>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

interface TouchableCardProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

/**
 * Touch-optimized card with proper active states
 * Provides tactile feedback on mobile while maintaining desktop hover states
 */
export function TouchableCard({ children, onClick, className = '' }: TouchableCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        transition-all duration-150
        active:scale-[0.98] active:opacity-90
        md:hover:scale-[1.02] md:active:scale-100
        cursor-pointer
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface FloatingActionButtonProps {
  onClick: () => void;
  icon: ReactNode;
  label?: string;
  className?: string;
}

/**
 * Floating action button (FAB) - mobile-first pattern
 * Positioned in bottom-right on mobile, adapts to desktop layouts
 */
export function FloatingActionButton({
  onClick,
  icon,
  label,
  className = ''
}: FloatingActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        fixed bottom-6 right-6 md:bottom-8 md:right-8
        w-14 h-14 md:w-16 md:h-16
        bg-brand-primary hover:bg-brand-hover
        text-white
        rounded-full
        shadow-lg hover:shadow-xl
        transition-all duration-200
        active:scale-95
        flex items-center justify-center
        z-30
        ${className}
      `}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

interface TabBarProps {
  tabs: Array<{
    id: string;
    label: string;
    icon?: ReactNode;
    count?: number;
  }>;
  activeTab: string;
  onChange: (tabId: string) => void;
}

/**
 * Mobile-optimized tab bar
 * Fixed to bottom on mobile, inline on desktop
 */
export function MobileTabBar({ tabs, activeTab, onChange }: TabBarProps) {
  return (
    <div className="
      fixed bottom-0 left-0 right-0 md:relative
      bg-bg-secondary border-t border-border-primary
      md:border-t-0 md:border-b
      z-20
    ">
      <div className="flex items-center justify-around md:justify-start md:gap-6 px-2 md:px-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              flex-1 md:flex-none
              flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2
              py-3 md:py-4 px-3
              transition-colors
              ${activeTab === tab.id
                ? 'text-brand-primary'
                : 'text-text-secondary hover:text-text-primary'
              }
            `}
          >
            {tab.icon && (
              <span className="text-xl md:text-base">
                {tab.icon}
              </span>
            )}
            <span className="text-xs md:text-sm font-medium">
              {tab.label}
            </span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className="
                hidden md:inline
                ml-2 px-2 py-0.5
                bg-brand-primary/20 text-brand-primary
                rounded-full text-xs
              ">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

/**
 * Pull-to-refresh wrapper for mobile
 * Desktop: Shows a refresh button instead
 */
export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  // TODO: Implement pull-to-refresh gesture detection
  // For now, just render children
  return <>{children}</>;
}

interface SwipeableProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  children: ReactNode;
  threshold?: number;
}

/**
 * Swipeable container for mobile gestures
 * Common pattern: swipe to delete, swipe to navigate
 */
export function Swipeable({
  onSwipeLeft,
  onSwipeRight,
  children,
  threshold = 50
}: SwipeableProps) {
  // TODO: Implement swipe gesture detection
  // For now, just render children
  return <>{children}</>;
}
