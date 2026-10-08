import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Component tests (*.test.tsx) opt into jsdom with a
    // `// @vitest-environment jsdom` comment; the rest run in Node.
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    // Run west of UTC so date-formatting tests catch timezone shifts.
    env: { TZ: 'America/Los_Angeles' },
  },
});
