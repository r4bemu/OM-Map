import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('wmrFontsBase64')) {
              return 'wmr-fonts';
            }
            if (id.includes('node_modules/jspdf') || id.includes('node_modules/jspdf-autotable') || id.includes('node_modules/html2canvas')) {
              return 'pdf-engine';
            }
            if (id.includes('node_modules/leaflet') || id.includes('node_modules/esri-leaflet')) {
              return 'leaflet-engine';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'icons';
            }
          }
        }
      }
    },
    server: {
      allowedHosts: true as const,
      // HMR configuration
      hmr: process.env.DISABLE_HMR !== 'true',
      // Ignore data, persistent files, and logs to prevent page reload loops
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: [
          '**/data/**',
          '**/.git/**',
          '**/persistent_*.*',
          '**/*.json',
          '**/dist/**',
          '**/.gemini/**'
        ]
      },
    },
  };
});
