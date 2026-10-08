/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          cyan: '#0066cc',
          cyanDark: '#0071e3',
          cyanLight: '#f0f7ff',
          emerald: '#10b981',
          emeraldDark: '#059669',
          emeraldLight: '#d1fae5',
          mintTint: '#f0fdf4',
        },
        apple: {
          primary: '#0066cc',
          focus: '#0071e3',
          sky: '#2997ff',
          ink: '#1d1d1f',
          parchment: '#f5f5f7',
          pearl: '#fafafc',
          tile: '#272729',
          black: '#000000',
          hairline: '#e5e5ea',
          controlBorder: '#d2d2d7',
          divider: '#f0f0f2',
          muted: '#6e6e73',
          bodyMuted: '#86868b',
        },
      },
      borderRadius: {
        'apple-sm': '12px',
        'apple-md': '20px',
        'apple-lg': '24px',
        'apple-pill': '9999px',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Inter"',
          'system-ui',
          'sans-serif',
        ],
        display: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"Inter"',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        'apple-card': '0 2px 10px 0 rgba(0, 0, 0, 0.02)',
        'apple-card-hover': '0 6px 20px -4px rgba(0, 0, 0, 0.05)',
        'apple-float': '0 10px 32px -4px rgba(0, 0, 0, 0.08)',
        'apple-product': '0 12px 36px -6px rgba(0, 0, 0, 0.10)',
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        '2xs': '0 1px 1px 0 rgba(0, 0, 0, 0.02)',
      },
    },
  },
  plugins: [],
}
