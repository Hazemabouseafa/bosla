import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const BOSLA_BRAND_TOKENS = {
  primary: '#1536b5',
  navy: '#0a2a8a',
  purple: '#4a1fb0',
  amber: '#f5b94a',
  emerald: '#1fa574',
  surfaceLight: '#f3f5ff',
  surfaceDark: '#070d2b',
} as const;

export function formatEgpFromCents(cents: number): string {
  const egp = Math.round(cents / 100);
  return `${egp.toLocaleString('ar-EG')} جنيه`;
}

export function formatDurationArabic(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs} س ${remMins} د`;
  }
  return `${mins} د ${secs} ث`;
}
