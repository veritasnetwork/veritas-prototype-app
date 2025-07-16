import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Analytics } from '@vercel/analytics/next';

import VeritasFooter from '@/components/layout/Footer';
import ConditionalNavbar from '@/components/layout/ConditionalNavbar';
import ConditionalWrapper from '@/components/layout/ConditionalWrapper';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter'
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFB800' },
    { media: '(prefers-color-scheme: dark)', color: '#1B365D' }
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
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
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