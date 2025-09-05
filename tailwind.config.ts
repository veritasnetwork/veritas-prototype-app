import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/contexts/**/*.{js,ts,jsx,tsx,mdx}',
    './src/hooks/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      // Veritas Color Scheme - Updated with design spec
      colors: {
        veritas: {
          'dark-blue': '#0C1D51',     // Primary Dark Blue
          'darker-blue': '#050A1A',   // Main background color
          'orange': '#EA900E',        // Primary Orange
          'light-blue': '#B9D9EB',    // Supporting Light Blue
          'eggshell': '#F0EAD6',      // Supporting Eggshell
          'dark-grey': '#1A1A1A',     // Modern Dark Background
          // Legacy colors for backward compatibility
          'primary': '#0C1D51',
          'secondary': '#EA900E',
          'slate-blue': '#2D4A6B',
          'golden-yellow': '#FFB800',
          'muted-gold': '#D4A574',
        },
        // Quick access aliases
        'veritas-dark-blue': '#0C1D51',
        'veritas-darker-blue': '#050A1A',
        'veritas-orange': '#EA900E',
        'veritas-light-blue': '#B9D9EB',
        'veritas-eggshell': '#F0EAD6',
        'veritas-dark-grey': '#1A1A1A',
        // Legacy aliases
        'veritas-primary': '#0C1D51',
        'veritas-secondary': '#EA900E',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        'card-foreground': 'var(--card-foreground)',
        popover: 'var(--popover)',
        'popover-foreground': 'var(--popover-foreground)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        secondary: 'var(--secondary)',
        'secondary-foreground': 'var(--secondary-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        accent: 'var(--accent)',
        'accent-foreground': 'var(--accent-foreground)',
        destructive: 'var(--destructive)',
        'destructive-foreground': 'var(--destructive-foreground)',
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
      },
      
      // Premium Typography
      fontFamily: {
        'sans': ['JetBrains Mono', 'monospace'],
        'mono': ['JetBrains Mono', 'monospace'],
        'jetbrains': ['JetBrains Mono', 'monospace'],
        'inter': ['Inter', 'system-ui', 'sans-serif'], // Keep Inter as fallback option
      },
      
      // Premium Spacing
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      
      // Premium Border Radius
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      
      // Premium Shadows
      boxShadow: {
        'premium': '0 10px 40px -10px rgba(234, 144, 14, 0.3)',
        'premium-dark': '0 10px 40px -10px rgba(12, 29, 81, 0.3)',
        'glassmorphism': '0 8px 32px 0 rgba(12, 29, 81, 0.37)',
        'glow': '0 0 20px rgba(234, 144, 14, 0.5)',
        'glow-strong': '0 0 40px rgba(234, 144, 14, 0.8)',
      },
      
      // Premium Animations
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      
      // Premium Keyframes
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          'from': { boxShadow: '0 0 20px -10px rgba(234, 144, 14, 0.5)' },
          'to': { boxShadow: '0 0 20px 5px rgba(234, 144, 14, 0.8)' },
        },
        fadeIn: {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        slideUp: {
          'from': { transform: 'translateY(10px)', opacity: '0' },
          'to': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          'from': { transform: 'scale(0.95)', opacity: '0' },
          'to': { transform: 'scale(1)', opacity: '1' },
        },
      },
      
      // Premium Gradients
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'veritas-gradient': 'linear-gradient(135deg, #0C1D51 0%, #EA900E 100%)',
        'veritas-gradient-reverse': 'linear-gradient(135deg, #EA900E 0%, #0C1D51 100%)',
        'veritas-gradient-soft': 'linear-gradient(180deg, #B9D9EB 0%, #F0EAD6 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
      },
      
      // Premium Backdrop Blur
      backdropBlur: {
        'premium': '20px',
        'ultra': '40px',
      },
      
      // Premium Transitions
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
      },
      
      // Premium Z-Index
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
    },
  },
  plugins: [
    // Add any additional plugins here if needed
    // require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}

export default config