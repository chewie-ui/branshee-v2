import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  // Application de bureau : processus Electron en CommonJS.
  { files: ["desktop/**/*.js"], rules: { "@typescript-eslint/no-require-imports": "off" } },
  { ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "drizzle/**", "desktop/node_modules/**", "desktop/dist/**"] },
];

export default eslintConfig;
