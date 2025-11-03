'use client';

import { useState, useEffect } from 'react';
import { X, Download, Share, Plus, MoreVertical } from 'lucide-react';

interface PWAInstallPromptProps {
  onClose: () => void;
}

export function PWAInstallPrompt({ onClose }: PWAInstallPromptProps) {
  const [browser, setBrowser] = useState<'safari' | 'chrome' | 'firefox' | 'brave' | 'other'>('other');
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const detectBrowser = async () => {
      // Detect browser and OS
      const userAgent = navigator.userAgent.toLowerCase();
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isIOSDevice);

      // Check for Brave browser (must check before Chrome since Brave includes "chrome" in UA)
      // Brave detection: check both sync and async API
      let isBrave = false;
      if ((navigator as any).brave !== undefined) {
        // Brave has navigator.brave.isBrave() method
        try {
          isBrave = await (navigator as any).brave.isBrave();
        } catch {
          isBrave = true; // If brave object exists but isBrave() fails, likely Brave
        }
      }

      if (isBrave) {
        setBrowser('brave');
      } else if (userAgent.includes('safari') && !userAgent.includes('chrome') && !userAgent.includes('crios')) {
        setBrowser('safari');
      } else if (userAgent.includes('chrome') || userAgent.includes('crios')) {
        setBrowser('chrome');
      } else if (userAgent.includes('firefox')) {
        setBrowser('firefox');
      } else {
        setBrowser('other');
      }
    };

    detectBrowser();
  }, []);

  const getInstructions = () => {
    // Brave on iOS - tell users to switch to Safari
    if (browser === 'brave' && isIOS) {
      return (
        <div className="space-y-3">
          <p className="text-gray-300 text-sm">Brave doesn't support PWA installation on iOS. Please open this page in Safari.</p>
          <ol className="space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-white">1.</span>
              <span>Tap the <Share className="inline w-4 h-4 mx-1" /> Share button</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-white">2.</span>
              <span>Select <strong>"Open in Safari"</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-white">3.</span>
              <span>Then follow the Safari instructions to add to home screen</span>
            </li>
          </ol>
        </div>
      );
    }

    if (browser === 'safari' && isIOS) {
      return (
        <div className="space-y-3">
          <p className="text-gray-300 text-sm">To install Veritas on your iPhone:</p>
          <ol className="space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-white">1.</span>
              <span>Tap the <Share className="inline w-4 h-4 mx-1" /> Share button at the bottom of your screen</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-white">2.</span>
              <span>Scroll down and tap <strong>"Add to Home Screen"</strong> <Plus className="inline w-4 h-4 mx-1" /></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-white">3.</span>
              <span>Tap <strong>"Add"</strong> in the top right corner</span>
            </li>
          </ol>
        </div>
      );
    }

    if (browser === 'chrome' && isIOS) {
      return (
        <div className="space-y-3">
          <p className="text-gray-300 text-sm">Chrome on iOS doesn't support PWA installation. Please open this page in Safari to install.</p>
          <ol className="space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-white">1.</span>
              <span>Tap the <Share className="inline w-4 h-4 mx-1" /> Share button</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-white">2.</span>
              <span>Select <strong>"Open in Safari"</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-white">3.</span>
              <span>Then follow the Safari instructions to add to home screen</span>
            </li>
          </ol>
        </div>
      );
    }

    if (browser === 'chrome' && !isIOS) {
      return (
        <div className="space-y-3">
          <p className="text-gray-300 text-sm">To install Veritas on Android:</p>
          <ol className="space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-white">1.</span>
              <span>Tap the <MoreVertical className="inline w-4 h-4 mx-1" /> menu button (three dots) in the top right</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-white">2.</span>
              <span>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-white">3.</span>
              <span>Tap <strong>"Install"</strong></span>
            </li>
          </ol>
        </div>
      );
    }

    // Fallback for other browsers - recommend switching to Safari (iOS) or Chrome (Android)
    if (isIOS) {
      return (
        <div className="space-y-3">
          <p className="text-gray-300 text-sm">To install Veritas, please open this page in Safari.</p>
          <ol className="space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-white">1.</span>
              <span>Copy this page's URL</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-white">2.</span>
              <span>Open Safari and paste the URL</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-white">3.</span>
              <span>Tap the <Share className="inline w-4 h-4 mx-1" /> Share button, then <strong>"Add to Home Screen"</strong></span>
            </li>
          </ol>
        </div>
      );
    }

    // Android fallback - recommend Chrome
    return (
      <div className="space-y-3">
        <p className="text-gray-300 text-sm">To install Veritas, please open this page in Chrome.</p>
        <ol className="space-y-2 text-sm text-gray-300">
          <li className="flex items-start gap-2">
            <span className="font-semibold text-white">1.</span>
            <span>Copy this page's URL</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold text-white">2.</span>
            <span>Open Chrome and paste the URL</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold text-white">3.</span>
            <span>Tap the menu <MoreVertical className="inline w-4 h-4 mx-1" /> and select <strong>"Install app"</strong></span>
          </li>
        </ol>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border-t border-white/10 lg:border lg:rounded-2xl w-full lg:max-w-md mx-auto lg:mx-0 p-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#B9D9EB] rounded-xl flex items-center justify-center">
              <Download className="w-6 h-6 text-[#0C1D51]" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">Install Veritas</h3>
              <p className="text-gray-400 text-sm">Get the full app experience</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Instructions */}
        <div className="mb-6">
          {getInstructions()}
        </div>

        {/* Footer */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white font-medium transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook to detect if app is running as PWA
export function useIsPWA() {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;

    setIsPWA(isStandalone || isIOSStandalone);
  }, []);

  return isPWA;
}

// Hook to manage PWA install prompt
export function usePWAInstallPrompt() {
  const isPWA = useIsPWA();
  const [showPrompt, setShowPrompt] = useState(false);
  const [hasBeenShown, setHasBeenShown] = useState(false);

  useEffect(() => {
    // Don't show if already in PWA mode
    if (isPWA) {
      return;
    }

    // Check if we've shown the prompt in this session
    const shownInSession = sessionStorage.getItem('pwa-prompt-shown');

    if (!shownInSession && !hasBeenShown) {
      // Show prompt after a short delay
      const timer = setTimeout(() => {
        setShowPrompt(true);
        setHasBeenShown(true);
        sessionStorage.setItem('pwa-prompt-shown', 'true');
      }, 2000); // 2 second delay

      return () => clearTimeout(timer);
    }
  }, [isPWA, hasBeenShown]);

  const closePrompt = () => {
    setShowPrompt(false);
  };

  return { showPrompt, closePrompt, isPWA };
}
