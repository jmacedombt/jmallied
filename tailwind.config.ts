import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        allied: {
          bg: "#0a1830",
          panel: "#0f2242",
          panel2: "#132a52",
          accent: "#2f6fed",
          accent2: "#5aa9ff",
          border: "#1f3b66",
          silver: "#c7d2e0",
        },
      },
      boxShadow: {
        glow: "0 0 40px rgba(90,169,255,0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
