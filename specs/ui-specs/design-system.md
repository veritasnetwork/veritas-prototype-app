# Veritas Design System Specification v3.0

## Design Philosophy
Clean, minimal, dark design inspired by Substack. Sophisticated use of dark backgrounds with high-contrast white text. Content-first design with generous whitespace, elegant typography, and smooth interactions. Modern, premium aesthetic that reduces eye strain and emphasizes content.

## Color Palette

### Dark Mode (Primary)

#### Backgrounds
- **Background Primary**: `#0f0f0f` - Main app background (very dark, almost black)
- **Background Secondary**: `#1a1a1a` - Elevated surfaces, slightly lighter
- **Background Tertiary**: `#242424` - Cards, elevated components
- **Background Hover**: `#2a2a2a` - Hover states for interactive elements
- **CSS Variables**: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-hover`

#### Text
- **Text Primary**: `#ffffff` - Headings, primary content (pure white, high contrast)
- **Text Secondary**: `#9ca3af` - Supporting text, metadata (gray-400)
- **Text Tertiary**: `#6b7280` - Disabled, placeholders (gray-500)
- **CSS Variables**: `--text-primary`, `--text-secondary`, `--text-tertiary`

#### Accents
- **Accent Primary**: `#60a5fa` - Blue-400 for primary actions, highlights (adjusted for dark bg)
- **Accent Hover**: `#3b82f6` - Blue-500 for hover states
- **Accent Dark**: `#1e40af` - Blue-800 for button backgrounds
- **CSS Variables**: `--accent-primary`, `--accent-hover`, `--accent-dark`

#### Legacy Variables (Deprecated)
- **Eggshell**: `#242424` - Mapped to tertiary background (for backwards compatibility)
- **Eggshell Dark**: `#2a2a2a` - Mapped to hover background
- **CSS Variables**: `--eggshell`, `--eggshell-dark`
- **Note**: These are deprecated and should not be used in new components

#### UI Elements
- **Border**: `#2a2a2a` - Subtle dark borders
- **Border Elevated**: `#404040` - More pronounced borders (gray-700)
- **Success**: `#22c55e` - Success states (green-500, works on dark)
- **Warning**: `#f59e0b` - Warning states (amber-500, works on dark)
- **Error**: `#ef4444` - Error states (red-500, works on dark)
- **CSS Variables**: `--border`, `--border-elevated`, `--success`, `--warning`, `--error`

### Light Mode (Future)
Reserved for future implementation via theme toggle. Dark mode is primary experience.

## Typography

### Font Families
```css
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
--font-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
```

### Type Scale (Optimized for Dark Background)
- **Display**: 48px / 3rem - Hero headings (line-height: 1.1)
- **Headline**: 36px / 2.25rem - Page titles (line-height: 1.2, increased for detail views)
- **Title Large**: 28px / 1.75rem - Feed post titles (line-height: 1.3, increased for prominence)
- **Title**: 24px / 1.5rem - Section headers (line-height: 1.3)
- **Body Large**: 19px / 1.188rem - Detail view content (line-height: 1.8, increased for readability)
- **Body**: 17px / 1.063rem - Feed content preview (line-height: 1.7, increased from 1.6)
- **Body Small**: 14px / 0.875rem - Secondary text (line-height: 1.5)
- **Caption**: 13px / 0.813rem - Metadata, timestamps (line-height: 1.4, slightly larger)

### Font Weights
- **Regular**: 400 - Body text
- **Medium**: 500 - Emphasized text
- **Semibold**: 600 - Subheadings
- **Bold**: 700 - Headings, CTAs

## Spacing System

### Base Unit: 4px
```
--spacing-1: 4px
--spacing-2: 8px
--spacing-3: 12px
--spacing-4: 16px
--spacing-5: 20px
--spacing-6: 24px
--spacing-8: 32px
--spacing-10: 40px
--spacing-12: 48px
--spacing-16: 64px
--spacing-20: 80px
```

## Layout

### Container Widths
- **Feed**: 680px - Main content column
- **Wide**: 1280px - Wide content (future)
- **Full**: 100% - Full width sections

### Grid
- **Columns**: 12-column grid
- **Gutter**: 24px (desktop), 16px (mobile)

### Breakpoints
```css
--mobile: 640px
--tablet: 768px
--desktop: 1024px
--wide: 1280px
```

## Border Radius
```css
--radius-sm: 8px    // Small elements, badges
--radius-md: 12px   // Cards, inputs
--radius-lg: 16px   // Modals, large cards
--radius-xl: 24px   // Hero elements
--radius-full: 9999px // Pills, avatars
```

## Shadows

