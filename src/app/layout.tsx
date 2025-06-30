import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { ThemeProvider } from '@/contexts/ThemeContext';
import VeritasNavbar from '@/components/layout/Navbar';
import VeritasFooter from '@/components/layout/Footer';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter'
});

export const metadata: Metadata = {
  title: 'Veritas - Decentralized Truth Finding',
  description: 'Aggregate information into truth signals through collective intelligence and economic incentives.',
  
  // Favicon configuration
  icons: {
    icon: [
      { url: '/icons/favicon.ico', sizes: '32x32' },
      { url: '/icons/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180' },
    ],
  },
  
  // Open Graph
  openGraph: {
    title: 'Veritas - Decentralized Truth Finding',
    description: 'Aggregate information into truth signals through collective intelligence and economic incentives.',
    url: 'https://veritas.app',
    siteName: 'Veritas',
    images: [
      {
        url: '/images/veritas-preview-image.png',
        width: 1200,
        height: 630,
        alt: 'Veritas - Decentralized Truth Finding Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  
  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'Veritas - Decentralized Truth Finding',
    description: 'Aggregate information into truth signals through collective intelligence and economic incentives.',
    images: ['/images/veritas-preview-image.png'],
    creator: '@veritas',
  },
  
  // PWA configuration
  manifest: '/manifest.json',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFB800' },
    { media: '(prefers-color-scheme: dark)', color: '#1B365D' }
  ],
  
  // Additional SEO
  keywords: ['veritas', 'truth', 'decentralized', 'prediction markets', 'consensus', 'collective intelligence'],
  authors: [{ name: 'Veritas Team' }],
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  robots: 'index, follow',
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
          {/* Navigation */}
          <VeritasNavbar />
          
          {/* Main Content */}
          <main className="relative">
            {/* Desktop: Add top padding for navbar */}
            <div className="hidden md:block pt-24">
              {children}
            </div>
            
            {/* Mobile: Add bottom padding for dock, different top padding */}
            <div className="md:hidden pt-6 pb-32">
              {children}
            </div>
          </main>
          
          {/* Footer (desktop only) */}
          <VeritasFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}