import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#36B4FF",
          navy: "#293381",
          "navy-hover": "#1F2664",
          "blue-hover": "#1BA5F7",
          "blue-light": "#EBF7FF",
          "navy-light": "#EEF1FA",
          50: "#EEF1FA",
          100: "#EBF7FF",
          200: "#C2E8FF",
          300: "#8DD3FF",
          400: "#36B4FF",
          500: "#1BA5F7",
          600: "#293381",
          700: "#1F2664",
          800: "#181E50",
          900: "#11163B",
        },
        slate: {
          850: "#151e2e",
          950: "#090d16",
        },
      },
      fontFamily: {
        sans: ["Roboto", "Calibri", "Arial", "sans-serif"],
        primary: ["Roboto", "Calibri", "Arial", "sans-serif"],
        secondary: ["Calibri", "Arial", "sans-serif"],
      },
      boxShadow: {
        subtle: "0 1px 3px 0 rgba(41, 51, 129, 0.05), 0 1px 2px -1px rgba(41, 51, 129, 0.05)",
        card: "0 2px 6px 0 rgba(41, 51, 129, 0.06), 0 1px 3px 0 rgba(0, 0, 0, 0.02)",
      },
    },
  },
  plugins: [],
} satisfies Config;
