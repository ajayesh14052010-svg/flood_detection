import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fg: {
          normal: "#16a34a",
          watch: "#ca8a04",
          warning: "#ea580c",
          critical: "#dc2626",
          offline: "#64748b",
        },
      },
    },
  },
  plugins: [],
};

export default config;
