/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./app/components/**/*.{js,vue,ts}",
    "./app/layouts/**/*.vue",
    "./app/pages/**/*.vue",
    "./app/plugins/**/*.{js,ts}",
    "./app/app.vue",
    "./app/error.vue"
  ],
  safelist: ['font-himpun'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'sans-serif'],
        himpun: ['Himpun', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'vt-fade-in-up 0.7s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in':    'vt-fade-in 0.6s ease both',
        'scale-in':   'vt-scale-in 0.5s cubic-bezier(0.16,1,0.3,1) both',
      },
      keyframes: {
        'vt-fade-in-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'vt-fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'vt-scale-in': {
          from: { opacity: '0', transform: 'scale(0.92)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}