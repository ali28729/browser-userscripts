# Browser Userscripts

Collection of small browser userscripts for improving web interfaces and automating repetitive tasks.

These scripts are designed for use with:

- Violentmonkey
- Tampermonkey
- Greasemonkey

## Script Installation

1. Install `Violentmonkey`.
2. Open a raw script URL from this repository.
3. Confirm installation in the extension.

## Available Scripts

### Buy2Day Product Loader

Loads in-stock products from Buy2Day rewards pages into one consolidated list with client-side controls.

Context:

- Intended for browsing redeemable in-stock items for Standard Chartered Pakistan credit card rewards (for example Visa Platinum card rewards catalog flows).
- Rewards promotion entry page: `https://www.sc.com/pk/promotions/credit-card-rewards/`
- Script execution target: `https://www.buy2day.pk/product-category/rewards-points-products/*`

Features:

- fetches all configured category pages
- excludes out-of-stock items
- client-side sort by price/name
- client-side text search
- on-hover product description tooltip

Install URL:

`https://raw.githubusercontent.com/ali28729/browser-userscripts/main/scripts/buy2day-product-loader.user.js`

## Local Quality Tooling

This repository includes:

- `Prettier` for formatting
- `ESLint` (flat config) for code-quality checks
- `.editorconfig` for consistent editor behavior

Commands:

```bash
npm install
npm run format
npm run lint
```

Pre-commit behavior:

- Husky runs `lint-staged` on commit.
- Only staged files are checked/fixed.
- JavaScript userscripts are formatted and lint-fixed.

## Repository Structure

```text
scripts/
	*.user.js
```

## License

MIT
