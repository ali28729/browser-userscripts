// ==UserScript==
// @name         Buy2Day Product Loader
// @namespace    https://github.com/ali28729/browser-userscripts
// @version      1.1.0
// @description  Load all in-stock products and add client-side search and sorting.
// @match        https://www.buy2day.pk/product-category/rewards-points-products/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/ali28729/browser-userscripts/main/scripts/buy2day-product-loader.user.js
// @downloadURL  https://raw.githubusercontent.com/ali28729/browser-userscripts/main/scripts/buy2day-product-loader.user.js
// ==/UserScript==

(() => {
  "use strict";

  const BASE = "https://www.buy2day.pk/product-category/rewards-points-products/page/";
  const TOTAL_PAGES = 11;
  const STYLE_ID = "vm-grid-fix";

  async function runScript() {
    const container = document.querySelector("ul.products");
    if (!container) {
      return;
    }

    const firstPageUrl = location.href;
    container.innerHTML = "<h2 style='padding:20px'>Loading products...</h2>";

    const urls = [firstPageUrl];
    for (let page = 2; page <= TOTAL_PAGES; page += 1) {
      urls.push(`${BASE}${page}/?orderby=price`);
    }

    const pages = await Promise.all(
      urls.map((url) => fetch(url).then((response) => response.text())),
    );
    const parser = new DOMParser();
    const products = [];

    pages.forEach((html) => {
      const doc = parser.parseFromString(html, "text/html");

      doc.querySelectorAll("li.product").forEach((item) => {
        const isOutOfStock =
          item.classList.contains("outofstock") ||
          (item.textContent || "").toLowerCase().includes("out of stock");

        if (!isOutOfStock) {
          products.push(item);
        }
      });
    });

    document
      .querySelectorAll(".woocommerce-pagination")
      .forEach((pagination) => pagination.remove());

    const countText = document.querySelector(".woocommerce-result-count");
    if (countText) {
      countText.textContent = `Showing ${products.length} in-stock products`;
    }

    container.innerHTML = "";
    products.forEach((product) => container.appendChild(product));

    container.style.display = "grid";
    container.style.gridTemplateColumns = "repeat(auto-fill, minmax(240px, 1fr))";
    container.style.gap = "25px";
    container.style.alignItems = "stretch";
    container.style.gridAutoRows = "1fr";

    container.querySelectorAll("li.product").forEach((product) => {
      product.style.width = "auto";
      product.style.float = "none";
    });

    injectStyles();
    addClientControls(container);
    addTooltipDescriptions(container);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
            ul.products::before,
            ul.products::after {
                display: none !important;
            }

            .vm-controls {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-left: 15px;
            }

            .vm-controls select,
            .vm-controls input {
                padding: 6px 8px;
                border: 1px solid #ccc;
                border-radius: 4px;
                font-size: 13px;
            }

            .vm-controls input {
                width: 180px;
            }
        `;

    document.head.appendChild(style);
  }

  function addClientControls(container) {
    const wrapper = document.querySelector(".woocommerce-ordering");
    if (!wrapper || document.querySelector(".vm-controls")) {
      return;
    }

    const controls = document.createElement("div");
    controls.className = "vm-controls";
    wrapper.after(controls);

    const sort = document.createElement("select");
    sort.innerHTML = `
            <option value="">Client Sort</option>
            <option value="price-asc">Price ↑</option>
            <option value="price-desc">Price ↓</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
        `;
    controls.appendChild(sort);

    sort.addEventListener("change", () => {
      const items = Array.from(container.querySelectorAll("li.product"));

      items.sort((a, b) => {
        if (sort.value.includes("price")) {
          const pa = getPrice(a);
          const pb = getPrice(b);
          return sort.value === "price-asc" ? pa - pb : pb - pa;
        }

        if (sort.value.includes("name")) {
          const na = getProductName(a);
          const nb = getProductName(b);
          return sort.value === "name-asc" ? na.localeCompare(nb) : nb.localeCompare(na);
        }

        return 0;
      });

      items.forEach((item) => container.appendChild(item));
    });

    const search = document.createElement("input");
    search.placeholder = "Search products...";
    controls.appendChild(search);

    search.addEventListener("input", () => {
      const term = search.value.toLowerCase();

      container.querySelectorAll("li.product").forEach((product) => {
        const name = getProductName(product).toLowerCase();
        product.style.display = name.includes(term) ? "" : "none";
      });
    });
  }

  function addTooltipDescriptions(container) {
    const cache = {};

    container.querySelectorAll("li.product").forEach((product) => {
      product.addEventListener(
        "mouseenter",
        async () => {
          const anchor = product.querySelector("a");
          const link = anchor?.href;
          if (!link) {
            return;
          }

          if (cache[link]) {
            product.title = cache[link];
            return;
          }

          const html = await fetch(link).then((response) => response.text());
          const doc = new DOMParser().parseFromString(html, "text/html");

          const description =
            doc.querySelector("#tab-description")?.innerText || "No description available";

          cache[link] = description.trim();
          product.title = cache[link];
        },
        { once: true },
      );
    });
  }

  function getPrice(productElement) {
    const priceText = productElement.querySelector(".price")?.textContent || "0";
    const parsed = Number.parseFloat(priceText.replace(/[^\d.]/g, ""));
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function getProductName(productElement) {
    return productElement.querySelector(".woocommerce-loop-product__title")?.textContent || "";
  }

  const button = document.createElement("button");
  button.textContent = "Load In-Stock Products";
  button.style.cssText = `
        position: fixed;
        bottom: 13px;
        right: 20px;
        padding: 6px 12px;
        background: black;
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: bold;
        cursor: pointer;
        z-index: 999999;
        font-size: 13px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
    `;

  button.onclick = async () => {
    button.disabled = true;
    button.textContent = "Loading Products...";

    try {
      await runScript();
    } finally {
      button.textContent = "Load In-Stock Products";
      button.disabled = false;
    }
  };

  document.body.appendChild(button);

  document.addEventListener("keydown", (event) => {
    if (event.altKey && event.key.toLowerCase() === "x") {
      runScript();
    }
  });
})();
