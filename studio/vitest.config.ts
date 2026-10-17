import { defineProject } from 'vitest/config';

/** Vitest project of the studio; also picked up by the root configuration's project list. */
export default defineProject({
  test: {
    name: '@spotless/studio',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
