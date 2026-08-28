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
