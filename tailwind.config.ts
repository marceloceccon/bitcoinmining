import type { Config } from "tailwindcss";

/** Every color maps to a CSS token (app/globals.css), so both themes come from one set. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        "surface-2": token("surface-2"),
        fg: token("fg"),
        "fg-2": token("fg-2"),
        muted: token("muted"),
        faint: token("faint"),
        line: token("line"),
        "line-strong": token("line-strong"),
        btc: token("btc"),
        good: token("good"),
        bad: token("bad"),
        warn: token("warn"),
        heat: token("heat"),
        cool: token("cool"),
        power: token("power"),
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
      },
      fontFamily: {
        sans: ["var(--font-geist)", "system-ui", "-apple-system", "'Segoe UI'", "Roboto", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "'SF Mono'", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
