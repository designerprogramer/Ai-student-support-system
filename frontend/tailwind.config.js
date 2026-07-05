/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        ink: '#202226',
        brand: {
          green: '#138154',
          blue: '#2B85B7',
          black: '#000000',
          white: '#FFFFFF',
          blueSoft: '#EAF5FB',
          greenSoft: '#E8F3EE'
        },
        slate: '#676C74',
        deep: '#3B3F45',
        cloud: '#F5F5F2',
        panel: '#FFFFFF',
        mist: '#ECECE7',
        line: '#D7D9DE',
        sage: '#647A72',
        amber: '#A58243',
        rose: '#B46565'
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 20px 55px rgba(32, 34, 38, 0.08)',
        lift: '0 24px 60px rgba(32, 34, 38, 0.12)'
      }
    }
  },
  plugins: []
}
