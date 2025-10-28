/**
 * Avatar Component
 * Reusable avatar with consistent styling across the app
 * Default style: eggshell background (#F0EAD6) with dark gray text
 */

import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  username: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-16 h-16 text-2xl',
  xl: 'w-24 h-24 text-3xl',
};

export function Avatar({
  src,
  alt,
  username,
  size = 'md',
  className
}: AvatarProps) {
  const initial = username?.charAt(0).toUpperCase() || 'U';

  return (
    <div className={cn(
      'rounded-full overflow-hidden flex-shrink-0',
      sizeClasses[size],
      className
    )}>
      {src ? (
        <img
          src={src}
          alt={alt || username}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-[#F0EAD6] flex items-center justify-center">
          <span className="text-gray-700 font-bold">
            {initial}
          </span>
        </div>
      )}
    </div>
  );
}
