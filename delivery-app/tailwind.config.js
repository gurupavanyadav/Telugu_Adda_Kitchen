/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf4f3',
          100: '#fce7e5',
          200: '#f9cfcc',
          300: '#f3aaa4',
          400: '#ea7a70',
          500: '#dd5246',
          600: '#c8362a',
          700: '#a8281e',
          800: '#7a1f17',
          900: '#5c1a13',
          950: '#3d0f0a',
        },
        gold: {
          50: '#fefce8',
          100: '#fdf6c3',
          200: '#fbe98a',
          300: '#f9d54a',
          400: '#f5c018',
          500: '#e0a008',
          600: '#bc7c06',
          700: '#975a08',
          800: '#7c4810',
          900: '#683b12',
          950: '#3f2008',
        },
        cream: {
          50: '#fefdf8',
          100: '#fdf9e9',
          200: '#faf0d0',
          300: '#f5e0a8',
          400: '#eecb78',
          500: '#e5b354',
        },
        charcoal: {
          50: '#f6f5f3',
          100: '#e8e6e1',
          200: '#d1ccc3',
          300: '#b0a89b',
          400: '#8e8474',
          500: '#736a5b',
          600: '#5b5448',
          700: '#463f36',
          800: '#322d26',
          900: '#1f1c17',
          950: '#12100d',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};