import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F8F9FC",
        foreground: "#111827",
        blueprint: {
          deep: "#1E40AF",
          mid: "#3B82F6",
          light: "#DBEAFE",
          faint: "#EFF6FF",
          grid: "rgba(30,64,175,0.06)",
        },
        card: {
          DEFAULT: "rgba(255,255,255,0.65)",
          foreground: "#111827",
        },
        popover: {
          DEFAULT: "rgba(255,255,255,0.85)",
          foreground: "#111827",
        },
        primary: {
          DEFAULT: "#1E40AF",
          foreground: "#F8F9FC",
        },
        secondary: {
          DEFAULT: "#F1F5F9",
          foreground: "#111827",
        },
        muted: {
          DEFAULT: "#F1F5F9",
          foreground: "#64748B",
        },
        accent: {
          DEFAULT: "#F1F5F9",
          foreground: "#111827",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#FFFFFF",
        },
        border: "rgba(210,218,230,0.7)",
        input: "rgba(210,218,230,0.7)",
        ring: "#1E40AF",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        glass: "20px",
        "glass-sm": "12px",
        "glass-lg": "24px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "'Helvetica Neue'", "sans-serif"],
        mono: ["'SF Mono'", "Consolas", "Monaco", "'Courier New'", "monospace"],
      },
      boxShadow: {
        glass: "0 4px 30px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.7)",
        "glass-hover": "0 8px 40px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.8)",
        "glass-sm": "0 2px 12px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6)",
      },
      backdropBlur: {
        glass: "20px",
      },
    },
  },
  plugins: [],
};
export default config;
