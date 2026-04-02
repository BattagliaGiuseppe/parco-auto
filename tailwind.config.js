/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#FFD700",   // oro base
          dark: "#B8860B",      // oro scuro (hover)
          light: "#FFECB3",     // oro chiaro (accento)
        },
      },
    },
  },
  plugins: [],
};
