import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// https://vitejs.dev/config/
export default defineConfig({
    // GitHub Pages 用户页（https://lpw94.github.io/）部署在站点根路径
    base: '/',
    plugins: [react()],
});
