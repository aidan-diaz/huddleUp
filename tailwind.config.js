/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        serif: ['Source Serif 4', 'Georgia', 'serif'],
      },
      colors: {
        primary: '#ffffff',
        'user-message': {
          DEFAULT: '#10b981',
          hover: '#059669',
        },
        'received-message': '#f1f5f9',
        'chat-bg': '#f8fafc',
      },
    },
  },
  plugins: [],
};
