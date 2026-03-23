import { defineConfig } from 'vitest/config';
import tsconfig from './tsconfig.json' with { type: 'json' };

const vitestDefaultExclude = [
  '**/node_modules/**',
  '**/dist/**',
  '**/cypress/**',
  '**/.{idea,git,cache,output,temp}/**',
  '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
  '**/*.e2e.test.ts',
];

export default defineConfig({
  test: {
    globals: false,
    exclude: vitestDefaultExclude,
    /** Native addon: do not prebundle (Vite fails to resolve exports). */
    server: {
      deps: {
        external: ['kuzu'],
      },
    },
  },
  resolve: {
    extensions: ['.ts'],
  },
  esbuild: {
    target: (tsconfig.compilerOptions?.target as string) ?? 'ES2022',
  },
});
