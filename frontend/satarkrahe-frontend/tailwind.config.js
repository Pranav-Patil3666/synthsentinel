/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)", foreground: "var(--color-foreground)",
        card: "var(--color-card)", muted: "var(--color-muted)",
        "muted-foreground": "var(--color-muted-foreground)", accent: "var(--color-accent)",
        "accent-secondary": "var(--color-accent-secondary)", "accent-tertiary": "var(--color-accent-tertiary)",
        border: "var(--color-border)", input: "var(--color-input)", ring: "var(--color-ring)",
        destructive: "var(--color-destructive)",
      },
      fontFamily: {
        heading: ["Orbitron", "Share Tech Mono", "monospace"],
        body: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
        accent: ["Share Tech Mono", "monospace"],
      },
      boxShadow: {
        glow: "var(--glow-primary)", "glow-sm": "var(--glow-small)", "glow-lg": "var(--glow-large)",
        "glow-secondary": "var(--glow-secondary)", "glow-tertiary": "var(--glow-tertiary)",
      },
      keyframes: {
        blink: { "50%": { opacity: "0" } },
        glitch: { "0%, 100%": { transform: "translate(0)" }, "20%": { transform: "translate(-2px, 2px)" }, "40%": { transform: "translate(2px, -2px)" }, "60%": { transform: "translate(-1px, -1px)" }, "80%": { transform: "translate(1px, 1px)" } },
        scanline: { "0%": { transform: "translateY(-100%)" }, "100%": { transform: "translateY(100vh)" } },
        rgbShift: { "0%, 100%": { textShadow: "-2px 0 #ff00ff, 2px 0 #00d4ff" }, "50%": { textShadow: "2px 0 #ff00ff, -2px 0 #00d4ff" } },
      },
      animation: {
        blink: "blink 1s step-end infinite", glitch: "glitch 240ms steps(2, end)",
        scanline: "scanline 8s linear infinite", "rgb-shift": "rgbShift 300ms steps(2, end) infinite",
      },
    },
  },
  plugins: [],
}
