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
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  // ── BACKEND : Node.js CommonJS ────────────────────────────────────────────
  //
  // Le bloc ci-dessus n'appliquait que `globals.browser` à TOUS les .js du
  // dépôt, y compris au serveur Node et à ses tests. Résultat : 88 faux
  // `no-undef` sur `require`, `process`, `__dirname`, `Buffer`, `module`…
  // et ~300 sur `jest`, `describe`, `expect` dans `__tests__`.
  //
  // Conséquence concrète : `npx eslint` n'était pas exploitable en CI —
  // impossible de distinguer une vraie régression du bruit de fond. Ces
  // environnements rendent le signal exploitable à nouveau.
  {
    files: ['backend/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'commonjs',
    },
  },
  {
    files: ['backend/**/*.test.js', 'backend/__tests__/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },
  // Les .cjs sont déjà CommonJS : on n'y ajoute que l'environnement Node.
  {
    files: ['backend/**/*.cjs'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'commonjs',
    },
  },
])
