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
          bg: '#070D2B',
          void: '#070D2B',
          card: '#0F1A4A',
          surface: '#0F1A4A',
          surfaceHover: '#18266E',
          ink: '#EEF0FF',
          muted: '#A9B1E0',
          line: '#22307A',
          borderActive: '#8CA2FF',
          primary: '#7C95FF',
          primaryHover: '#93A8FF',
          ctaInk: '#070D2B',
          tealText: '#8CA2FF',
          soft: '#18266E',
          navy: '#0B1440',
          deep: '#070D2B',
          abyss: '#050A2A',
          sapphire: '#18266E',
          cobalt: '#18266E',
          cyan: '#8CA2FF',
          sky: '#B4C4FF',
          ice: '#18266E',
          purple: '#6A3FE0',
          success: '#77E2B5',
          amber: '#F5B94A',
          warning: '#F5B94A',
          danger: '#FF9CAA',
        },
      },
      boxShadow: {
        'blue-soft': '0 1px 2px rgba(7, 13, 43, 0.35)',
        'blue-card': '0 4px 12px rgba(7, 13, 43, 0.4)',
      },
      backgroundImage: {
        'bosla-mesh': 'linear-gradient(180deg, #070D2B 0%, #0B1440 100%)',
        'bosla-aurora': 'linear-gradient(180deg, #0B1440 0%, #070D2B 100%)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.5rem',
      },
      transitionTimingFunction: {
        crisp: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [animatePlugin],
};

export default config;
