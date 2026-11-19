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
        'blue-soft': '0 4px 14px -6px rgba(10, 31, 110, 0.45)',
        'blue-card': '0 8px 20px -10px rgba(10, 20, 64, 0.55)',
        'blue-glow': '0 0 0 1px rgba(140, 162, 255, 0.30)',
        'cyan-glow': '0 0 0 1px rgba(106, 63, 224, 0.30)',
      },
      backgroundImage: {
        'bosla-mesh':
          'radial-gradient(ellipse 68% 58% at 18% 28%, rgba(74, 103, 240, 0.18), transparent 62%), linear-gradient(155deg, #070D2B 0%, #0B1440 54%, #18134A 100%)',
        'bosla-aurora':
          'radial-gradient(ellipse 70% 45% at 50% -10%, rgba(106, 63, 224, 0.16), transparent)',
      },
      keyframes: {
        'float-slow': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%': { transform: 'translate3d(0, -6px, 0)' },
        },
        'aura-breathe': {
          '0%, 100%': { opacity: '0.68', transform: 'scale(1)' },
          '50%': { opacity: '0.94', transform: 'scale(1.03)' },
        },
      },
      animation: {
        'float-slow': 'float-slow 8s ease-in-out infinite',
        'aura-breathe': 'aura-breathe 14s ease-in-out infinite',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.375rem',
        '4xl': '1.75rem',
      },
    },
  },
  plugins: [animatePlugin],
};

export default config;
