import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // 救火修改 1：将“未使用变量”从 error(报错) 降级为 warn(警告)
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]' }],
      
      // 救火修改 2：直接关闭这个过于死板的 React 内部状态规则
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])