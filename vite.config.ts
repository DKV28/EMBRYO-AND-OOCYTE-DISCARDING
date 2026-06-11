/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [nodePolyfills({ include: ['buffer', 'process', 'stream', 'util'] })],
  test: {
    environment: 'jsdom',
    globals: true,
    // Pin a UTC+7 zone (the deployment timezone) unless the caller overrides TZ,
    // so date-convention regressions reproduce on UTC CI machines too.
    env: { TZ: process.env.TZ ?? 'Asia/Ho_Chi_Minh' },
  },
});
