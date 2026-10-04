import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        content: resolve(__dirname, 'src/content/content.ts'),
        background: resolve(__dirname, 'src/background/background.ts')
      },
      output: {
        entryFileNames: chunkInfo => {
          if (chunkInfo.name === 'content') return 'content.js';
          if (chunkInfo.name === 'background') return 'background.js';
          return '[name].js';
        }
      }
    }
  }
});
