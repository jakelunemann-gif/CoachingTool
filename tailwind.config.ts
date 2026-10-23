import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#eef6ff", 100: "#d9eaff", 500: "#1d6fd8", 600: "#165bb4", 700: "#124a92" },
      },
    },
  },
  plugins: [],
} satisfies Config;
