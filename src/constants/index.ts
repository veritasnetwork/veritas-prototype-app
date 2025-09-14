/**
 * Application constants
 */

// Post types
export const POST_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  LONGFORM: 'longform',
  OPINION: 'opinion',
} as const;

// API configuration
export const API_CONFIG = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  OPINION_HISTORY_LIMIT: 50,
} as const;

// UI configuration
export const UI_CONFIG = {
  ANIMATION_DURATION: 300,
  TOAST_DURATION: 5000,
  RELEVANCE_MIN: 0,
  RELEVANCE_MAX: 100,
  OPINION_MIN: 0,
  OPINION_MAX: 100,
  OPINION_DEFAULT: 50,
} as const;

// Theme configuration
export const THEME = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;