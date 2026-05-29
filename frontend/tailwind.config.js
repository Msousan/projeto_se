/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Nunito", "ui-sans-serif", "system-ui"],
        body: ["Nunito Sans", "ui-sans-serif", "system-ui"]
      },
      colors: {
        ink: "#172026",
        clay: "#B85C38",
        moss: "#506A4F",
        cream: "#F7F1E5",
        paper: "#FFFDF8"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(23, 32, 38, 0.12)"
      }
    }
  },
  plugins: []
};
