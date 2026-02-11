/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand color
        primary: {
          DEFAULT: '#5493b3',
          dark: '#3d7a99',
          light: '#7bb3cf',
        },
        // Semantic colors
        success: {
          DEFAULT: '#22c55e',
          light: '#dcfce7',
        },
        warning: {
          DEFAULT: '#eab308',
          light: '#fef9c3',
        },
        error: {
          DEFAULT: '#ef4444',
          light: '#fee2e2',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'scale-in': 'scaleIn 0.5s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
