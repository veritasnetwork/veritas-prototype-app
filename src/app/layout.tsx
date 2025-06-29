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
  keywords: ['veritas', 'truth', 'decentralized', 'blockchain', 'consensus', 'information'],
  authors: [{ name: 'Veritas Team' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFB800' },
    { media: '(prefers-color-scheme: dark)', color: '#1B365D' }
  ],
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192x192.png', sizes: '192x192' },
    ],
  },
  openGraph: {
    title: 'Veritas - Decentralized Truth Finding',
    description: 'Aggregate information into truth signals through collective intelligence and economic incentives.',
    url: 'https://veritas.app',
    siteName: 'Veritas',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Veritas - Decentralized Truth Finding',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Veritas - Decentralized Truth Finding',
    description: 'Aggregate information into truth signals through collective intelligence and economic incentives.',
    images: ['/og-image.png'],
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