### Elevation (Subtle for light background)
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);
```

### Hover Effects
- **Lift**: translateY(-2px) + shadow-md
- **Scale**: scale(1.02) + shadow-md

## Transitions

### Durations
```css
--duration-fast: 150ms
--duration-normal: 200ms
--duration-slow: 300ms
```

### Easings
```css
--ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94)
--ease-in: cubic-bezier(0.55, 0.055, 0.675, 0.19)
--ease-in-out: cubic-bezier(0.645, 0.045, 0.355, 1)
```

## Component Patterns

### Card Style (Eggshell elevated surfaces)
```css
background: #F0EAD6;
border: 1px solid #e8e0c8;
box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
```

### Interactive States
- **Hover**: Slight scale or lift + subtle shadow increase
- **Active**: Scale down (0.98) + shadow decrease
- **Focus**: 2px outline with accent color (#B9D9EB)
- **Disabled**: Opacity 0.5

### Loading States
- Skeleton screens (not spinners)
- Pulse animation on skeleton elements
- Use eggshell color for skeleton background

## Z-Index Scale
```css
--z-base: 0
--z-dropdown: 1000
--z-sticky: 1100
--z-modal: 1200
--z-popover: 1300
--z-toast: 1400
```

## Animation Principles
1. **Purposeful**: Every animation should have a clear purpose
2. **Performant**: Use transform and opacity only
3. **Smooth**: 60fps minimum
4. **Respectful**: Respect prefers-reduced-motion
5. **Consistent**: Same durations and easings throughout

## Accessibility

### Minimum Requirements
- **Contrast**: WCAG AA (4.5:1 for body, 3:1 for large text)
  - Black on white: 21:1 ✓
  - Text secondary (#525252) on white: 7.4:1 ✓
- **Touch Targets**: 44x44px minimum
- **Focus Indicators**: Visible and distinct (light blue outline)
- **Motion**: Respect prefers-reduced-motion
- **Screen Readers**: Semantic HTML, ARIA labels where needed

## Icon System
- **Size**: 20px default, 16px small, 24px large
- **Stroke**: 2px stroke width
- **Color**: Default to text color, accent for interactive
- **Library**: Lucide Icons (or similar minimal icon set)
- **Usage**: Icons should always have aria-label or be decorative

## Color Usage Guidelines (Dark Theme)

### Primary Actions
- Use **Blue-400** (#60a5fa) for important CTAs with black text
- Use **Blue-500** (#3b82f6) for hover states
- Buttons should have blue glow shadows for depth

### Backgrounds
- **Very Dark** (#0f0f0f) for main app background
- **Secondary Dark** (#1a1a1a) for cards, elevated surfaces
- **Tertiary Dark** (#242424) for nested components
- Never use pure white backgrounds - always use dark palette

### Accents
- **Blue-400** (#60a5fa) for hover states, selected items, links
- **Blue-500** (#3b82f6) for active states
- Use subtle blue glows (rgba) for depth and emphasis

### Text
- **White** (#ffffff) for primary content (maximum contrast)
- **Gray-400** (#9ca3af) for secondary content (metadata, timestamps)
- **Gray-500** (#6b7280) for tertiary content (placeholders, disabled)
- Ensure minimum 4.5:1 contrast ratio for all body text

### Borders
- Use very subtle borders (#2a2a2a) - barely visible
- Elevated borders (#404040) for more emphasis
- Prefer shadows over borders for depth

## Implementation Notes
- Use Tailwind CSS for rapid development
- Custom CSS variables for theme values (already defined in globals.css)
- CSS Modules for component-specific styles
- Avoid inline styles except for dynamic values
- Test all components on dark background (#0f0f0f) for contrast
- Ensure all text meets WCAG AA standards (4.5:1 for body, 3:1 for large text)
- Use box-shadows generously for depth on dark backgrounds

## Example Component Styles

### Card (Dark Theme)
```css
background-color: var(--bg-secondary); /* #1a1a1a */
border: 1px solid var(--border); /* #2a2a2a */
border-radius: var(--radius-md); /* 12px */
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);

/* Hover */
transform: translateY(-4px);
box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
border-color: var(--border-elevated); /* #404040 */
```

### Primary Button (Dark Theme)
```css
background-color: var(--accent-primary); /* #60a5fa */
color: #000000; /* Black text for high contrast */
border: none;
border-radius: var(--radius-md);
box-shadow: 0 4px 12px rgba(96, 165, 250, 0.3); /* Blue glow */
font-weight: 600;

/* Hover */
background-color: var(--accent-hover); /* #3b82f6 */
box-shadow: 0 6px 16px rgba(96, 165, 250, 0.4);
transform: translateY(-1px);
```

### Secondary Button (Dark Theme)
```css
background-color: transparent;
color: var(--accent-primary); /* #60a5fa */
border: 1px solid var(--accent-primary);
border-radius: var(--radius-md);

/* Hover */
background-color: rgba(96, 165, 250, 0.1); /* Subtle blue tint */
border-color: var(--accent-hover); /* #3b82f6 */
```

### Input Field (Dark Theme)
```css
background-color: var(--bg-tertiary); /* #242424 */
border: 1px solid var(--border); /* #2a2a2a */
border-radius: var(--radius-md);
color: var(--text-primary); /* #ffffff */

/* Focus */
border-color: var(--accent-primary); /* #60a5fa */
box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2); /* Blue glow */
background-color: var(--bg-hover); /* #2a2a2a - slightly lighter */
```
