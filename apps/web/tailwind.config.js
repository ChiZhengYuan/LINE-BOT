/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 0 40px rgba(59, 130, 246, 0.18)"
      }
    }
  },
  plugins: []
};
