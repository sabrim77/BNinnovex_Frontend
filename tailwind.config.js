/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // your ThemeToggle toggles .dark on <html>
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { xl: '80rem' }, // matches your .max-w-7xl utility
    },
    extend: {
      colors: {
        brand: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',   // used by .btn-brand / focus ring
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950:'#022c22',
        },
      },
      fontFamily: {
        // Good Latin + Bengali fallback; use via className="font-sans"
        sans: [
          'Inter', 'ui-sans-serif', 'system-ui',
          'Noto Sans Bengali', 'Hind Siliguri',
          'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial',
          'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji',
        ],
        mono: ['SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      boxShadow: {
        // mirrors your CSS tokens for convenience if you ever want Tailwind shadows
        'sentix-sm': '0 6px 16px rgba(2,6,23,.25)',
        'sentix-lg': '0 18px 40px rgba(2,6,23,.35)',
      },
      borderRadius: {
        '2xl': '1rem', // ensure consistent with your .card rounding
      },
    },
  },
  plugins: [
    // Uncomment if you want consistent native inputs without custom CSS:
    // require('@tailwindcss/forms'),
    // For rich text (not required now):
    // require('@tailwindcss/typography'),
  ],
};
