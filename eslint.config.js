// eslint.config.js — ESLint v9 (Flat Config) ajustado para React Native
const react = require('eslint-plugin-react');
const reactNative = require('eslint-plugin-react-native');
const reactHooks = require('eslint-plugin-react-hooks');
const babelParser = require('@babel/eslint-parser');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'android/**',
      'ios/**',
      '.expo/**',
      '.expo-shared/**',
      'web-build/**',
      'coverage/**',
    ],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      parser: babelParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        requireConfigFile: false,
        ecmaFeatures: { jsx: true },
        babelOptions: { plugins: ['@babel/plugin-syntax-jsx'] },
      },
    },
    plugins: {
      react,
      'react-native': reactNative,
      'react-hooks': reactHooks,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      // 🚫 crítico en React Native
      'react-native/no-raw-text': 'error',

      // 🚫 reglas de hooks (mantener seguras dependencias y uso)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // 🔇 ruido innecesario
      'no-unused-vars': 'off',
      'react/prop-types': 'off',
    },
  },
];
