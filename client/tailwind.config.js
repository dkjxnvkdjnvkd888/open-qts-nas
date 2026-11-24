/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'qts-window': '0 14px 36px rgba(8, 12, 26, 0.42), 0 0 0 1px rgba(15, 23, 42, 0.22)',
        'qts-window-active': '0 20px 48px rgba(6, 10, 24, 0.56), 0 0 0 1px rgba(15, 23, 42, 0.28)',
        'qts-icon': '0 6px 14px rgba(5, 10, 28, 0.36)',
      },
    },
  },
  plugins: [],
};
