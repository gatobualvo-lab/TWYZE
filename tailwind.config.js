/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // A slightly warmer, softer neutral than Tailwind's default cool gray —
      // every existing `text-gray-*` / `bg-gray-*` / `border-gray-*` class in
      // the app picks this up automatically, no component changes needed.
      colors: {
        gray: {
          50: '#f9fafb',
          100: '#f3f4f5',
          200: '#e7e9ec',
          300: '#d4d7dc',
          400: '#9ea4ae',
          500: '#6b7280',
          600: '#565e6b',
          700: '#3f4655',
          800: '#272e3d',
          900: '#161b26',
          950: '#0b0e15',
        },
      },
      // Softer, more diffused elevation than Tailwind's default shadows —
      // every existing `shadow-sm/md/lg/xl` usage upgrades for free.
      boxShadow: {
        sm: '0 1px 2px 0 rgb(16 24 40 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(16 24 40 / 0.08), 0 1px 2px -1px rgb(16 24 40 / 0.06)',
        md: '0 4px 8px -2px rgb(16 24 40 / 0.08), 0 2px 4px -2px rgb(16 24 40 / 0.05)',
        lg: '0 12px 16px -4px rgb(16 24 40 / 0.08), 0 4px 6px -2px rgb(16 24 40 / 0.04)',
        xl: '0 20px 24px -4px rgb(16 24 40 / 0.10), 0 8px 8px -4px rgb(16 24 40 / 0.04)',
        '2xl': '0 24px 48px -12px rgb(16 24 40 / 0.18)',
        'glow-blue': '0 0 0 3px rgb(37 99 235 / 0.12)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'scale-in': { from: { opacity: 0, transform: 'scale(0.96)' }, to: { opacity: 1, transform: 'scale(1)' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
        'pop-check': {
          '0%': { transform: 'scale(0.5)', opacity: 0 },
          '60%': { transform: 'scale(1.12)', opacity: 1 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-in-out',
        'fade-in': 'fade-in 0.3s ease-in-out',
        'slide-in-right': 'slide-in-right 0.3s ease-in-out',
        'slide-up': 'slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        'pop-check': 'pop-check 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
