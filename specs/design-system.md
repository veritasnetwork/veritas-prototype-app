# Veritas Design System Specification

## Brand Colors

### Primary Palette

#### Dark Blue
- **Hex**: `#0C1D51`
- **RGB**: `12, 29, 81`
- **Usage**: Primary brand color, headers, dark backgrounds, emphasis elements
- **CSS Variable**: `--color-dark-blue`

#### Orange
- **Hex**: `#EA900E`
- **RGB**: `234, 144, 14`
- **Usage**: Accent color, CTAs, highlights, interactive elements
- **CSS Variable**: `--color-orange`

#### Light Blue
- **Hex**: `#B9D9EB`
- **RGB**: `185, 217, 235`
- **Usage**: Secondary accent, backgrounds, subtle highlights
- **CSS Variable**: `--color-light-blue`

#### Eggshell
- **Hex**: `#F0EAD6`
- **RGB**: `240, 234, 214`
- **Usage**: Light backgrounds, text on dark backgrounds, soft contrast
- **CSS Variable**: `--color-eggshell`

#### Dark Grey
- **Hex**: `#1A1A1A`
- **RGB**: `26, 26, 26`
- **Usage**: Modern dark backgrounds, primary background color for dark themes
- **CSS Variable**: `--color-dark-grey`

### Color Applications

#### Text Colors
- **Primary Text on Light**: `#0C1D51` (Dark Blue)
- **Primary Text on Dark**: `#F0EAD6` (Eggshell)
- **Secondary Text on Light**: `#4A5568` (Gray-700)
- **Secondary Text on Dark**: `#B9D9EB` (Light Blue)

#### Background Colors
- **Primary Dark Background**: `#1A1A1A` (Dark Grey)
- **Secondary Dark Background**: `#0C1D51` (Dark Blue)
- **Primary Light Background**: `#F0EAD6` (Eggshell)
- **Secondary Light Background**: `#B9D9EB` (Light Blue)
- **Overlay/Glass Effect**: `rgba(12, 29, 81, 0.15)` (Dark Blue with transparency)

#### Interactive States
- **Default**: `#EA900E` (Orange)
- **Hover**: `#D67F0D` (Darker Orange)
- **Active**: `#C26F0C` (Even Darker Orange)
- **Disabled**: `rgba(234, 144, 14, 0.5)` (Orange with 50% opacity)

## Typography

### Font Family
- **Primary Font**: JetBrains Mono
- **Fallback Stack**: `'JetBrains Mono', 'Courier New', monospace`
- **System UI Fallback**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

### Font Weights
- **Light**: 300
- **Regular**: 400
- **Medium**: 500
- **Bold**: 700

### Type Scale
- **Display Large**: 72px / 80px line-height
- **Display**: 60px / 68px line-height
- **Heading 1**: 48px / 56px line-height
- **Heading 2**: 36px / 44px line-height
- **Heading 3**: 30px / 38px line-height
- **Heading 4**: 24px / 32px line-height
- **Body Large**: 18px / 28px line-height
- **Body**: 16px / 24px line-height
- **Body Small**: 14px / 20px line-height
- **Caption**: 12px / 16px line-height

### Responsive Typography
```css
/* Mobile (< 640px) */
--font-display-large: 48px;
--font-display: 40px;
--font-h1: 32px;
--font-h2: 28px;
--font-h3: 24px;

/* Tablet (640px - 1024px) */
--font-display-large: 60px;
--font-display: 48px;
--font-h1: 40px;
--font-h2: 32px;
--font-h3: 28px;

/* Desktop (> 1024px) */
--font-display-large: 72px;
--font-display: 60px;
--font-h1: 48px;
--font-h2: 36px;
--font-h3: 30px;
```

## Spacing System

### Base Unit
- **Base**: 4px
- **Scale**: 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 128

### Component Spacing
- **Extra Small (xs)**: 4px
- **Small (sm)**: 8px
- **Medium (md)**: 16px
- **Large (lg)**: 24px
- **Extra Large (xl)**: 32px
- **2X Large (2xl)**: 48px
- **3X Large (3xl)**: 64px

## Border & Radius

### Border Width
- **Thin**: 1px
- **Default**: 2px
- **Thick**: 4px

