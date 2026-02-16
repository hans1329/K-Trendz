import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        upvote: "hsl(var(--upvote))",
        downvote: "hsl(var(--downvote))",
      },
      boxShadow: {
        'card': 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "rainbow-flow": {
          "0%, 100%": { 
            backgroundPosition: "0% 50%" 
          },
          "50%": { 
            backgroundPosition: "100% 50%" 
          },
        },
        "marquee": {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "explode": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.8)", opacity: "0.8" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "twinkle": {
          "0%, 100%": { opacity: "0", transform: "scale(0.5)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
        "particle": {
          "0%": { 
            transform: "translate(-50%, -50%) rotate(var(--angle)) translateY(0)",
            opacity: "1"
          },
          "100%": { 
            transform: "translate(-50%, -50%) rotate(var(--angle)) translateY(-120px)",
            opacity: "0"
          },
        },
        "unlock-wand": {
          "0%": { transform: "scale(0) rotate(-45deg)", opacity: "0" },
          "50%": { transform: "scale(1.5) rotate(15deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        "vote-burst": {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "30%": { transform: "scale(1.4)", opacity: "1" },
          "50%": { transform: "scale(1.2)", opacity: "1" },
          "100%": { transform: "scale(0)", opacity: "0" },
        },
        "rainbow-glow": {
          "0%": { filter: "drop-shadow(0 0 3px rgba(255,100,100,0.5))", color: "rgba(255,200,200,0.9)" },
          "16%": { filter: "drop-shadow(0 0 3px rgba(255,180,100,0.5))", color: "rgba(255,220,200,0.9)" },
          "33%": { filter: "drop-shadow(0 0 3px rgba(255,255,150,0.5))", color: "rgba(255,255,220,0.9)" },
          "50%": { filter: "drop-shadow(0 0 3px rgba(150,255,150,0.5))", color: "rgba(220,255,220,0.9)" },
          "66%": { filter: "drop-shadow(0 0 3px rgba(150,200,255,0.5))", color: "rgba(220,230,255,0.9)" },
          "83%": { filter: "drop-shadow(0 0 3px rgba(200,150,255,0.5))", color: "rgba(235,220,255,0.9)" },
          "100%": { filter: "drop-shadow(0 0 3px rgba(255,100,100,0.5))", color: "rgba(255,200,200,0.9)" },
        },
        "red-glow": {
          "0%, 100%": { 
            boxShadow: "0 0 4px 1px rgba(220, 38, 38, 0.1), 0 0 8px 2px rgba(220, 38, 38, 0.05)" 
          },
          "50%": { 
            boxShadow: "0 0 10px 3px rgba(220, 38, 38, 0.25), 0 0 20px 5px rgba(220, 38, 38, 0.12)" 
          },
        },
        "gradient-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "trophy-wiggle": {
          "0%, 85%, 100%": { transform: "rotate(0deg) scale(1)" },
          "90%": { transform: "rotate(-8deg) scale(1.05)" },
          "95%": { transform: "rotate(8deg) scale(1.05)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "rainbow-flow": "rainbow-flow 2s ease-in-out infinite",
        "marquee": "marquee 30s linear infinite",
        "explode": "explode 0.5s ease-out",
        "shimmer": "shimmer 2s linear infinite",
        "twinkle": "twinkle 2s ease-in-out infinite",
        "particle": "particle 1s ease-out forwards",
        "unlock-wand": "unlock-wand 0.6s ease-out forwards",
        "vote-burst": "vote-burst 0.8s ease-out forwards",
        "rainbow-glow": "rainbow-glow 2s linear infinite",
        "red-glow": "red-glow 6s ease-in-out infinite",
        "gradient-shift": "gradient-shift 8s ease infinite",
        "trophy-wiggle": "trophy-wiggle 4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
