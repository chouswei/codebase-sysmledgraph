import { defineConfig } from 'vitest/config';
import tsconfig from './tsconfig.json' with { type: 'json' };

export default defineConfig({
  test: {
    globals: false,
  },
  resolve: {
    extensions: ['.ts'],
  },
  esbuild: {
    target: (tsconfig.compilerOptions?.target as string) ?? 'ES2022',
  },
});
