/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46E5',
          hover: '#4338CA',
          light: '#E0E7FF',
        },
        success: '#0D9488',
        warning: '#D97706',
        danger: '#DC2626',
        surface: '#F8F7F4',
        card: '#FFFFFF',
        'text-primary': '#1E1B4B',
        'text-secondary': '#6B7280',
      },
    },
  },
  plugins: [],
}
