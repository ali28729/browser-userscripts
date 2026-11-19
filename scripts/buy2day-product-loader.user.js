// ==UserScript==
// @name         Buy2Day Product Loader
// @namespace    https://github.com/ali28729/browser-userscripts
// @version      1.4.0
// @description  Load consistent, in-stock wishlist matches from Buy2Day, ranked by category and price.
// @match        https://buy2day.pk/product-category/rewards-points-products/*
// @match        https://www.buy2day.pk/product-category/rewards-points-products/*
// @match        https://buy2day.pk/shop/*
// @match        https://www.buy2day.pk/shop/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/ali28729/browser-userscripts/main/scripts/buy2day-product-loader.user.js
// @downloadURL  https://raw.githubusercontent.com/ali28729/browser-userscripts/main/scripts/buy2day-product-loader.user.js
// ==/UserScript==

// BEGIN GENERATED BUY2DAY POLICY
/* global module */
// Shared by Node and the generated userscript block. Edit here, then run sync.
(function (root) {
  const policy = {
    // Editable defaults inferred from recent shopping; no unconfirmed price ceiling.
    categories: [
      { name: "Induction cookers", pattern: "\\binduction\\b", priority: 2 },
      {
        name: "Heaters",
        pattern: "\\b(?:room heater|fan heater|oil filled|oil heater|convector|ceramic heater)\\b",
        priority: 1,
      },
    ],
    blocked:
      "\\b(?:installments?|coffee|espresso|straightener|chopper|blender|waffle|hair dryer|water heater|geyser)\\b",
  };
  const words = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/&(?:amp|nbsp);/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/);
  const tokens = (s) => words(s).flatMap((w) => w.match(/[a-z]+|[0-9]+/g) || []);
  const models = (s) => words(s).filter((w) => /\d/.test(w));
  function canonical(url) {
    try {
      const u = new URL(url);
      if (
        u.protocol !== "https:" ||
        !["buy2day.pk", "www.buy2day.pk"].includes(u.hostname) ||
        !/^\/product\/[^/]+\/?$/.test(u.pathname)
      )
        return null;
      return `https://buy2day.pk${u.pathname.replace(/\/$/, "")}/`;
    } catch {
      return null;
    }
  }
  function evaluate(p) {
    const url = canonical(p.url);
    if (!url) return { reason: "invalid product URL" };
    const slug = decodeURIComponent(new URL(url).pathname.split("/")[2]);
    const a = new Set(tokens(p.name));
    const b = new Set(tokens(slug));
    const overlap = [...a].filter((t) => b.has(t)).length / Math.max(a.size, b.size, 1);
    // Model digit sequences must agree too: catches NA130 vs HD130 conservatively.
    const modelName = models(p.name).join("");
    const modelSlug = models(slug).join("");
    if (overlap < 0.75 || (modelName && modelSlug && modelName !== modelSlug))
      return { reason: "name/URL mismatch" };
    if (new RegExp(policy.blocked, "i").test(`${p.name} ${p.description || ""} ${slug}`))
      return { reason: "blocked category" };
    const category = policy.categories.find(
      (c) =>
        new RegExp(c.pattern, "i").test(p.name) &&
        new RegExp(c.pattern, "i").test(slug.replace(/-/g, " ")),
    );
    if (!category) return { reason: "outside wishlist" };
    if (!p.inStock) return { reason: "out of stock" };
    return { category: category.name, priority: category.priority, url };
  }
  function duplicate(a, b) {
    if (a.id === b.id || canonical(a.url) === canonical(b.url)) return true;
    const x = new Set(words(a.name));
    const y = new Set(words(b.name));
    if (models(a.name).join("") !== models(b.name).join("")) return false;
    const intersection = [...x].filter((t) => y.has(t)).length;
    return intersection / (x.size + y.size - intersection || 1) >= 0.85;
  }
  function select(products, previous = []) {
    const rejected = [];
    const candidates = [];
    for (const p of products) {
      let result;
      try {
        result = evaluate(p);
      } catch {
        result = { reason: "invalid product URL" };
      }
      if (result.reason) rejected.push({ ...p, reason: result.reason });
      else candidates.push({ ...p, ...result });
    }
    candidates.sort(
      (a, b) =>
        b.priority - a.priority ||
        (Number.isFinite(a.amount) ? a.amount : Infinity) -
          (Number.isFinite(b.amount) ? b.amount : Infinity) ||
        a.name.localeCompare(b.name) ||
        String(a.id).localeCompare(String(b.id)),
    );
    const matches = [];
    for (const p of candidates) {
      if ([...previous, ...matches].some((old) => duplicate(p, old)))
        rejected.push({ ...p, reason: "duplicate or previously seen" });
      else matches.push(p);
    }
    return { matches, rejected };
  }
  root.Buy2DayPolicy = { policy, select, evaluate, duplicate, canonical };
})(typeof module === "object" ? module.exports : globalThis);
// END GENERATED BUY2DAY POLICY

