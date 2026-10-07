import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    // Run west of UTC so date-formatting tests catch timezone shifts.
    env: { TZ: 'America/Los_Angeles' },
  },
});
