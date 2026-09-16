import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 用户站点根路径为 "/"
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
