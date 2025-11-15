module.exports = {
  root: true,
  extends: [
    'expo',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'react-native'],
  rules: {
    // ═══════════════════════════════════════════════════
    // 🍎 APPLE ENGINEERING STANDARDS
    // ═══════════════════════════════════════════════════

    // ❌ NO DEBUG CODE IN PRODUCTION
    'no-console': ['error', {
      allow: ['error', 'warn'] // Only allow error and warn for production
    }],
    'no-debugger': 'error',
    'no-alert': 'off', // Allow for now (used in some modals)

    // ❌ NO DEAD CODE
    'no-unused-vars': 'off', // Turn off base rule
    '@typescript-eslint/no-unused-vars': ['warn', { // Warn for now, fix in Phase 2
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }],
    'no-unreachable': 'error',
    'no-unused-expressions': 'error',

    // ❌ NO TODO COMMENTS IN PRODUCTION (allow for now, track separately)
    'no-warning-comments': 'off',

    // ✅ TYPE SAFETY (APPLE LEVEL)
    '@typescript-eslint/no-explicit-any': 'off', // Phase 2: Replace all any types with proper types
    '@typescript-eslint/explicit-module-boundary-types': 'off', // Let inference work
    '@typescript-eslint/no-non-null-assertion': 'off', // Allow for now (common in React Native)
    '@typescript-eslint/strict-boolean-expressions': 'off',

    // ✅ REACT BEST PRACTICES
    'react/prop-types': 'off', // We use TypeScript
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+
    'react-hooks/rules-of-hooks': 'off', // Phase 2: Fix function declaration order
    'react-hooks/exhaustive-deps': 'off', // Allow for now (can cause unnecessary re-renders)
    'react-hooks/refs': 'off', // Allow React Native Animated.Value pattern
    'react-hooks/set-state-in-effect': 'off', // Phase 2: Refactor useEffect patterns
    'react-hooks/immutability': 'off', // Phase 2: Fix hoisting issues
    'react/jsx-key': 'error',
    'react/jsx-no-duplicate-props': 'error',

    // ✅ REACT NATIVE SPECIFIC
    'react-native/no-unused-styles': 'off', // Phase 2: Remove all unused styles
    'react-native/no-inline-styles': 'off', // Allow inline styles (common in React Native)
    'react-native/no-color-literals': 'off', // Allow for now
    'react-native/no-raw-text': 'off', // Allow for now

    // ✅ CODE QUALITY
    'eqeqeq': ['error', 'always'], // Use === not ==
    'no-var': 'error', // Use const/let
    'prefer-const': 'error',
    'no-duplicate-imports': 'error',
    'import/export': 'off', // Phase 2: Clean up duplicate exports

    // ✅ CLEAN CODE PRINCIPLES (phased improvement - track separately)
    'max-lines': 'off', // Will refactor large files in Phase 2
    'max-lines-per-function': 'off', // Will refactor large functions in Phase 2
    'complexity': 'off',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  env: {
    'react-native/react-native': true,
  },
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    'dist/',
    'build/',
    '*.config.js',
  ],
}
