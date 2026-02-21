import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Port configuration for the local development server
    port: 3000,
    // Ensures the server is accessible across the local network if needed
    host: true
  },
  build: {
    // Optimization settings for the production build
    outDir: 'dist',
    sourcemap: false
  }
});