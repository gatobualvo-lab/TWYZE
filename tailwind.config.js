/** @type {import('tailwindcss').Config} */
//
// Trackwyze design tokens, taken from the brand logo: navy, emerald and amber.
//
// The whole app is written with stock Tailwind classes (bg-blue-600,
// text-gray-700, rounded-xl, shadow-md ...). Re-defining those scales here
// re-themes every screen at once, with no per-component edits:
//
//   blue   -> brand emerald (#0E9F6E at 500, the logo's own green). Primary
//             actions, links and active states. 600 is darkened to #0A7F56 so
//             white text on it meets 4.5:1.
//   gray   -> navy-tinted neutrals (logo text #0F1B2D, secondary #4A5568,
//             border #E2E8F0, canvas #F7F8FA).
//   slate  -> navy, used for the dark theme and the sidebar.
//   accent -> the logo's amber (#F5A524), for highlights and key numbers.
//
// Status colours (green / red / amber) stay as Tailwind's so that "paid",
// "overdue" and "low stock" keep meaning exactly what they always did.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        // Sora is the typeface of the Trackwyze wordmark.
        display: ['Sora', '"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        blue: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#0e9f6e',
          600: '#0a7f56',
          700: '#086646',
          800: '#07523a',
          900: '#064330',
          950: '#022a1d',
        },
        accent: {
          50: '#fffaeb',
          100: '#fef0c7',
          200: '#fddf8c',
          300: '#fbc84f',
          400: '#f5a524',
          500: '#e08a0b',
          600: '#c26d06',
          700: '#9c5009',
          800: '#7e410d',
          900: '#68360f',
        },
        gray: {
          50: '#f7f8fa',
          100: '#eef1f5',
          200: '#e2e8f0',
          300: '#cbd5e0',
          400: '#5f6f86',
          500: '#556379',
          600: '#3f4b5e',
          700: '#2d3a4d',
          800: '#1c2b42',
          900: '#0f1b2d',
          950: '#080f1b',
        },
        slate: {
          50: '#f3f6fa',
          100: '#e6ebf2',
          200: '#cdd7e4',
          300: '#a9b8cc',
          400: '#7f93ae',
          500: '#4a5f7d',
          600: '#2c3e5a',
          700: '#1c2b42',
          800: '#0f1b2d',
          900: '#0a1220',
          950: '#070d17',
        },
        // Indigo and purple are used in the app as category accents. The stock versions
        // are the most "default" colours in any Tailwind app, so they become a muted
        // cobalt and a berry plum that sit properly beside the emerald and amber.
        indigo: {
          50: '#eef3fb',
          100: '#dbe6f7',
          200: '#bcd0ef',
          300: '#8eaee3',
          400: '#5d86d3',
          500: '#3d66be',
          600: '#2f50a0',
          700: '#274081',
          800: '#223566',
          900: '#1f2e55',
        },
        purple: {
          50: '#fbf1f7',
          100: '#f6e0ee',
          200: '#eec1dc',
          300: '#e195c2',
          400: '#d064a3',
          500: '#bb4585',
          600: '#a22f6a',
          700: '#85265a',
          800: '#6e214c',
          900: '#5b1e41',
        },
        violet: {
          50: '#fbf1f7',
          100: '#f6e0ee',
          200: '#eec1dc',
          300: '#e195c2',
          400: '#d064a3',
          500: '#bb4585',
          600: '#a22f6a',
          700: '#85265a',
          800: '#6e214c',
          900: '#5b1e41',
        },
        ink: {
          700: '#1c2b42',
          800: '#0f1b2d',
          900: '#0a1220',
          950: '#070d17',
        },
      },
      borderRadius: {
        lg: '0.625rem',
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      // Elevation is tinted with the brand navy instead of neutral black, which
      // is what stops cards looking like flat default-Tailwind boxes.
      boxShadow: {
        sm: '0 1px 2px 0 rgb(15 27 45 / 0.06)',
        DEFAULT: '0 1px 3px 0 rgb(15 27 45 / 0.08), 0 1px 2px -1px rgb(15 27 45 / 0.06)',
        md: '0 6px 14px -4px rgb(15 27 45 / 0.10), 0 2px 5px -2px rgb(15 27 45 / 0.06)',
        lg: '0 16px 28px -8px rgb(15 27 45 / 0.14), 0 6px 10px -4px rgb(15 27 45 / 0.06)',
        xl: '0 24px 40px -10px rgb(15 27 45 / 0.18), 0 10px 14px -6px rgb(15 27 45 / 0.07)',
        '2xl': '0 32px 64px -16px rgb(15 27 45 / 0.28)',
        'glow-blue': '0 0 0 3px rgb(14 159 110 / 0.18)',
        glow: '0 8px 24px -6px rgb(14 159 110 / 0.45)',
        'glow-accent': '0 8px 24px -6px rgb(245 165 36 / 0.5)',
        inset: 'inset 0 1px 0 0 rgb(255 255 255 / 0.18)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'scale-in': { from: { opacity: 0, transform: 'scale(0.96)' }, to: { opacity: 1, transform: 'scale(1)' } },
        // A reveal with a touch of blur: reads as "coming into focus".
        'reveal-up': {
          from: { opacity: 0, transform: 'translateY(16px)', filter: 'blur(6px)' },
          to: { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
        },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
        'pop-check': {
          '0%': { transform: 'scale(0.5)', opacity: 0 },
          '60%': { transform: 'scale(1.12)', opacity: 1 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'gradient-pan': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'ring-pulse': {
          '0%': { boxShadow: '0 0 0 0 rgb(14 159 110 / 0.45)' },
          '70%': { boxShadow: '0 0 0 12px rgb(14 159 110 / 0)' },
          '100%': { boxShadow: '0 0 0 0 rgb(14 159 110 / 0)' },
        },
        sheen: {
          '0%': { transform: 'translateX(-120%) skewX(-18deg)' },
          '100%': { transform: 'translateX(320%) skewX(-18deg)' },
        },
        'draw-line': { from: { strokeDashoffset: 1 }, to: { strokeDashoffset: 0 } },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-in-out',
        'fade-in': 'fade-in 0.3s ease-in-out',
        'slide-in-right': 'slide-in-right 0.3s ease-in-out',
        'slide-up': 'slide-up 0.45s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
        'reveal-up': 'reveal-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        'pop-check': 'pop-check 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        float: 'float 6s ease-in-out infinite',
        'gradient-pan': 'gradient-pan 10s ease infinite',
        'ring-pulse': 'ring-pulse 2s ease-out infinite',
        sheen: 'sheen 2.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
