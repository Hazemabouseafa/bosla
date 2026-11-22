import type { Metadata } from 'next';
import {
  Beiruti,
  IBM_Plex_Sans_Arabic,
  Kufam,
  Readex_Pro,
} from 'next/font/google';
import { AppProviders } from '@/lib/auth-context';
import './globals.css';

const ibmArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-arabic',
  display: 'swap',
});

const kufam = Kufam({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-kufam',
  display: 'swap',
});

const beiruti = Beiruti({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-beiruti',
  display: 'swap',
});

const readexPro = Readex_Pro({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-readex-pro',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'أكاديمية بوصلة | من الطالب إلى المدير — BOSLA Academy',
    template: '%s | أكاديمية بوصلة',
  },
  description:
    'بيئة تعليمية وتطبيقية متخصصة في الثروة الحيوانية والداجنة والطب البيطري وتغذية الحيوان والإدارة التجارية.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${ibmArabic.variable} ${kufam.variable} ${beiruti.variable} ${readexPro.variable}`}
    >
      <body className="font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
