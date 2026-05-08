import type { Config } from 'tailwindcss';

export default {
  content: ['./newtab.html', './src/**/*.{svelte,ts,html}'],
  theme: {
    extend: {
      colors: {
        paper: {
          bg: '#fdf6e3',
          card: '#fefcf3',
          edge: '#ebe1c8',
          aged: '#f5edd6',
          ink: '#1c1917',
          gold: '#a16207',
          muted: '#856d43',
          dim: '#a8a29e',
        },
      },
      fontFamily: {
        serif: ['"New York"', '"Source Serif Pro"', 'Georgia', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
