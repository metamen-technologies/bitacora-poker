/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0f0d",
        panel: "#111a16",
        line: "#283c31",
        lime: "#bdf36b",
        muted: "#94a39a",
        warning: "#efc977",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(189,243,107,.1), 0 18px 60px rgba(0,0,0,.24)",
      },
    },
  },
  plugins: [],
};
