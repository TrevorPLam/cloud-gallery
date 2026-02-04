// AI-META-BEGIN
// AI-META: ESLint configuration with Expo and Prettier integration
// OWNERSHIP: build/config
// ENTRYPOINTS: npm run lint, npm run lint:fix
// DEPENDENCIES: eslint-config-expo, eslint-plugin-prettier
// DANGER: eslint-plugin-prettier must be last in config array; dist folder ignored to prevent checking build artifacts
// CHANGE-SAFETY: safe to add custom rules; do not remove expoConfig; ignores list protects build outputs
// TESTS: npm run lint
// AI-META-END

// AI-NOTE: Flat config format is ESLint 9+; Prettier integration ensures formatting and linting stay aligned
// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ["dist/*"],
  },
]);
