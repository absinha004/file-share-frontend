module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        neonPink: '#ff2d95',
        neonBlue: '#00f7ff',
        neonPurple: '#bc13fe',
      },
      boxShadow: {
        neon: '0 0 10px #ff2d95, 0 0 20px #ff2d95, 0 0 40px #ff2d95',
        neonBlue: '0 0 10px #00f7ff, 0 0 20px #00f7ff, 0 0 40px #00f7ff',
      },
    },
  },
  plugins: [],
}
