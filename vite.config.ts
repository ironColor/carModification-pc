import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://59.110.53.181:8081',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://59.110.53.181:8081',
        changeOrigin: true,
      },
      '/fast': {
        target: 'http://59.110.53.181:8081',
        changeOrigin: true,
      },
    },
  },
});
