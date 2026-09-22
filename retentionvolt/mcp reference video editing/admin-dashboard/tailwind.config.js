/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        admin: {
          bg: '#0a0a0f',
          surface: '#111118',
          border: '#1e1e2e',
          accent: '#6366f1',
          'accent-muted': '#818cf8',
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#ef4444',
          muted: '#6b7280',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      }
    },
  },
  plugins: [],
};
