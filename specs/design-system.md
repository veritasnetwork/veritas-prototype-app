# Veritas Design System Specification

## Brand Colors

### Primary Palette

#### Dark Blue
- **Hex**: `#0C1D51`
- **RGB**: `12, 29, 81`
- **Usage**: Primary brand color, headers, dark backgrounds, emphasis elements
- **CSS Variable**: `--color-dark-blue`
- **Tailwind Class**: `veritas-dark-blue`

#### Darker Blue (Almost Black)
- **Hex**: `#050A1A`
- **RGB**: `5, 10, 26`
- **Usage**: Primary background color, navbar backgrounds, deepest sections
- **CSS Variable**: `--color-darker-blue`
- **Tailwind Class**: `veritas-darker-blue`
- **Implementation Note**: This is the main background color used throughout the site

#### Orange
- **Hex**: `#EA900E`
- **RGB**: `234, 144, 14`
- **Usage**: Accent color, CTAs, highlights, interactive elements, timeline markers
- **CSS Variable**: `--color-orange`
- **Tailwind Class**: `veritas-orange`

#### Light Blue
- **Hex**: `#B9D9EB`
- **RGB**: `185, 217, 235`
- **Usage**: Secondary accent, button borders, link colors
- **CSS Variable**: `--color-light-blue`
- **Tailwind Class**: `veritas-light-blue`

#### Eggshell
- **Hex**: `#F0EAD6`
- **RGB**: `240, 234, 214`
- **Usage**: Primary text color on dark backgrounds, UI elements
- **CSS Variable**: `--color-eggshell`
- **Tailwind Class**: `veritas-eggshell`

#### Dark Grey
- **Hex**: `#1A1A1A`
- **RGB**: `26, 26, 26`
- **Usage**: Alternative dark backgrounds (less used than darker-blue)
- **CSS Variable**: `--color-dark-grey`
- **Tailwind Class**: `veritas-dark-grey`

### Legacy Cosmic Colors (Being Phased Out)

#### Cosmic Palette
- **Cosmic Gold**: `#FF8C42` - Legacy glow effects
- **Cosmic Amber**: `#FFB366` - Legacy animations
- **Cosmic Blue**: `#0096C7` - Legacy accent
- **Cosmic Cyan**: `#00C9FF` - Legacy glow
- **Cosmic Bright Cyan**: `#00F5FF` - Legacy bright accent
- **Cosmic Deep Purple**: `#1A0B3D` - Legacy dark
- **Cosmic Dark Purple**: `#0D0221` - Legacy darkest

### Color Applications

#### Text Colors
- **Primary Text on Dark**: `#F0EAD6` (Eggshell) - Used for all main text
- **Secondary Text on Dark**: `rgba(240, 234, 214, 0.7)` (Eggshell 70% opacity)
- **Tertiary Text on Dark**: `rgba(240, 234, 214, 0.4)` (Eggshell 40% opacity)
- **Accent Text**: `#EA900E` (Orange) - For highlights and emphasis
- **Interactive Text**: `#B9D9EB` (Light Blue) - For links and buttons

#### Background Colors
- **Primary Background**: `#050A1A` (Darker Blue) - Main site background
- **Secondary Background**: `rgba(5, 10, 26, 0.95)` - Navbar and overlays
- **Glass Effect**: `rgba(240, 234, 214, 0.05)` - Card backgrounds
- **Hover States**: `rgba(240, 234, 214, 0.1)` - Interactive hover

#### Interactive States
- **Button Default**: Border `#B9D9EB`, Text `#B9D9EB`
- **Button Hover**: Background `#B9D9EB`, Text `#0C1D51`
- **Link Default**: `#F0EAD6` with 70% opacity
- **Link Hover**: `#F0EAD6` with 100% opacity
- **Disabled**: `rgba(240, 234, 214, 0.3)` (Eggshell with 30% opacity)

## Typography

### Font Family
- **Primary Font**: JetBrains Mono (loaded via @font-face)
- **Fallback Stack**: `'JetBrains Mono', monospace`
- **CSS Variable**: `--font-primary`
- **Tailwind Classes**: `font-mono`, `font-jetbrains`

### Font Weights Available
- **Thin**: 100
- **Extra Light**: 200
- **Light**: 300
- **Regular**: 400
- **Medium**: 500
- **Semibold**: 600
- **Bold**: 700
- **Extra Bold**: 800

### Font Weights Used
- **Body Text**: 400 (Regular)
- **Emphasized Text**: 500 (Medium)
- **Headers**: 600-700 (Semibold to Bold)
- **Buttons/Navigation**: 600 (Semibold)

