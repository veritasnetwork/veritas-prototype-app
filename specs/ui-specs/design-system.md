# Veritas Design System Specification v2.0

## Design Philosophy
Clean, minimal, light design inspired by Spotify and Apple. Sophisticated use of white space with subtle color accents. Light-first design with elegant typography and smooth interactions.

## Color Palette

### Light Mode (Primary)

#### Backgrounds
- **Background Primary**: `#ffffff` - Main app background (pure white)
- **Background Secondary**: `#F0EAD6` - Eggshell for elevated surfaces, subtle sections
- **Background Hover**: `#f8f8f8` - Hover states for interactive elements
- **CSS Variables**: `--bg-primary`, `--bg-secondary`, `--bg-hover`

#### Text
- **Text Primary**: `#000000` - Headings, primary content (pure black)
- **Text Secondary**: `#525252` - Supporting text, metadata (neutral-600)
- **Text Tertiary**: `#a3a3a3` - Disabled, placeholders (neutral-400)
- **CSS Variables**: `--text-primary`, `--text-secondary`, `--text-tertiary`

#### Accents
- **Accent Primary**: `#B9D9EB` - Light blue for primary actions, highlights
- **Accent Hover**: `#a3cfe3` - Darker light blue for hover states
- **Accent Dark**: `#0C1D51` - Dark blue for strong CTAs and emphasis
- **CSS Variables**: `--accent-primary`, `--accent-hover`, `--accent-dark`

#### Eggshell Accent
- **Eggshell**: `#F0EAD6` - Warm accent for cards, backgrounds, subtle highlights
- **Eggshell Dark**: `#e8e0c8` - Slightly darker for borders/hover
- **CSS Variables**: `--eggshell`, `--eggshell-dark`

#### UI Elements
- **Border**: `#e5e5e5` - Subtle borders (neutral-200)
- **Border Elevated**: `#d4d4d4` - More pronounced borders (neutral-300)
- **Success**: `#22c55e` - Success states (green-500)
- **Warning**: `#f59e0b` - Warning states (amber-500)
- **Error**: `#ef4444` - Error states (red-500)
- **CSS Variables**: `--border`, `--border-elevated`, `--success`, `--warning`, `--error`

### Dark Mode (Future)
Reserved for future implementation. Light mode is primary experience.

## Typography

### Font Families
```css
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
--font-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
```

### Type Scale
- **Display**: 48px / 3rem - Hero headings (line-height: 1.1)
- **Headline**: 32px / 2rem - Page titles (line-height: 1.2)
- **Title**: 24px / 1.5rem - Section headers (line-height: 1.3)
- **Body Large**: 18px / 1.125rem - Emphasized body (line-height: 1.5)
- **Body**: 16px / 1rem - Default body (line-height: 1.6)
- **Body Small**: 14px / 0.875rem - Secondary text (line-height: 1.5)
- **Caption**: 12px / 0.75rem - Metadata, timestamps (line-height: 1.4)

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

## Color Usage Guidelines

### Primary Actions
- Use **Dark Blue** (#0C1D51) for important CTAs
- Use **Light Blue** (#B9D9EB) for secondary actions and highlights

### Backgrounds
- **White** for main app background
- **Eggshell** (#F0EAD6) for cards, elevated surfaces
- Never use pure gray - prefer eggshell for warmth

### Accents
- **Light Blue** (#B9D9EB) for hover states, selected items
- **Eggshell** (#F0EAD6) for subtle backgrounds, cards

### Text
- **Black** for primary content (high contrast)
- **Gray** (#525252) for secondary content
- Never use pure black on pure black (avoid harsh contrast)

## Implementation Notes
- Use Tailwind CSS for rapid development
- Custom CSS variables for theme values
- CSS Modules for component-specific styles
- Avoid inline styles except for dynamic values
- Test all components on white background for contrast
- Ensure eggshell cards stand out subtly from white background

## Example Component Styles

### Card
```css
background-color: var(--eggshell); /* #F0EAD6 */
border: 1px solid var(--eggshell-dark); /* #e8e0c8 */
border-radius: var(--radius-md); /* 12px */
box-shadow: var(--shadow-sm);
```

### Primary Button
```css
background-color: var(--accent-dark); /* #0C1D51 */
color: white;
border: none;
border-radius: var(--radius-md);
box-shadow: var(--shadow-sm);

/* Hover */
background-color: #0f2666; /* Slightly lighter */
box-shadow: var(--shadow-md);
transform: translateY(-1px);
```

### Secondary Button
```css
background-color: var(--accent-primary); /* #B9D9EB */
color: var(--accent-dark); /* #0C1D51 */
border: 1px solid var(--accent-hover);
border-radius: var(--radius-md);
```

### Input Field
```css
background-color: white;
border: 1px solid var(--border); /* #e5e5e5 */
border-radius: var(--radius-md);
color: var(--text-primary);

/* Focus */
border-color: var(--accent-primary); /* #B9D9EB */
outline: 2px solid var(--accent-primary);
outline-offset: 2px;
```
