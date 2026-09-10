/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        apple: {
          primary: '#0066cc',
          focus: '#0071e3',
          sky: '#2997ff',
          ink: '#1d1d1f',
          parchment: '#f5f5f7',
          pearl: '#fafafc',
          tile: '#272729',
          black: '#000000',
          hairline: '#e0e0e0',
          divider: '#f0f0f0',
          muted: '#7a7a7a',
          bodyMuted: '#86868b',
        },
      },
      borderRadius: {
        'apple-sm': '8px',
        'apple-md': '11px',
        'apple-lg': '18px',
        'apple-pill': '9999px',
      },
      fontFamily: {
        sans: [
          'SF Pro Text',
          '-apple-system',
          'BlinkMacSystemFont',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
        display: [
          'SF Pro Display',
          '-apple-system',
          'BlinkMacSystemFont',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        'apple-card': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'apple-float': '0 20px 40px -15px rgba(0, 0, 0, 0.07)',
        'apple-product': '3px 5px 30px 0 rgba(0, 0, 0, 0.18)',
      },
    },
  },
  plugins: [],
}
