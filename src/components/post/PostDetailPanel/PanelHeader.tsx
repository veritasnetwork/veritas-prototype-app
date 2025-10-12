'use client';

interface PanelHeaderProps {
  onClose: () => void;
  title?: string;
}

export function PanelHeader({ onClose, title }: PanelHeaderProps) {
  return (
    <div className="panel-header sticky top-0 z-10 bg-[#1a1a1a] border-b border-gray-800 px-6 py-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-white truncate flex-1 mr-4">
        {title || 'Post Details'}
      </h2>

      <button
        onClick={onClose}
        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        aria-label="Close panel"
      >
        <svg
          className="w-5 h-5 text-gray-400 hover:text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}