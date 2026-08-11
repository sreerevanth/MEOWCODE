import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        zinc: {
          850: "#202026"
        }
      },
      boxShadow: {
        soft: "0 18px 55px rgba(15, 23, 42, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
