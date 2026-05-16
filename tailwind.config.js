// tailwind.config.js
export default {
  content:["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: '#1e293b',       // For buttons/active states
        offwhite: '#f8fafc',  // For main background
        surface: '#ffffff',   // For cards/modals
        text: {
          main: '#0f172a',
          muted: '#64748b',
        },
        border: '#e2e8f0',
      },
    },
  },
  plugins:
