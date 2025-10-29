'use client';

import { useEffect, useState } from 'react';

/**
 * Modal that blocks mobile users from accessing the app
 * Detects mobile devices and shows an unmissable, non-dismissible message
 */
export function MobileBlockModal() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Check multiple signals for mobile device
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isSmallScreen = window.innerWidth < 768; // Less than tablet size
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // Consider it mobile if it matches user agent OR (is small screen AND has touch)
      setIsMobile(isMobileUA || (isSmallScreen && isTouchDevice));
    };

    checkMobile();

    // Recheck on resize in case user rotates device or resizes browser
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!isMobile) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-95 p-6"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
      }}
    >
      <div className="max-w-md w-full bg-bg-secondary border border-border-primary rounded-lg p-8 text-center shadow-2xl">
        <div className="mb-6">
          <svg
            className="w-16 h-16 mx-auto text-accent-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-text-primary mb-4">
          Mobile App Coming Soon
        </h2>

        <p className="text-text-secondary mb-6 leading-relaxed">
          This app is not yet launched on mobile. Please visit us on a desktop or laptop computer to get started.
        </p>

        <div className="text-sm text-text-tertiary">
          We&apos;re working hard to bring Veritas to mobile devices.
        </div>
      </div>
    </div>
  );
}