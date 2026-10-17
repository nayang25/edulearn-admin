import {defineConfig} from 'vite';
export default defineConfig({
  css: {postcss: {plugins: []}},
  server: {proxy: {'/api': {target: 'http://127.0.0.1:3001'}}}
});
