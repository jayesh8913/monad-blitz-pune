/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#FDFBF7',
        charcoal: '#1A1A1A',
        monad: {
          purple: '#836EF9', // Monad brand purple
          orange: '#FF5E03', // Monad brand orange
          grey: '#3A3A3A'
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderWidth: {
        '3': '3px',
      },
      boxShadow: {
        // Brutalist hard shadows
        'neo': '4px 4px 0px 0px #1A1A1A',
        'neo-lg': '8px 8px 0px 0px #1A1A1A',
        'neo-sm': '2px 2px 0px 0px #1A1A1A',
      }
    },
  },
  plugins: [],
}
