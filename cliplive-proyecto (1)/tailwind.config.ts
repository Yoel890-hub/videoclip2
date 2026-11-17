import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: {
    bg: "#0A0A0C", card: "#131316", card2: "#1B1B20", line: "#26262C", accent: "#FF6600",
  }, fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] } } },
  plugins: [],
} satisfies Config;
