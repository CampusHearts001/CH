/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#e11d48',
          50:  '#fff1f4',
          100: '#ffe4ea',
          200: '#fecdd9',
          300: '#fda4ba',
          400: '#fb6f92',
          500: '#f43f6b',
          600: '#e11d48',
          700: '#be1239',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },
        surface: {
          DEFAULT: '#1a1a1a',
          50:  '#2a2a2a',
          100: '#222222',
          200: '#1a1a1a',
          300: '#141414',
          400: '#0f0f0f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'slide-left':  'slideLeft 0.4s ease-in forwards',
        'slide-right': 'slideRight 0.4s ease-in forwards',
        'fade-in':     'fadeIn 0.3s ease-out',
        'bounce-in':   'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'pulse-heart': 'pulseHeart 0.6s ease-in-out',
      },
      keyframes: {
        slideLeft: {
          '0%':   { transform: 'translateX(0) rotate(0deg)', opacity: 1 },
          '100%': { transform: 'translateX(-150%) rotate(-20deg)', opacity: 0 },
        },
        slideRight: {
          '0%':   { transform: 'translateX(0) rotate(0deg)', opacity: 1 },
          '100%': { transform: 'translateX(150%) rotate(20deg)', opacity: 0 },
        },
        fadeIn: {
          from: { opacity: 0, transform: 'translateY(10px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        bounceIn: {
          '0%':   { transform: 'scale(0.3)', opacity: 0 },
          '50%':  { transform: 'scale(1.1)', opacity: 1 },
          '70%':  { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
        pulseHeart: {
          '0%':   { transform: 'scale(1)' },
          '30%':  { transform: 'scale(1.3)' },
          '60%':  { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
