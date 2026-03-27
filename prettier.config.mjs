/** @typedef  {import("prettier").Config} PrettierConfig */
/** @typedef  {import("@ianvs/prettier-plugin-sort-imports").PluginConfig} SortImportsConfig */

/** @type { PrettierConfig | SortImportsConfig | TailwindConfig  } */
const config = {
  arrowParens: "always",
  printWidth: 100,
  singleQuote: true,
  jsxSingleQuote: false,
  semi: true,
  trailingComma: "all",
  tabWidth: 2,
  plugins: [
    "@ianvs/prettier-plugin-sort-imports",
  ],
  importOrder: [
    "<THIRD_PARTY_MODULES>",
    "",
    "^@/",
    "^[../]",
    "^[./]",
  ],
  importOrderParserPlugins: ["typescript", "decorators-legacy"],
  importOrderTypeScriptVersion: "4.4.0",
};

export default config;
