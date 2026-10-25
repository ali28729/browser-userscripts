import fs from "node:fs/promises";
const file = "scripts/buy2day-product-loader.user.js";
const source = await fs.readFile("tools/buy2day-policy.cjs", "utf8");
const script = await fs.readFile(file, "utf8");
const block = `// BEGIN GENERATED BUY2DAY POLICY\n${source}// END GENERATED BUY2DAY POLICY`;
const updated = script.includes("// BEGIN GENERATED BUY2DAY POLICY")
  ? script.replace(
      /\/\/ BEGIN GENERATED BUY2DAY POLICY[\s\S]*?\/\/ END GENERATED BUY2DAY POLICY/,
      () => block,
    )
  : script.replace("(() => {", () => `${block}\n\n(() => {`);
if (process.argv.includes("--check")) {
  if (updated !== script) throw new Error("Run node tools/sync-buy2day-policy.mjs");
} else await fs.writeFile(file, updated);
