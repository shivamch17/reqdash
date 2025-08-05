/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'postman-bg': '#1C1C1E',
        'postman-secondary': '#2C2C2E',
        'postman-border': '#3C3C3E',
        'postman-red': '#FF6C37'
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar')({ nocompatible: true }),
  ],
}
