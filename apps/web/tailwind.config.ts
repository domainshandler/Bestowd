import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#7C3AED', light: '#EDE9FE', dark: '#5B21B6' },
      },
    },
  },
  plugins: [],
} satisfies Config
