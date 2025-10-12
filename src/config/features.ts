/**
 * Feature flags for progressive feature rollout
 * All flags default to false for safety
 */

export const FEATURES = {
  // Enable slide-out post detail panel instead of navigation
  POST_DETAIL_PANEL: process.env.NEXT_PUBLIC_USE_POST_PANEL === 'true',

  // Enable unified swap interface instead of separate buy/sell
  UNIFIED_SWAP: process.env.NEXT_PUBLIC_USE_UNIFIED_SWAP === 'true',

  // Enable panel animations (can disable for performance testing)
  PANEL_ANIMATIONS: process.env.NEXT_PUBLIC_PANEL_ANIMATIONS !== 'false',
};

// Debug logging in development
if (process.env.NODE_ENV === 'development') {
  console.log('[FEATURES] Active feature flags:', FEATURES);
}