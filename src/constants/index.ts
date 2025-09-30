/**
 * Application constants
 */

// Post configuration
// All posts now have beliefs attached (no post types)

// API configuration
export const API_CONFIG = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  BELIEF_HISTORY_LIMIT: 50,
  DEFAULT_DURATION_EPOCHS: 10, // 48h
} as const;

// UI configuration
export const UI_CONFIG = {
  ANIMATION_DURATION: 300,
  TOAST_DURATION: 5000,
  RELEVANCE_MIN: 0,
  RELEVANCE_MAX: 100,
  BELIEF_MIN: 0,
  BELIEF_MAX: 100,
  BELIEF_DEFAULT: 50,
} as const;

// Theme configuration
export const THEME = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;