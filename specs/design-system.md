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

##### Light Mode
- **Primary Text**: `#0C1D51` (Dark Blue) - Main text color
- **Secondary Text**: `rgba(12, 29, 81, 0.7)` (Dark Blue 70% opacity)
- **Tertiary Text**: `rgba(12, 29, 81, 0.6)` (Dark Blue 60% opacity)
- **Hero/Image Overlay Text**: `#F0EAD6` (Eggshell) - Always eggshell for readability

##### Dark Mode
- **Primary Text**: `#F0EAD6` (Eggshell) - Main text color
- **Secondary Text**: `rgba(240, 234, 214, 0.7)` (Eggshell 70% opacity)
- **Tertiary Text**: `rgba(240, 234, 214, 0.6)` (Eggshell 60% opacity)
- **Hero/Image Overlay Text**: `#F0EAD6` (Eggshell) - Consistent in both modes

##### Universal
- **Accent Text**: `#EA900E` (Orange) - For highlights and emphasis
- **Interactive Text**: `#B9D9EB` (Light Blue) - For links and special buttons

#### Background Colors

##### Light Mode
- **Primary Background**: `#FFFFFF` (White) - Main site background
- **Secondary Background**: `bg-slate-50` - Cards and sections
- **Navbar**: `bg-gradient-to-r from-slate-50/95 to-blue-50/95` with backdrop blur
- **Hover States**: `hover:bg-slate-100`

##### Dark Mode
- **Primary Background**: `#050A1A` (Darker Blue) - Main site background
- **Secondary Background**: `rgba(5, 10, 26, 0.95)` - Navbar and overlays
- **Glass Effect**: `rgba(240, 234, 214, 0.05)` - Card backgrounds
- **Component Backgrounds**: `bg-veritas-darker-blue/60` to `/80` for varying depths
- **Hover States**: `hover:bg-veritas-eggshell/5` - Subtle interactive hover

#### Interactive States

##### Buttons
- **Login/Primary Buttons**:
  - Light Mode: `bg-veritas-primary text-white`
  - Dark Mode: `bg-veritas-light-blue text-veritas-darker-blue`
  - Hover: Scale and shadow effects

- **Secondary Buttons**:
  - Default: Border-based with transparent background
  - Hover: Filled background with inverted text color

##### Links
- **Light Mode**: `text-veritas-primary` → hover: darker shade
- **Dark Mode**: `text-veritas-eggshell/70` → hover: full opacity

##### Disabled States
- Light Mode: `text-veritas-primary/30`
- Dark Mode: `text-veritas-eggshell/30`

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
  - Light Mode: `border-slate-200` - Standard dividers
  - Dark Mode: `border-veritas-eggshell/10` - Subtle dividers
  - Dark Mode: `border-veritas-eggshell/20` - Visible dividers
- **Border Width**: `border` (1px) for cards, `border-2` (2px) for emphasis
- **Dividers**: `w-px` (1px width) or `h-px` (1px height)
- **Special**: Connected dropdown design with conditional border radius

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

### Navigation Components

#### FeedNav & Navbar
- **Light Mode Background**: `bg-gradient-to-r from-slate-50/95 to-blue-50/95`
- **Dark Mode Background**: `bg-veritas-darker-blue/95` with backdrop blur
- **Text**: Standard text color scheme (dark blue/eggshell)
- **Logo**: Simple text styling without background container
- **Typography**: `font-mono uppercase`

#### Sort Dropdown
- **Connected Design**: Rounded top when open, seamless connection to dropdown
- **Open State**: `rounded-t-2xl bg-gray-50 dark:bg-veritas-eggshell/10`
- **Closed State**: `rounded-2xl hover:scale-105`
- **Width**: Fixed `w-44` to prevent text cutoff

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

### Graph and Chart Styling

#### Standard Charts (ChartComponent)
- **Light Mode**: Lines/bars use `#0C1D51` (Dark Blue)
- **Dark Mode**: Lines/bars use `#F0EAD6` (Eggshell)
- **Dynamic color detection**: Uses MutationObserver to detect theme changes
- **Axis text**: `text-veritas-primary/60 dark:text-veritas-eggshell/60`
- **Tooltips**: Custom styled with theme-aware backgrounds

#### Intelligence Evolution (Multi-colored)
- **Truth Score**: 
  - Light Mode: `#0C1D51` (Dark Blue)
  - Dark Mode: `#B9D9EB` (Light Blue)
- **Relevance Score**: `#EA900E` (Orange) - consistent in both modes
- **Informativeness**: `#F0EAD6` (Eggshell) - consistent in both modes
- **Icon Backgrounds**: Solid colors matching chart colors
- **Main Section Icon**: 
  - Light Mode: White icon on dark blue background
  - Dark Mode: Dark blue icon on eggshell background

### Logo Implementation

#### Logo Styling Guidelines
- **Simple Text**: `VERITAS` in uppercase, no background container
- **Typography**: `font-mono uppercase tracking-wider`
- **Text Color**: Follows standard text color scheme
- **Footer Logo**: Located at `/icons/logo.png`
- **Size**: Responsive sizing with Tailwind classes

### Component-Specific Implementations

#### BeliefCard
- **Feed Variant**: Glassmorphism with hover effects
- **News Variant**: Image overlay with eggshell text
- **Grid View**: Removed unnecessary headings
- **Divider**: `border-veritas-eggshell/20` in dark mode

#### BeliefDetailPage
- **Hero Text**: Always eggshell for image overlays
- **Breadcrumbs**: Standard text color scheme
- **Components**: HeadingComponent, ArticleComponent, ChartComponent all follow text scheme
- **Related Beliefs**: Card-based with hover effects

#### PremierHeader
- **Category Badge**: Matches login button styling
- **Hero Overlay**: Text always eggshell
- **Image Gradient**: Maintains readability

#### Footer
- **Background**: Solid dark blue, no gradients
- **Text**: Eggshell with opacity variations
- **Links**: Hover effects with full opacity

### Implementation Best Practices

#### Color Usage
1. **Text on Images**: Always use eggshell for readability
2. **Interactive Elements**: Use consistent hover states
3. **Opacity Levels**: 60%, 70%, 80% for text hierarchy
4. **Borders**: 10%, 20% opacity for subtle/visible dividers

#### Dark Mode Transitions
1. **Gradients**: Neutralize with `dark:from-transparent dark:to-transparent`
2. **Backgrounds**: Use `/60` to `/80` opacity for depth
3. **Hover States**: Subtle with `/5` opacity changes

#### Responsive Design
1. **Mobile First**: Base styles, then breakpoint enhancements
2. **Typography**: Scale appropriately with screen size
3. **Spacing**: Adjust padding/margins for mobile

---

This design system reflects the complete implementation of the Veritas branding across the application, with careful attention to light/dark mode transitions, accessibility, and visual consistency. The system emphasizes clean, professional aesthetics with the monospace JetBrains Mono font and a carefully curated color palette that works harmoniously in both light and dark themes.