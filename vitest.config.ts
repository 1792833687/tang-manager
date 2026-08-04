import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // 测试环境
    environment: 'jsdom',

    // 沿用源项目稳定姿势（Windows worker 偶发崩溃防护）：
    // - pool=threads + 受限 worker 数
    // - minWorkers/maxWorkers 必须同时设置
    // - testTimeout=30000：单用例超时上限
    pool: 'threads',
    minWorkers: 1,
    maxWorkers: 2,
    testTimeout: 30_000,

    // 全局 setup — tests/setup.ts（含 localStorage/IndexedDB/fetch/crypto mock）
    setupFiles: ['./tests/setup.ts'],

    // 测试文件匹配（沿用源项目；独立项目仅迁移 tang-* 测试）
    include: [
      'tests/unit/**/*.test.ts',
      'tests/unit/**/*.test.tsx',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],

    // 全局变量
    globals: true,

    // 覆盖率（仅 --coverage 时生效；E1 不跑，E2 如需再按源阈值调整）
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.d.ts',
      ],
      thresholds: {
        // 全局阈值
        statements: 70,
        branches: 65,
        functions: 70,
        lines: 70,

        // 基础设施 70%+
        'src/infrastructure/': {
          statements: 70,
          branches: 65,
          functions: 70,
          lines: 70,
        },

        // 组件 50%+
        'src/components/': {
          statements: 50,
          branches: 40,
          functions: 50,
          lines: 50,
        },

        // lib/ 工具 90%+
        'src/lib/': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
      },
    },
  },

  // 路径别名（与 tsconfig.json 保持一致）
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
