/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#FAFAF9',
        surface: '#FFFFFF',
        border: '#E7E5E4',
        text: {
          primary: '#1C1917',
          secondary: '#78716C',
          muted: '#A8A29E',
        },
        accent: {
          DEFAULT: '#7C5C3E',
          light: '#D6C4AE',
          pale: '#F5EFE8',
        },
        user: '#7C5C3E',
        agent: '#F5F5F4',
      },
      fontFamily: {
        sans: ['PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
