import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const NETWORK_MESSAGE = 'Network calls belong only in src/services (spec §3); Phase 1 makes none.';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'playwright-report', 'playwright-report-live', 'test-results', '.claude', '.cache'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Security guards: ban code-execution and raw-HTML sinks outright.
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Raw HTML injection is banned; render text through React.',
        },
        {
          selector: 'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]',
          message: 'Assigning raw HTML is banned; render text through React.',
        },
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: 'insertAdjacentHTML is banned; render text through React.',
        },
        {
          selector: "MemberExpression[object.name='document'][property.name=/^(write|writeln)$/]",
          message: 'document.write is banned.',
        },
        {
          selector:
            "JSXOpeningElement:has(JSXAttribute[name.name='target'][value.value='_blank']):not(:has(JSXAttribute[name.name='rel'][value.value=/noopener/]))",
          message: 'Links opening a new tab need rel="noopener noreferrer".',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: NETWORK_MESSAGE },
        { name: 'XMLHttpRequest', message: NETWORK_MESSAGE },
        { name: 'WebSocket', message: NETWORK_MESSAGE },
        { name: 'EventSource', message: NETWORK_MESSAGE },
      ],
    },
  },
  {
    // Tests feed hostile inputs (e.g. javascript: URLs) on purpose to prove they are rejected.
    files: ['**/*.test.{ts,tsx}'],
    rules: { 'no-script-url': 'off' },
  },
  {
    // Phase 2 retrieval adapters are the only place allowed to touch the network.
    files: ['src/services/**/*.{ts,tsx}'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    // Vercel Functions run on the server (Node), where calling the search provider is the point.
    files: ['api/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    files: ['scripts/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.node },
  },
);
