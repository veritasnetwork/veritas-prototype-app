import type { Metadata } from 'next';
import { Inter, Lora } from 'next/font/google';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { ThemeProvider } from '@/providers/ThemeProvider';
import '@/styles/globals.css';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-sans',
});

const lora = Lora({ 
  subsets: ['latin'],
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: 'Veritas - Information Discovery Platform',
  description: 'Discover and evaluate information through community-driven signals',
  icons: {
    icon: [
      { url: '/icons/favicon.ico' },
      { url: '/icons/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/favicon-96x96.png', sizes: '96x96', type: 'image/png' }
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${lora.variable}`} suppressHydrationWarning>
      <body className="bg-white dark:bg-neutral-900 text-black dark:text-white font-sans antialiased transition-colors duration-200">
        <ThemeProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}