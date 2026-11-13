import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import { AppProviders } from '@/lib/auth-context';
import './globals.css';

const ibmArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'أكاديمية بوصلة | من الطالب إلى المدير — BOSLA Academy',
    template: '%s | أكاديمية بوصلة',
  },
  description:
    'أول منصة تعليمية وتطبيقية متخصصة في الثروة الحيوانية والداجنة والطب البيطري والإدارة التجارية — كورسات، مسارات تعلم، ودبلومات مهنية.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={ibmArabic.variable}>
      <body className="font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
