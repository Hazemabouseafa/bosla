import type { Config } from 'tailwindcss';
import animatePlugin from 'tailwindcss-animate';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx,js,jsx,mdx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-ibm-arabic)', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
      },
      colors: {
        bosla: {
          bg: '#f3f5ff',
          card: '#ffffff',
          ink: '#0b1440',
          muted: '#55608f',
          line: '#dbe1f6',
          primary: '#1536b5',
          navy: '#0a2a8a',
          purple: '#4a1fb0',
          success: '#1fa574',
          amber: '#f5b94a',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [animatePlugin],
};

export default config;