### Border Radius
- **Small**: 4px
- **Medium**: 8px
- **Large**: 16px
- **Extra Large**: 24px
- **Full**: 9999px

## Shadows

### Elevation Levels
```css
/* Level 1 - Subtle */
box-shadow: 0 1px 3px rgba(12, 29, 81, 0.1);

/* Level 2 - Small */
box-shadow: 0 4px 6px rgba(12, 29, 81, 0.1);

/* Level 3 - Medium */
box-shadow: 0 10px 15px rgba(12, 29, 81, 0.1);

/* Level 4 - Large */
box-shadow: 0 20px 25px rgba(12, 29, 81, 0.15);

/* Level 5 - Extra Large */
box-shadow: 0 25px 50px rgba(12, 29, 81, 0.25);

/* Glow Effect */
box-shadow: 0 0 50px rgba(234, 144, 14, 0.3);
```

## Animation & Transitions

### Duration
- **Fast**: 150ms
- **Normal**: 300ms
- **Slow**: 500ms
- **Extra Slow**: 1000ms

### Easing Functions
- **Default**: `cubic-bezier(0.4, 0, 0.2, 1)`
- **Ease In**: `cubic-bezier(0.4, 0, 1, 1)`
- **Ease Out**: `cubic-bezier(0, 0, 0.2, 1)`
- **Ease In Out**: `cubic-bezier(0.4, 0, 0.2, 1)`
- **Spring**: `cubic-bezier(0.68, -0.55, 0.265, 1.55)`

## Gradients

### Primary Gradients
```css
/* Orange to Dark Blue */
background: linear-gradient(135deg, #EA900E 0%, #0C1D51 100%);

/* Light Blue to Eggshell */
background: linear-gradient(180deg, #B9D9EB 0%, #F0EAD6 100%);

/* Radial Glow */
background: radial-gradient(circle at 50% 50%, rgba(234, 144, 14, 0.3) 0%, transparent 70%);
```

## Glass Morphism

### Standard Glass Effect
```css
background: rgba(12, 29, 81, 0.15);
backdrop-filter: blur(12px);
border: 1px solid rgba(240, 234, 214, 0.2);
```

### Light Glass Effect
```css
background: rgba(240, 234, 214, 0.1);
backdrop-filter: blur(8px);
border: 1px solid rgba(12, 29, 81, 0.1);
```

## Breakpoints

### Screen Sizes
- **Mobile**: 0 - 639px
- **Tablet**: 640px - 1023px
- **Desktop**: 1024px - 1279px
- **Large Desktop**: 1280px+

### Container Max Widths
- **Small**: 640px
- **Medium**: 768px
- **Large**: 1024px
- **Extra Large**: 1280px
- **2X Large**: 1536px

## Accessibility

### Color Contrast
- **AA Normal Text**: 4.5:1 minimum
- **AA Large Text**: 3:1 minimum
- **AAA Normal Text**: 7:1 minimum
- **AAA Large Text**: 4.5:1 minimum

### Focus States
```css
outline: 2px solid #EA900E;
outline-offset: 2px;
```

### Motion Preferences
```css
@media (prefers-reduced-motion: reduce) {
  /* Disable animations */
  animation: none !important;
  transition: none !important;
}
```

## Implementation Notes

### CSS Custom Properties
```css
:root {
  /* Colors */
  --color-dark-blue: #0C1D51;
  --color-orange: #EA900E;
  --color-light-blue: #B9D9EB;
  --color-eggshell: #F0EAD6;
  --color-dark-grey: #1A1A1A;
  
  /* Font */
  --font-primary: 'JetBrains Mono', monospace;
  
  /* Spacing */
  --space-unit: 4px;
  
  /* Transitions */
  --transition-normal: 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Tailwind Config Extension
```javascript
theme: {
  extend: {
    colors: {
      'veritas-dark-blue': '#0C1D51',
      'veritas-orange': '#EA900E',
      'veritas-light-blue': '#B9D9EB',
      'veritas-eggshell': '#F0EAD6',
      'veritas-dark-grey': '#1A1A1A',
    },
    fontFamily: {
      'mono': ['JetBrains Mono', 'monospace'],
    }
  }
}
```

---

This design system ensures consistency across the Veritas platform while maintaining accessibility and performance standards.