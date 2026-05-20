import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // `base` controls the asset URL prefix in the built HTML.
  // - Domain root (e.g. https://yourdomain.com/) → leave as './' or '/'.
  // - Subfolder (e.g. https://yourdomain.com/ipc/) → set to '/ipc/'.
  // './' is the safest default for shared hosting like Network Solutions
  // because it produces relative asset URLs that survive any deploy path.
  base: './',

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    // Bundle into a single chunk per route to keep FTP uploads simple.
    chunkSizeWarningLimit: 1500,
  },

  server: {
    port: 5173,
    open: true,
  },
});
