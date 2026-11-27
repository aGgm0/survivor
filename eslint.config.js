import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // tools/vfx/pixelfx : dépôt externe cloné (MIT), pas notre code.
  { ignores: ['dist/', 'node_modules/', 'tools/vfx/pixelfx/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
