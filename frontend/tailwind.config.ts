/** Tailwind theme: CSS-variable colours (light/dark switch) + indigo->violet accent. */
import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"), card: v("card"), ink: v("ink"),
        fg: v("fg"), muted: v("muted"), faint: v("faint"),
        accent: "#6366f1", accent2: "#a855f7",
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"], mono: ["JetBrains Mono", "ui-monospace", "monospace"] },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        bounceDot: { "0%,80%,100%": { transform: "scale(0.6)", opacity: "0.4" }, "40%": { transform: "scale(1)", opacity: "1" } },
      },
      animation: { shimmer: "shimmer 1.6s infinite", dot: "bounceDot 1.2s infinite ease-in-out" },
    },
  },
  plugins: [],
} satisfies Config;