### Type Scale (Tailwind Classes)
- **Display**: `text-4xl` to `text-6xl` (36px-60px)
- **Heading Large**: `text-3xl` to `text-4xl` (30px-36px) 
- **Heading Medium**: `text-xl` to `text-2xl` (20px-24px)
- **Heading Small**: `text-lg` to `text-xl` (18px-20px)
- **Body Large**: `text-lg` (18px) - Used for emphasized content
- **Body**: `text-base` (16px) - Default body text
- **Body Small**: `text-sm` (14px) - Secondary text
- **Caption**: `text-xs` (12px) - Smallest text
- **Tiny**: `text-[10px]` to `text-[11px]` - Mobile footer text

### Responsive Typography Implementation
- **Mobile First Approach**: Base sizes with `sm:`, `md:`, `lg:` modifiers
- **Common Patterns**:
  - Headers: `text-sm sm:text-base md:text-lg lg:text-xl`
  - Body: `text-base sm:text-lg`
  - Captions: `text-xs sm:text-sm`

### Text Styling
- **Letter Spacing**: `tracking-wider` for uppercase text
- **Text Transform**: `uppercase` for headers and navigation
- **Line Height**: `leading-relaxed` (1.625) for body text
- **Font Features**: Ligatures enabled via CSS

## Spacing System

### Tailwind Spacing Classes Used
- **Padding**: `p-2` (8px) to `p-12` (48px)
- **Common Padding**: `p-4` (16px), `p-6` (24px), `p-8` (32px)
- **Mobile Padding**: `p-3` (12px), `px-4` (16px horizontal)
- **Section Spacing**: `py-16` to `py-32`
- **Gap Spacing**: `gap-2` (8px) to `gap-8` (32px)
- **Space Between**: `space-x-2`, `space-y-6`

### Common Spacing Patterns
- **Card Padding**: `p-6 md:p-8` or `p-8 md:p-12`
- **Button Padding**: `px-6 py-2.5` or `px-8 py-4`
- **Section Margins**: `mb-16 md:mb-24`
- **Icon Spacing**: `space-x-2` or `space-x-3`

## Border & Radius

### Border Implementation
- **Border Colors**: 
  - `border-veritas-light-blue` - Interactive elements
  - `border-veritas-eggshell/10` - Subtle dividers
  - `border-veritas-eggshell/20` - Visible dividers
- **Border Width**: `border-2` (2px) for buttons and emphasis
- **Dividers**: `w-px` (1px width) or `h-px` (1px height)

### Border Radius Used
- **Buttons**: `rounded-full` - Pill-shaped buttons
- **Cards**: `rounded-xl` or `rounded-2xl` 
- **Navbar Elements**: `rounded-full` with conditional rounding
- **Dropdowns**: `rounded-b-2xl` for bottom rounding
- **Small Elements**: `rounded` (4px default)

## Visual Effects

### Glass Morphism (Primary Card Style)
```css
background: rgba(240, 234, 214, 0.05);
backdrop-filter: blur(12px);
border: 1px solid rgba(240, 234, 214, 0.2);
```

### Glow Effects
- **Blue Glow**: Used in hero text
  ```css
  text-shadow: 
    0 0 20px var(--glow-blue),
    0 0 40px rgba(0, 201, 255, 0.6),
    0 0 60px rgba(255, 140, 66, 0.4);
  ```
- **Gold Glow**: Secondary text elements
  ```css
  text-shadow: 
    0 0 10px var(--glow-gold),
    0 0 20px rgba(0, 201, 255, 0.4);
  ```

### Backdrop Blur
- **Standard**: `backdrop-blur-md` (12px)
- **Navigation**: Combined with semi-transparent backgrounds

## Animation & Transitions

### Transition Classes
- **Colors**: `transition-colors duration-300`
- **All Properties**: `transition-all duration-300`
- **Transform**: `transition-transform duration-300 ease`
- **Navbar**: `duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]`

### Custom Animations
- **Pulse Slow**: 
  ```css
  @keyframes pulse-slow {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
  }
  animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  ```

### Mobile Optimizations
- **Disabled Animations**: Complex animations disabled on mobile
- **Simple Fade**: `mobileFadeIn` for mobile-specific animations
- **Touch Scrolling**: `-webkit-overflow-scrolling: touch`

## Scrollbar Styling
```css
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: rgba(139, 92, 246, 0.5) rgba(255, 255, 255, 0.05);
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.5);
  border-radius: 4px;
}
```

## Selection Color
```css
::selection {
  background: rgba(139, 92, 246, 0.3);
  color: white;
}
```

## Responsive Design

### Breakpoints (Tailwind Default)
- **sm**: 640px (Tablet)
- **md**: 768px (Small Desktop)
- **lg**: 1024px (Desktop)
- **xl**: 1280px (Large Desktop)
- **2xl**: 1536px (Extra Large)

### Mobile-First Implementation
- Base styles target mobile
- Progressive enhancement with breakpoint prefixes
- Mobile-specific components (MobileHeroSection, MobileNarrativeSection)

