import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**']
  },
  js.configs.recommended,
  {
    rules: {
      // { x, y, ...rest } to strip keys is an intentional, common idiom
      'no-unused-vars': ['error', { ignoreRestSiblings: true }]
    }
  },
  {
    // Shared browser code (src/) plus the thin ESM entry points that load it
    files: ['src/**/*.js', 'desktop/renderer.js', 'web/web-renderer.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser
    }
  },
  {
    // Electron main process / preload and the Express server: CommonJS on Node
    files: ['desktop/main.js', 'desktop/menu.js', 'desktop/preload.js', 'desktop/store.js', 'desktop/updater.js', 'web/server.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: globals.node
    }
  },
  {
    // Test suite and manual diagnostic scripts: ESM on Node
    files: ['test/**/*.js', 'tools/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node
    }
  }
];
