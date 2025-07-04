'use client';

import { usePathname } from 'next/navigation';

interface ConditionalWrapperProps {
  children: React.ReactNode;
}

const ConditionalWrapper: React.FC<ConditionalWrapperProps> = ({ children }) => {
  const pathname = usePathname();
  
  // Check if we're on a feed route (routes that should use FeedNav instead)
  const isFeedRoute = pathname === '/';
  
  // Feed routes handle their own padding in their layout
  if (isFeedRoute) {
    return <>{children}</>;
  }
  
  // Non-feed routes need padding for VeritasNavbar
  return (
    <>
      {/* Desktop: Add top padding for navbar */}
      <div className="hidden md:block pt-24">
        {children}
      </div>
      
      {/* Mobile: Add bottom padding for dock, different top padding */}
      <div className="md:hidden pt-6 pb-32">
        {children}
      </div>
    </>
  );
};

export default ConditionalWrapper; 