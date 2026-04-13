# Browser Userscripts

Small browser userscripts for improving web interfaces, plus supporting automation for the specific workflows those scripts serve.

## Repository Layout

```text
scripts/
  *.user.js                 Browser userscripts installed in Violentmonkey/Tampermonkey/Greasemonkey.

tools/
  *.mjs                     Node.js helpers used locally or by GitHub Actions.

data/
  *.json, *.md              Automation state and generated summaries.

.github/workflows/
  *.yml                     CI and scheduled automation.
```

The files in `tools/` are not browser userscripts. They are repo automation helpers. For example, `scripts/buy2day-product-loader.user.js` changes the Buy2Day page in your browser, while `tools/check-buy2day-products.mjs` runs in Node.js so GitHub Actions can check the catalog on a schedule.

## Userscript Installation

1. Install `Violentmonkey`, `Tampermonkey`, or `Greasemonkey`.
2. Open the raw userscript URL from this repository.
3. Confirm installation in the extension.

## Buy2Day Product Loader

Loads in-stock products from Buy2Day rewards pages into one consolidated browser view.

Context:

- Intended for browsing redeemable in-stock items for Standard Chartered Pakistan credit card rewards.
- Rewards promotion entry page: `https://www.sc.com/pk/promotions/credit-card-rewards/`
- Script execution targets:
  - `https://buy2day.pk/product-category/rewards-points-products/*`
  - `https://www.buy2day.pk/product-category/rewards-points-products/*`

Features:

-Fetches all catalog pages (per selected WooCommerce sort)

- Excludes out-of-stock items
- Uses Buy2Day’s native sorting
- Local sort (order, price, name) + client-side search
- Concurrent loading for speed
- Clean grid view with hover descriptions

Install URL:

`https://raw.githubusercontent.com/ali28729/browser-userscripts/main/scripts/buy2day-product-loader.user.js`

Shortcut:

- `Alt+X` also loads the in-stock product view on the Buy2Day rewards page.

## Buy2Day Product Notifications

This repo includes a free GitHub Actions watcher for new Buy2Day rewards products.

Files:

- `.github/workflows/buy2day-product-watch.yml`: scheduled workflow
- `tools/check-buy2day-products.mjs`: catalog checker
- `data/buy2day-products.json`: stored product snapshot
- `data/buy2day-new-products.md`: latest generated summary

How it works:

1. GitHub Actions runs the watcher daily at `05:23 UTC`, or manually from the Actions tab.
2. The checker reads Buy2Day's public WooCommerce Store API for visible rewards products.
3. It compares the current product IDs to `data/buy2day-products.json`.
4. If new products are found, the workflow opens a GitHub Issue listing them.
5. The workflow commits the updated snapshot so the next run only reports products added after that point.

Email notification setup:

- To make the issue mention you directly, set a repository variable named `BUY2DAY_NOTIFY_GITHUB_USERNAME` to your GitHub username. The workflow will mention that user in the notification issue without hardcoding a personal email address.

If you need direct email to an arbitrary Gmail address that is not tied to GitHub notifications, use an SMTP/API provider and store its credentials as GitHub Actions secrets. That is more setup and not universally free, so this repo defaults to GitHub's notification system.

Local check:

```bash
npm run check:buy2day-products
```

## Local Quality Tooling

This repository includes:

- `Prettier` for formatting
- `ESLint` for JavaScript checks
- `.editorconfig` for consistent editor behavior
- Husky and `lint-staged` for staged-file checks before commits

Commands:

```bash
npm install
npm run format
npm run lint
npm run format:check
```

## License

MIT
