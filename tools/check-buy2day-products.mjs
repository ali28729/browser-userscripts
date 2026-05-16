import fs from "node:fs/promises";
import path from "node:path";

const SITE_ORIGIN = "https://buy2day.pk";
const SHOP_URL = `${SITE_ORIGIN}/shop/`;
const PER_PAGE = 100;
const DEFAULT_STATE_PATH = path.join("data", "buy2day-products.json");
const DEFAULT_SUMMARY_PATH = path.join("data", "buy2day-new-products.md");

const statePath = process.env.BUY2DAY_PRODUCT_STATE_PATH || DEFAULT_STATE_PATH;
const summaryPath = process.env.BUY2DAY_PRODUCT_SUMMARY_PATH || DEFAULT_SUMMARY_PATH;

const previousState = await readPreviousState(statePath);
const currentProducts = await fetchProducts();
const previousProducts = previousState?.products || [];
const previousProductIds = new Set(previousProducts.map((product) => product.id));
const isInitialRun = previousState?.source !== SHOP_URL;
const newProducts = isInitialRun
  ? []
  : currentProducts.filter((product) => !previousProductIds.has(product.id));

await writeJson(statePath, {
  source: SHOP_URL,
  total: currentProducts.length,
  products: currentProducts,
});

const summary = buildSummary({ currentProducts, newProducts, isInitialRun });
await writeText(summaryPath, summary);
await writeGitHubOutputs({
  isInitialRun,
  newCount: newProducts.length,
  summaryPath,
});

if (process.env.GITHUB_STEP_SUMMARY) {
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}

console.log(
  isInitialRun
    ? `Initialized Buy2Day product snapshot with ${currentProducts.length} eligible products from shop.`
    : `Found ${newProducts.length} new Buy2Day products out of ${currentProducts.length} eligible products.`,
);

async function readPreviousState(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function fetchProducts() {
  const products = [];
  let totalPages = 1;

  for (let page = 1; page <= totalPages; page += 1) {
    const url = new URL("/wp-json/wc/store/v1/products", SITE_ORIGIN);
    url.searchParams.set("per_page", String(PER_PAGE));
    url.searchParams.set("page", String(page));
    url.searchParams.set("orderby", "date");
    url.searchParams.set("order", "desc");
    url.searchParams.set("catalog_visibility", "visible");

    const { data, response } = await fetchJsonWithResponse(url);
    totalPages = Number.parseInt(response.headers.get("x-wp-totalpages") || "1", 10);

    products.push(...data.filter(isEligibleApiProduct).map(normalizeProduct));
  }

  return products;
}

function isEligibleApiProduct(product) {
  const text = [product.name, stripHtml(product.short_description || "")].join(" ").toLowerCase();
  return !text.includes("installment");
}

function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJsonWithResponse(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "browser-userscripts-buy2day-product-checker",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return {
    data: await response.json(),
    response,
  };
}

function normalizeProduct(product) {
  return {
    id: product.id,
    name: decodeHtml(product.name || ""),
    url: product.permalink,
    price: formatPrice(product.prices),
    inStock: Boolean(product.is_in_stock),
  };
}

function formatPrice(prices) {
  if (!prices?.price) {
    return "";
  }

  const minorUnit = Number.parseInt(prices.currency_minor_unit || "0", 10);
  const amount = Number(prices.price) / 10 ** minorUnit;
  const formattedAmount = new Intl.NumberFormat("en-PK", {
    maximumFractionDigits: minorUnit,
    minimumFractionDigits: minorUnit,
  }).format(amount);

  return `${decodeHtml(prices.currency_prefix || "")}${formattedAmount}${decodeHtml(
    prices.currency_suffix || "",
  )}`.trim();
}

function decodeHtml(value) {
  const namedEntities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, token) => {
    if (token.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(token.slice(2), 16));
    }

    if (token.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(token.slice(1), 10));
    }

    return namedEntities[token.toLowerCase()] || entity;
  });
}

function buildSummary({ currentProducts, newProducts, isInitialRun }) {
  if (isInitialRun) {
    return [
      "# Buy2Day Product Snapshot Initialized",
      "",
      `Tracked ${currentProducts.length} eligible products from the shop.`,
      "Future scheduled runs will open an issue when new products appear.",
    ].join("\n");
  }

  if (newProducts.length === 0) {
    return [
      "# No New Buy2Day Products",
      "",
      `Checked ${currentProducts.length} eligible products in the shop.`,
    ].join("\n");
  }

  const productLines = newProducts.map((product) => {
    const stockText = product.inStock ? "in stock" : "out of stock";
    const priceText = product.price ? ` - ${product.price}` : "";

    return `- [${product.name}](${product.url})${priceText} (${stockText})`;
  });

  return [
    `# ${newProducts.length} New Buy2Day Product${newProducts.length === 1 ? "" : "s"}`,
    "",
    ...productLines,
  ].join("\n");
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${value}\n`);
}

async function writeGitHubOutputs({ isInitialRun, newCount, summaryPath: newSummaryPath }) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  await fs.appendFile(
    process.env.GITHUB_OUTPUT,
    [
      `is_initial_run=${isInitialRun}`,
      `new_count=${newCount}`,
      `summary_path=${newSummaryPath}`,
      "",
    ].join("\n"),
  );
}
