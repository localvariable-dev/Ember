const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'coverage/**',
      'Docs/**',
      'Voices/**',
      '*.generated.*',
    ],
  },
  {
    files: ['tools/**'],
    rules: {
      'expo/no-dynamic-env-var': 'off',
    },
  },
];
