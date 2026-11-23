/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ command }) => ({
  base: './',
  // Inline everything into one HTML file for the build only; dev server and tests use the normal pipeline.
  plugins: [react(), ...(command === 'build' ? [viteSingleFile()] : [])],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    // The phone-app and flow round-trip tests click through whole screens; 5 s is too tight on a busy laptop.
    testTimeout: 15000,
  },
}));
