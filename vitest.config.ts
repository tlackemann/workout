import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/core/**/*.test.ts', 'src/server/**/*.test.ts', 'src/data/**/*.test.ts', 'scripts/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['src/client/**/*.test.{ts,tsx}'],
          setupFiles: ['src/client/test/setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/{core,server,client,data}/**/*.{ts,tsx}'],
      exclude: ['**/*.test.*', 'src/server/main.ts', 'src/client/main.tsx', 'src/client/test/**', '**/*.d.ts'],
      reporter: ['text-summary', 'html'],
      // UI flows are also covered end-to-end by Playwright (not counted here).
      thresholds: { statements: 85, lines: 90, functions: 85, branches: 75 },
    },
  },
});
