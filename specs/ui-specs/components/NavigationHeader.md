# Navigation Header Component Specification

## Purpose
Sticky top navigation bar providing branding, navigation, and user access across the entire application.

## Visual Design

### Layout
```
┌─────────────────────────────────────────────────────────┐
│  [VERITAS Logo]                    [@username Avatar]   │
│  └─ Click → /feed                  └─ Click → /profile  │
└─────────────────────────────────────────────────────────┘
```

### Dimensions
- **Height**: 64px
- **Padding**: 24px horizontal, 12px vertical
- **Max Width**: 100% (full width sticky bar)
- **Inner Content**: Max-width 680px, centered

### Styling
- **Background**: Glassmorphism effect
  - `background: rgba(10, 10, 10, 0.8)`
  - `backdrop-filter: blur(20px)`
  - `border-bottom: 1px solid rgba(255, 255, 255, 0.05)`
- **Position**: `position: sticky`, `top: 0`, `z-index: var(--z-sticky)`
- **Shadow**: `box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3)` on scroll

## Components

### Logo Section (Left)
- **VERITAS** wordmark
- **Font**: Bold, 18px, tracking-wider
- **Color**: `var(--text-primary)` (#ffffff)
- **Icon**: Optional small logo icon (20x20px) to the left
- **Interactive**:
  - Cursor: pointer
  - Hover: opacity 0.8
  - Click: Navigate to /feed

### Profile Section (Right)
- **Avatar**:
  - Size: 40x40px
  - Border-radius: 9999px (full circle)
  - Border: 2px solid transparent
  - Hover: Border 2px solid `var(--accent-primary)`
  - Click: Navigate to /profile
- **Username** (optional, desktop only):
  - Font: Medium, 14px
  - Color: `var(--text-secondary)`
  - Display: `@username`
  - Margin-right: 8px from avatar

## States

### Default
- Clean, minimal appearance
- Logo and avatar visible

### Scrolled (>50px)
- Add shadow: `var(--shadow-md)`
- Increase blur slightly if supported

### Loading (User not yet loaded)
- Show skeleton avatar (pulsing circle)
- Logo remains static

## Responsive Behavior

### Desktop (>768px)
- Show username + avatar
- Full logo with icon

### Mobile (<768px)
- Avatar only (no username text)
- Compact logo (icon only or shorter wordmark)

## Accessibility
- **Semantic**: `<header>` with `<nav>` role
- **Logo**: Clickable with aria-label="Navigate to feed"
- **Avatar**: Button with aria-label="View profile"
- **Keyboard**: Tab navigation between logo and avatar
- **Focus**: Clear focus ring on both elements

## Interactions
- **Logo Click**: `router.push('/feed')`
- **Avatar Click**: `router.push('/profile')`
- **Hover**: Smooth opacity/border transitions (200ms)

## Data Requirements
- **User Data**:
  - `username` - Display in header
  - `avatar_url` or generated avatar based on user ID
  - Fetched from `useAuth()` context

## Implementation Notes
- Component: `<NavigationHeader />`
- Location: `src/components/layout/NavigationHeader.tsx`
- Usage: Rendered in root layout for all authenticated pages
- No navigation needed on landing page (unauthenticated)

## Edge Cases
- **No avatar**: Use generated avatar (initials or default)
- **Long username**: Truncate with ellipsis on mobile
- **Logout state**: Header should not render if not authenticated
