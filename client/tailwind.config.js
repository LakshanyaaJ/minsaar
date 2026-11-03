/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        page: "var(--page)",
        card: "var(--card)",
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
        },
        line: "var(--line)",
        accent: {
          DEFAULT: "var(--accent)",
          soft: "var(--accent-soft)",
        },
        amber: "var(--amber)",
        mint: {
          DEFAULT: "var(--mint)",
          soft: "var(--mint-soft)",
        },
        sky: "var(--sky)",
        rose: "var(--rose)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,22,27,.04), 0 8px 24px rgba(20,22,27,.05)",
      },
      borderRadius: {
        'card': '24px',
        'inner': '14px',
      },
      fontFamily: {
        sans: ['Figtree', 'sans-serif'],
      },
    },
  },
  plugins: [],
}