### Mobile Optimizations
- Disabled sticky positioning
- Simplified animations
- Removed parallax effects
- Touch-optimized scrolling
- Hardware acceleration for smooth performance

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

## Implementation Details

### CSS Custom Properties (globals.css)
```css
:root {
  /* Brand Colors */
  --color-dark-blue: #0C1D51;
  --color-darker-blue: #050A1A;
  --color-orange: #EA900E;
  --color-light-blue: #B9D9EB;
  --color-eggshell: #F0EAD6;
  
  /* Legacy Cosmic Colors */
  --cosmic-gold: #FF8C42;
  --cosmic-amber: #FFB366;
  --cosmic-blue: #0096C7;
  --cosmic-cyan: #00C9FF;
  --cosmic-bright-cyan: #00F5FF;
  --cosmic-deep-purple: #1A0B3D;
  --cosmic-dark-purple: #0D0221;
  
  /* Glow Colors */
  --glow-gold: rgba(255, 215, 0, 0.8);
  --glow-blue: rgba(0, 201, 255, 0.8);
  --glow-white: rgba(255, 255, 255, 0.9);
  
  /* Font */
  --font-primary: 'JetBrains Mono', monospace;
  
  /* Background */
  --foreground-rgb: 255, 255, 255;
  --background-start-rgb: 5, 10, 26;
  --background-end-rgb: 5, 10, 26;
}
```

### Tailwind Config (tailwind.config.js)
```javascript
theme: {
  extend: {
    colors: {
      veritas: {
        'dark-blue': '#0C1D51',
        'darker-blue': '#050A1A',
        'orange': '#EA900E',
        'light-blue': '#B9D9EB',
        'eggshell': '#F0EAD6',
        'dark-grey': '#1A1A1A',
      }
    },
    fontFamily: {
      'mono': ['JetBrains Mono', 'monospace'],
      'jetbrains': ['JetBrains Mono', 'monospace'],
    }
  }
}
```

## Component Patterns

### Navigation (DockNavbar)
- **Background**: `rgba(5, 10, 26, 0.95)` with backdrop blur
- **Text**: Eggshell with hover states
- **Hover**: `hover:bg-[#f0ead6]/10`
- **Border Radius**: Dynamic based on state
- **Typography**: `font-mono uppercase text-sm`

### Cards
- **Standard Card**:
  ```css
  background: rgba(240, 234, 214, 0.05);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(240, 234, 214, 0.2);
  border-radius: 1rem; /* rounded-2xl */
  ```
- **Padding**: `p-6` to `p-8` (responsive)
- **Text**: Eggshell with various opacities

### Buttons
- **Primary Style**: 
  - Border: `border-2 border-veritas-light-blue`
  - Text: `text-veritas-light-blue`
  - Hover: `hover:bg-veritas-light-blue hover:text-veritas-dark-blue`
  - Shape: `rounded-full`
  - Padding: `px-8 py-4`

### Timeline Components
- **Markers**: Orange circles with glow effect
- **Lines**: Vertical with gradient fade
- **Cards**: Glass morphism with responsive padding

## Accessibility Considerations

### Color Contrast
- Eggshell (#F0EAD6) on Darker Blue (#050A1A): **15.4:1** ✓ AAA
- Light Blue (#B9D9EB) on Darker Blue (#050A1A): **11.2:1** ✓ AAA
- Orange (#EA900E) on Darker Blue (#050A1A): **6.8:1** ✓ AA

### Focus States
- Not explicitly defined in current implementation
- Recommendation: Add focus-visible states for keyboard navigation

### Motion Preferences
- Mobile: Animations simplified or disabled
- Desktop: Full animations with performance optimizations
- Smooth scroll with `scroll-behavior: smooth`

## Performance Optimizations

### Mobile-Specific
- Separate mobile components (MobileHeroSection, MobileNarrativeSection)
- Disabled sticky positioning and parallax
- Simplified animations
- Touch-optimized scrolling

### General
- Hardware acceleration via transform3d
- Will-change used sparingly
- Throttled scroll handlers
- Lazy loading for heavy components

## File Structure

### Style Files
- `/src/app/globals.css` - Global styles, font faces, CSS variables
- `/tailwind.config.js` - Tailwind configuration and extensions
- Component-specific styles inline using Tailwind classes

### Key Components
- `/src/components/common/DockNavbar.tsx` - Main navigation
- `/src/components/hero/HeroSection.tsx` - Hero with globe
- `/src/components/narrative/NarrativeSection.tsx` - Story sections
- `/src/components/sections/FinalSection.tsx` - CTA section
- `/src/components/common/VeritasFooter.tsx` - Footer

---

This design system reflects the actual implementation of the Veritas landing page, emphasizing dark themes, glass morphism effects, and monospace typography for a technical, futuristic aesthetic.