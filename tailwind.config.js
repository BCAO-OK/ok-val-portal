/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Make sure this path matches your file location
  ],
  theme: {
    extend: {
      colors: {
        // Your custom theme colors
      },
    },
  },
  plugins: [],
}