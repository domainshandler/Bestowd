import type { Config } from 'tailwindcss'

/** Colours and type from the Bestowd navigation-tabs mockup. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: '#FAFAF7',
        ink: '#1C1B19',
        muted: '#5F5D57',
        line: '#E7E4DC',
        divider: '#EFEDE7',
        brand: { DEFAULT: '#0F6E68', dark: '#0A524D', light: '#E3F1EF', faint: '#CFE7E4' },
        amber: { DEFAULT: '#F2B33D', soft: '#FDF0D5', ink: '#8A4B00' },
        danger: { DEFAULT: '#9A2A1E', soft: '#FBE6E2' },
        chip: { DEFAULT: '#EFEDE7', ink: '#3D3B36' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
