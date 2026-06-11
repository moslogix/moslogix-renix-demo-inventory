import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d7fe',
          300: '#a5bbfc',
          400: '#8196f8',
          500: '#6272f3',
          600: '#4f56e7',
          700: '#4344cb',
          800: '#383aa4',
          900: '#333781',
          950: '#1e1f4c',
        },
        bg: {
          base: '#080b14',
          elevated: '#0d1117',
          surface: '#111827',
          muted: '#1a2332',
          subtle: '#1f2d3d',
        },
        border: {
          dim: '#1e293b',
          DEFAULT: '#253044',
          bright: '#334155',
        },
        text: {
          primary: '#f0f4ff',
          secondary: '#94a3b8',
          muted: '#64748b',
          disabled: '#475569',
        },
        success: {
          DEFAULT: '#10b981',
          dim: 'rgba(16,185,129,0.12)',
        },
        warning: {
          DEFAULT: '#f59e0b',
          dim: 'rgba(245,158,11,0.12)',
        },
        danger: {
          DEFAULT: '#ef4444',
          dim: 'rgba(239,68,68,0.12)',
        },
        info: {
          DEFAULT: '#3b82f6',
          dim: 'rgba(59,130,246,0.12)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand': 'linear-gradient(135deg, #4f56e7 0%, #6272f3 100%)',
        'gradient-surface': 'linear-gradient(180deg, #111827 0%, #0d1117 100%)',
        'shimmer-gradient':
          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,114,243,0.3)',
        'glow-brand': '0 0 20px rgba(99,114,243,0.3)',
        'glow-success': '0 0 20px rgba(16,185,129,0.3)',
      },
    },
  },
  plugins: [],
}

export default config
