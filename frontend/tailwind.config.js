/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // DESIGN.md: one accent (Action Blue) + Apple system status colors.
        // DEFAULT = text/solid fill, soft = tinted background, line = tinted border, dot = indicator fill.
        primary: { DEFAULT: '#0066cc', hover: '#0071e3', soft: '#e8f1fb', line: '#b3d1f0', dot: '#0071e3' },
        success: { DEFAULT: '#248a3d', soft: '#eaf6ed', line: '#bfe5c9', dot: '#34c759' },
        danger: { DEFAULT: '#d70015', soft: '#fdeeed', line: '#f6c6c2', dot: '#ff3b30' },
        warning: { DEFAULT: '#b25000', soft: '#fff4e5', line: '#ffd8a8', dot: '#ff9500' },
        brand: {
          cyan: '#0066cc',
          cyanDark: '#0071e3',
          cyanLight: '#e0f2fe',
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
          hairline: '#e0e0e0',
          divider: '#f0f0f0',
          muted: '#7a7a7a',
          bodyMuted: '#86868b',
        },
      },
      borderRadius: {
        // Cards use rounded-2xl = DESIGN.md {rounded.lg} 18px
        '2xl': '18px',
        'apple-sm': '8px',
        'apple-md': '11px',
        'apple-lg': '18px',
        'apple-pill': '9999px',
      },
      fontFamily: {
        sans: [
          'SF Pro Text',
          'SF Pro Display',
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro',
          'Inter',
          'Segoe UI',
          'system-ui',
          'sans-serif',
        ],
        display: [
          'SF Pro Display',
          'SF Pro Text',
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro',
          'Inter',
          'Segoe UI',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        'apple-card': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'apple-float': '0 20px 40px -15px rgba(0, 0, 0, 0.07)',
        'apple-product': '3px 5px 30px 0 rgba(0, 0, 0, 0.18)',
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        '2xs': '0 1px 1px 0 rgba(0, 0, 0, 0.03)',
      },
    },
  },
  plugins: [],
}
