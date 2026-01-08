import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/_archived/**',  // archived 테스트 제외
    ],
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
