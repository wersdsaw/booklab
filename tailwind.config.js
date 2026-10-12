/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bunker: {
          dark: '#0a0510',
          card: 'rgba(15, 10, 25, 0.75)',
          border: 'rgba(255, 255, 255, 0.08)',
          red: '#ef4444',
          amber: '#f59e0b',
          green: '#22c55e',
          blue: '#3b82f6',
          purple: '#a855f7',
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-red': 'glowRed 2s ease-in-out infinite',
        'glow-green': 'glowGreen 2s ease-in-out infinite',
        'glow-amber': 'glowAmber 2s ease-in-out infinite',
      },
      keyframes: {
        glowRed: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)' },
          '50%': { boxShadow: '0 0 30px rgba(239, 68, 68, 0.8)' },
        },
        glowGreen: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(34, 197, 94, 0.4)' },
          '50%': { boxShadow: '0 0 30px rgba(34, 197, 94, 0.8)' },
        },
        glowAmber: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(245, 158, 11, 0.4)' },
          '50%': { boxShadow: '0 0 30px rgba(245, 158, 11, 0.8)' },
        },
      }
    },
  },
  plugins: [],
}
