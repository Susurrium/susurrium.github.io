// @ts-check

import eslint from '@eslint/js'
import eslintPluginAstro from 'eslint-plugin-astro'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    files: ['scripts/**/*.{mjs,js,ts}', '*.config.{mjs,ts}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  },
  // Ignore files
  {
    ignores: ['public/scripts/*', '.astro/', 'src/env.d.ts']
  }
]
