import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      alias: {
        vue: fileURLToPath(new URL('./node_modules/vue/dist/vue.runtime.esm-bundler.js', import.meta.url)),
        'vue-router': fileURLToPath(new URL('./node_modules/vue-router/dist/vue-router.js', import.meta.url)),
        pinia: fileURLToPath(new URL('./node_modules/pinia/dist/pinia.mjs', import.meta.url)),
        vitest: fileURLToPath(new URL('./node_modules/vitest/dist/index.js', import.meta.url)),
        '@vue/test-utils': fileURLToPath(new URL('./node_modules/@vue/test-utils/dist/vue-test-utils.esm-bundler.mjs', import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
      include: ['../test/frontend/**/*.spec.ts'],
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
