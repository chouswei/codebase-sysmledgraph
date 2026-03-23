import { defineConfig } from 'vitest/config';
import tsconfig from './tsconfig.json' with { type: 'json' };

/** Daemon subprocess + TCP client (kept out of default test run on Windows). */
export default defineConfig({
  test: {
    globals: false,
    include: ['test/integration/**/*.e2e.test.ts'],
    /** Global `setStorageRoot` + worker.port path — one e2e file at a time. */
    fileParallelism: false,
  },
  resolve: {
    extensions: ['.ts'],
  },
  esbuild: {
    target: (tsconfig.compilerOptions?.target as string) ?? 'ES2022',
  },
});
