import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mdblue: '#0b5fff',
        mdgraphite: '#202936',
        mdcyan: '#35d0ff'
      }
    }
  },
  plugins: []
};
export default config;
