import nextPlugin from '@next/eslint-plugin-next';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    plugins: {
      '@next': nextPlugin,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
      '@typescript-eslint': typescriptPlugin
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react/no-unescaped-entities': 'off',
      '@next/next/no-img-element': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
      'react/no-children-prop': 'off'
    },
    ignores: [
      'src/app/[guideSlug]/__pp_copy/page.tsx',
      'src/app/[guideSlug]/__pp_copy/chatIntegration.tsx',
      'src/app/backoffice/conversations/page.tsx',
      'src/app/backoffice/page.tsx',
      'src/app/backoffice/select/page.tsx',
      'src/app/backoffice/users/page.tsx',
      'src/firebase/guideServices.ts',
      'src/firebase/userServices.ts',
      'src/services/sessionService.ts',
      'src/types/session.ts'
    ]
  }
];