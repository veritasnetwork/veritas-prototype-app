import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Analytics } from '@vercel/analytics/next';

import VeritasFooter from '@/components/layout/Footer';
import ConditionalNavbar from '@/components/layout/ConditionalNavbar';
import ConditionalWrapper from '@/components/layout/ConditionalWrapper';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EA900E' },
    { media: '(prefers-color-scheme: dark)', color: '#0C1D51' }
  ],
};

export const metadata: Metadata = {
  title: {
    template: '%s | Veritas',
    default: 'Veritas - Belief Prediction Platform'
  },
  description: 'Veritas is a revolutionary belief prediction platform that combines the wisdom of crowds with advanced forecasting techniques to help you make better decisions.',
  keywords: [
    'prediction market',
    'belief prediction',
    'forecasting',
    'crowd wisdom',
    'decision making',
    'probability',
    'consensus',
    'market prediction'
  ],
  authors: [
    {
      name: 'Veritas Team',
      url: 'https://veritas.com'
    }
  ],
  creator: 'Veritas',
  publisher: 'Veritas',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://veritas.com'),
  openGraph: {
    title: 'Veritas - Belief Prediction Platform',
    description: 'Harness the power of collective intelligence to predict outcomes and make better decisions.',
    url: 'https://veritas.com',
    siteName: 'Veritas',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Veritas Belief Prediction Platform'
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Veritas - Belief Prediction Platform',
    description: 'Harness the power of collective intelligence to predict outcomes and make better decisions.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground transition-colors duration-300">
        <ThemeProvider>
          {/* Conditional Navigation - Only show VeritasNavbar on non-feed routes */}
          <ConditionalNavbar />
          
          {/* Main Content */}
          <main className="relative">
            <ConditionalWrapper>
              {children}
            </ConditionalWrapper>
          </main>
          
          {/* Footer (desktop only) */}
          <VeritasFooter />
          
          {/* Vercel Analytics */}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}