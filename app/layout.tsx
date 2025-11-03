import type { Metadata } from 'next';
import { Inter, Lora, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-serif',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Veritas - Information Discovery Platform',
  description: 'Create, discover, and trade relevant information',
  metadataBase: new URL('https://app.veritas.computer'),
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/favicon.ico' },
      { url: '/icons/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/favicon-96x96.png', sizes: '96x96', type: 'image/png' }
    ],
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Veritas',
  },
  openGraph: {
    title: 'Veritas - Information Discovery Platform',
    description: 'Create, discover, and trade relevant information',
    url: 'https://app.veritas.computer',
    siteName: 'Veritas',
    images: [
      {
        url: '/Compass Logo.png',
        width: 512,
        height: 512,
        alt: 'Veritas Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Veritas - Information Discovery Platform',
    description: 'Create, discover, and trade relevant information',
    images: ['/Compass Logo.png'],
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${lora.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning style={{ backgroundColor: '#0f0f0f' }}>
      <body className="bg-bg-primary text-text-primary font-sans antialiased" style={{ backgroundColor: '#0f0f0f', color: '#ffffff' }}>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}