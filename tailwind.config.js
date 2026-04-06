/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Nunito', 'system-ui', 'sans-serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
        },
        fun: {
          pink:    '#f472b6',
          coral:   '#fb7185',
          peach:   '#fdba74',
          mint:    '#6ee7b7',
          sky:     '#7dd3fc',
          lavender:'#c4b5fd',
          lemon:   '#fde68a',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'spring-in':   'springIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'fade-up':     'fadeUp 0.4s ease-out forwards',
        'wiggle':      'wiggle 0.4s ease-in-out',
        'pulse-soft':  'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'bounce-in':   'bounceIn 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'slide-right': 'slideRight 0.3s ease-out forwards',
        'count-up':    'countUp 0.8s ease-out forwards',
        'shimmer':     'shimmer 2s linear infinite',
      },
      keyframes: {
        springIn: {
          '0%':   { opacity: '0', transform: 'scale(0.92) translateY(12px)' },
          '60%':  { transform: 'scale(1.02) translateY(-3px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        wiggle: {
          '0%,100%': { transform: 'rotate(0deg)' },
          '25%':     { transform: 'rotate(-8deg)' },
          '75%':     { transform: 'rotate(8deg)' },
        },
        bounceIn: {
          '0%':   { opacity: '0', transform: 'scale(0.8)' },
          '60%':  { transform: 'scale(1.08)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideRight: {
          '0%':   { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        'card':      '0 2px 20px rgba(139,92,246,0.08)',
        'card-hover':'0 8px 32px rgba(139,92,246,0.18)',
        'pink':      '0 4px 24px rgba(236,72,153,0.25)',
        'violet':    '0 4px 24px rgba(139,92,246,0.30)',
        'emerald':   '0 4px 24px rgba(16,185,129,0.25)',
        'amber':     '0 4px 24px rgba(245,158,11,0.25)',
        'rose':      '0 4px 24px rgba(244,63,94,0.25)',
      },
    },
  },
  plugins: [],
}
