'use client';

import { usePathname } from 'next/navigation';
import VeritasNavbar from './Navbar';

const ConditionalNavbar = () => {
  const pathname = usePathname();
  
  // Check if we're on a feed route (routes that should use FeedNav instead)
  const isFeedRoute = pathname === '/';
  
  // Only render VeritasNavbar on non-feed routes
  if (isFeedRoute) {
    return null;
  }
  
  return <VeritasNavbar />;
};

export default ConditionalNavbar; 