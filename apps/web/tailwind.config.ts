import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background:      "#FFFEF2",
        surface:         "#FFFFFF",
        border:          "rgba(25,25,24,0.12)",
        "accent-primary":"#FCAA2D",
        "accent-gold":   "#FCAA2D",
        "text-primary":  "#191918",
        "text-secondary":"rgba(25,25,24,0.45)",
        ink:             "#191918",
      },
      fontFamily: {
        mono: ["var(--font-mono)", "Geist Mono", "monospace"],
        sans: ["var(--font-sans)", "Geist", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