(() => {
  "use strict";

  const STYLE_ID = "buy2day-product-loader-style";
  const BUTTON_ID = "buy2day-product-loader-button";
  const PANEL_CLASS = "buy2day-loader-panel";
  const GRID_CLASS = "buy2day-products-grid";
  const HIDDEN_SITE_CONTROL_CLASS = "buy2day-site-control-hidden";
  const ORDERING_SELECTOR = ".woocommerce-ordering select[name='orderby']";
  const DEFAULT_ORDERBY = "menu_order";
  const DEFAULT_CLIENT_SORT = "server";
  const CLIENT_SORT_OPTIONS = [
    { value: "server", label: "Wishlist priority, then price" },
    { value: "price-asc", label: "Price: low to high" },
    { value: "price-desc", label: "Price: high to low" },
    { value: "name-asc", label: "Name: A-Z" },
    { value: "name-desc", label: "Name: Z-A" },
  ];

  const state = {
    descriptionCache: new Map(),
    latestRunId: 0,
    totalPages: null,
  };

  init();

  function init() {
    injectStyles();
    addLoadButton();

    document.addEventListener("keydown", (event) => {
      if (event.altKey && event.key.toLowerCase() === "x") {
        loadProducts();
      }
    });
  }

  async function loadProducts(options = {}) {
    const container = document.querySelector("ul.products");
    if (!container) {
      return;
    }

    const runId = state.latestRunId + 1;
    state.latestRunId = runId;

    const orderby = options.orderby || getSelectedOrderby();
    const searchTerm = options.searchTerm || "";
    const clientSort = options.clientSort || DEFAULT_CLIENT_SORT;
    const totalPages = options.totalPages || getTotalPages();
    state.totalPages = totalPages;
    const urls = getProductPageUrls(totalPages, orderby);
    const countText = document.querySelector(".woocommerce-result-count");
    const siteOrdering = document.querySelector(".woocommerce-ordering");

    renderLoadingState(container, countText, urls.length, orderby);

    try {
      const pages = await fetchPagesConcurrently(urls);
      if (runId !== state.latestRunId) {
        return;
      }

      const products = parseEligibleProducts(pages);
      renderProducts(container, products);
      renderControls({
        container,
        countText,
        siteOrdering,
        orderby,
        searchTerm,
        clientSort,
        totalPages,
      });
      sortLoadedProducts(container, clientSort);
      addTooltipDescriptions(container);
      filterProducts(container, searchTerm);
    } catch (error) {
      renderError(container, error);
      throw error;
    }
  }

  function renderLoadingState(container, countText, pageCount, orderby) {
    container.classList.add(GRID_CLASS);
    container.innerHTML = `
      <li class="buy2day-loader-message">
        Loading eligible products from ${pageCount} pages using ${getOrderbyLabel(orderby)}...
      </li>
    `;

    if (countText) {
      countText.textContent = "Loading eligible products...";
    }
  }

  async function fetchPagesConcurrently(urls) {
    return Promise.all(
      urls.map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${url}: ${response.status}`);
        }

        return response.text();
      }),
    );
  }

  function parseEligibleProducts(pages) {
    const parser = new DOMParser();

    const nodes = pages.flatMap((html) => {
      const doc = parser.parseFromString(html, "text/html");

      return Array.from(doc.querySelectorAll("li.product")).filter(isEligibleProduct);
    });
    const products = nodes.map((node, index) => ({
      id: node.querySelector("[data-product_id]")?.dataset.product_id || `node-${index}`,
      name: getProductName(node),
      url:
        node.querySelector("a.woocommerce-LoopProduct-link, a.woocommerce-loop-product__link")
          ?.href || "",
      amount: getProductPrice(node) || null,
      inStock: true,
      node,
    }));
    return globalThis.Buy2DayPolicy.select(products).matches.map((p) => p.node);
  }

  function isEligibleProduct(product) {
    if (product.classList.contains("outofstock")) return false;
    const text = (product.textContent || "").toLowerCase();
    return !text.includes("out of stock") && !text.includes("installment");
  }

  function renderProducts(container, products) {
    container.innerHTML = "";
    container.classList.add(GRID_CLASS);

    products.forEach((product, index) => {
      product.removeAttribute("style");
      product.dataset.buy2dayOriginalIndex = String(index);
      container.appendChild(product);
    });

    document
      .querySelectorAll(".woocommerce-pagination")
      .forEach((pagination) => pagination.remove());
  }

  function renderControls({
    container,
    countText,
    siteOrdering,
    orderby,
    searchTerm,
    clientSort,
    totalPages,
  }) {
    document.querySelector(`.${PANEL_CLASS}`)?.remove();

    if (countText) {
      countText.classList.add(HIDDEN_SITE_CONTROL_CLASS);
      countText.textContent = `Showing ${container.querySelectorAll("li.product").length} eligible products`;
    }

    if (siteOrdering) {
      siteOrdering.classList.add(HIDDEN_SITE_CONTROL_CLASS);
    }

    const panel = document.createElement("div");
    panel.className = PANEL_CLASS;
    panel.innerHTML = `
      <div class="buy2day-loader-summary">
        <strong>${container.querySelectorAll("li.product").length}</strong>
        <span>eligible products</span>
        <small>${totalPages} pages, ${getOrderbyLabel(orderby)}</small>
      </div>
      <div class="buy2day-loader-controls">
        <label class="buy2day-loader-field buy2day-loader-catalog-sort">
          <span>Catalog sort</span>
        </label>
        <label class="buy2day-loader-field buy2day-loader-client-sort">
          <span>Loaded sort</span>
        </label>
        <label class="buy2day-loader-field buy2day-loader-search">
          <span>Search</span>
        </label>
      </div>
    `;

    const catalogSort = createCatalogSortSelect(orderby);
    const loadedSort = createLoadedSortSelect(clientSort);
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search products";
    search.value = searchTerm;

    panel.querySelector(".buy2day-loader-catalog-sort").appendChild(catalogSort);
    panel.querySelector(".buy2day-loader-client-sort").appendChild(loadedSort);
    panel.querySelector(".buy2day-loader-search").appendChild(search);

    catalogSort.addEventListener("change", () => {
      loadProducts({
        orderby: catalogSort.value,
        searchTerm: search.value,
        clientSort: loadedSort.value,
        totalPages,
      });
    });

    loadedSort.addEventListener("change", () => {
      sortLoadedProducts(container, loadedSort.value);
    });

    search.addEventListener("input", () => {
      filterProducts(container, search.value);
    });

    container.before(panel);
  }

  function createCatalogSortSelect(orderby) {
    const sort = document.createElement("select");
    const siteOptions = getSiteOrderingOptions();

    siteOptions.forEach(({ value, label }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = value === orderby;
      sort.appendChild(option);
    });

    return sort;
  }

  function createLoadedSortSelect(clientSort) {
    const sort = document.createElement("select");

    CLIENT_SORT_OPTIONS.forEach(({ value, label }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = value === clientSort;
      sort.appendChild(option);
    });

    return sort;
  }

  function sortLoadedProducts(container, clientSort) {
    const products = Array.from(container.querySelectorAll("li.product"));

    products
      .sort((firstProduct, secondProduct) =>
        compareProducts(firstProduct, secondProduct, clientSort),
      )
      .forEach((product) => container.appendChild(product));
  }

  function compareProducts(firstProduct, secondProduct, clientSort) {
    if (clientSort === "price-asc" || clientSort === "price-desc") {
      const firstPrice = getProductPrice(firstProduct);
      const secondPrice = getProductPrice(secondProduct);

      return clientSort === "price-asc" ? firstPrice - secondPrice : secondPrice - firstPrice;
    }

    if (clientSort === "name-asc" || clientSort === "name-desc") {
      const firstName = getProductName(firstProduct);
      const secondName = getProductName(secondProduct);

      return clientSort === "name-asc"
        ? firstName.localeCompare(secondName)
        : secondName.localeCompare(firstName);
    }

    return getOriginalProductIndex(firstProduct) - getOriginalProductIndex(secondProduct);
  }

  function getProductPrice(product) {
    const salePrice = product.querySelector(".price ins .woocommerce-Price-amount");
    const anyPrice = product.querySelector(".price .woocommerce-Price-amount");
    const priceText = (salePrice || anyPrice)?.textContent || "";
    const parsed = Number.parseFloat(priceText.replace(/[^\d.]/g, ""));

    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function getOriginalProductIndex(product) {
    return Number.parseInt(product.dataset.buy2dayOriginalIndex || "0", 10);
  }

  function filterProducts(container, searchTerm) {
    const term = searchTerm.trim().toLowerCase();

    container.querySelectorAll("li.product").forEach((product) => {
      const name = getProductName(product).toLowerCase();
      product.hidden = term.length > 0 && !name.includes(term);
    });
  }

  function renderError(container, error) {
    container.innerHTML = `
      <li class="buy2day-loader-message buy2day-loader-error">
        Could not load products. ${error.message}
      </li>
    `;
  }

  function getProductPageUrls(totalPages, orderby) {
    return Array.from({ length: totalPages }, (_, index) => getProductPageUrl(index + 1, orderby));
  }

  function getTotalPages() {
    const paginationPages = Array.from(
      document.querySelectorAll(".woocommerce-pagination .page-numbers"),
    )
      .map((pageNumber) => Number.parseInt(pageNumber.textContent, 10))
      .filter(Number.isFinite);

    return Math.max(1, state.totalPages || 1, ...paginationPages);
  }

  function getProductPageUrl(page, orderby) {
    const url = new URL(location.href);
    const pathname = url.pathname.replace(/\/page\/\d+\/?$/, "/");
    const categoryPathname = pathname.endsWith("/") ? pathname : `${pathname}/`;

    url.pathname = page === 1 ? categoryPathname : `${categoryPathname}page/${page}/`;
    url.search = "";
    url.searchParams.set("orderby", orderby);

    return url.href;
  }

  function getSelectedOrderby() {
    const selectedOrderby =
      document.querySelector(ORDERING_SELECTOR)?.value ||
      new URL(location.href).searchParams.get("orderby");

    return selectedOrderby || DEFAULT_ORDERBY;
  }

  function getSiteOrderingOptions() {
    const siteOptions = Array.from(document.querySelectorAll(`${ORDERING_SELECTOR} option`));

    if (siteOptions.length > 0) {
      return siteOptions.map((option) => ({
        value: option.value,
        label: option.textContent.trim(),
      }));
    }

    return [
      { value: "menu_order", label: "Default sorting" },
      { value: "popularity", label: "Sort by popularity" },
      { value: "rating", label: "Sort by average rating" },
      { value: "date", label: "Sort by latest" },
      { value: "price", label: "Sort by price: low to high" },
      { value: "price-desc", label: "Sort by price: high to low" },
    ];
  }

  function getOrderbyLabel(orderby) {
    return getSiteOrderingOptions().find((option) => option.value === orderby)?.label || orderby;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${HIDDEN_SITE_CONTROL_CLASS} {
        display: none !important;
      }

      .${PANEL_CLASS} {
        display: grid;
        grid-template-columns: minmax(160px, 220px) 1fr;
        align-items: center;
        gap: 18px;
        margin: 18px 0 22px;
        padding: 14px;
        background: #ffffff;
        border: 1px solid #d8dee6;
        border-radius: 8px;
        box-shadow: 0 8px 22px rgba(28, 39, 49, 0.08);
      }

      .buy2day-loader-summary {
        display: grid;
        gap: 2px;
        color: #1e2933;
      }

      .buy2day-loader-controls {
        display: grid;
        grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) minmax(220px, 1.25fr);
        align-items: end;
        gap: 12px;
      }

      .buy2day-loader-summary strong {
        font-size: 24px;
        line-height: 1;
      }

      .buy2day-loader-summary span {
        font-size: 14px;
      }

      .buy2day-loader-summary small,
      .buy2day-loader-field span {
        color: #66758a;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
      }

      .buy2day-loader-field {
        display: grid;
        gap: 6px;
        margin: 0;
      }

      .buy2day-loader-field select,
      .buy2day-loader-field input {
        box-sizing: border-box;
        width: 100%;
        height: 40px;
        margin-bottom: 0;
        padding: 0 12px;
        color: #1e2933;
        background: #f8fafc;
        border: 1px solid #c9d2dc;
        border-radius: 6px;
        font-size: 14px;
      }

      ul.products.${GRID_CLASS} {
        display: grid !important;
        grid-template-columns: repeat(auto-fill, minmax(185px, 1fr)) !important;
        gap: 18px !important;
        align-items: stretch !important;
        margin-top: 0 !important;
      }

      ul.products.${GRID_CLASS}::before,
      ul.products.${GRID_CLASS}::after {
        display: none !important;
      }

      ul.products.${GRID_CLASS} li.product {
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        float: none !important;
        width: auto !important;
        min-height: 100% !important;
        margin: 0 !important;
        padding: 12px !important;
        background: #ffffff !important;
        border: 1px solid #e0e6ed !important;
        border-radius: 8px !important;
        box-shadow: 0 8px 18px rgba(28, 39, 49, 0.06);
      }

      ul.products.${GRID_CLASS} li.product[hidden] {
        display: none !important;
      }

      ul.products.${GRID_CLASS} li.product img {
        width: 100% !important;
        max-height: 150px !important;
        object-fit: contain !important;
        margin: 0 auto 10px !important;
      }

      ul.products.${GRID_CLASS} li.product .woocommerce-loop-product__title {
        min-height: 42px;
        margin: 0 0 8px !important;
        color: #1e2933;
        font-size: 14px !important;
        line-height: 1.35 !important;
      }

      ul.products.${GRID_CLASS} li.product .price {
        margin-top: auto !important;
        color: #0f766e !important;
        font-size: 15px !important;
        font-weight: 700 !important;
      }

      ul.products.${GRID_CLASS} li.product .price del {
        color: #9ca3af !important;
        font-size: 12px !important;
        font-weight: 400 !important;
      }

      ul.products.${GRID_CLASS} li.product .price ins {
        text-decoration: none !important;
      }

      ul.products.${GRID_CLASS} li.product .button {
        align-self: stretch;
        margin-top: 10px !important;
        padding: 9px 10px !important;
        border-radius: 6px !important;
        text-align: center;
      }

      .buy2day-loader-message {
        grid-column: 1 / -1;
        padding: 22px !important;
        list-style: none;
        text-align: center;
        color: #1e2933;
        background: #ffffff;
        border: 1px solid #d8dee6;
        border-radius: 8px;
      }

      .buy2day-loader-error {
        color: #9f1239;
        border-color: #fecdd3;
        background: #fff1f2;
      }

      #${BUTTON_ID} {
        position: fixed;
        right: 20px;
        bottom: 13px;
        z-index: 999999;
        padding: 8px 13px;
        color: #ffffff;
        background: #111827;
        border: none;
        border-radius: 8px;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
      }

      #${BUTTON_ID}:disabled {
        cursor: progress;
        opacity: 0.7;
      }

      @media (max-width: 760px) {
        .${PANEL_CLASS} {
          grid-template-columns: 1fr;
        }

        .buy2day-loader-controls {
          grid-template-columns: 1fr;
        }

        ul.products.${GRID_CLASS} {
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)) !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function addTooltipDescriptions(container) {
    container.querySelectorAll("li.product").forEach((product) => {
      product.addEventListener(
        "mouseenter",
        async () => {
          const anchor = product.querySelector("a");
          const link = anchor?.href;
          if (!link) {
            return;
          }

          if (state.descriptionCache.has(link)) {
            product.title = state.descriptionCache.get(link);
            return;
          }

          const html = await fetch(link).then((response) => response.text());
          const doc = new DOMParser().parseFromString(html, "text/html");
          const description =
            doc.querySelector("#tab-description")?.innerText || "No description available";

          state.descriptionCache.set(link, description.trim());
          product.title = state.descriptionCache.get(link);
        },
        { once: true },
      );
    });
  }

  function getProductName(productElement) {
    return productElement.querySelector(".woocommerce-loop-product__title")?.textContent || "";
  }

  function addLoadButton() {
    if (document.getElementById(BUTTON_ID)) {
      return;
    }

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "Load Wishlist Matches";

    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Loading...";

      try {
        await loadProducts();
      } finally {
        button.textContent = "Load Wishlist Matches";
        button.disabled = false;
      }
    });

    document.body.appendChild(button);
  }
})();
