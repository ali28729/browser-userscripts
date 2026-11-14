# Buy2Day wishlist quality

Issues #25 and #26 demonstrate both catalog noise and incorrect source identity. Filtering alone cannot repair the latter. The snapshot is retained as catalog history; this change does not rewrite merchant names or guess corrected links.

## Policy and ranking

Edit `policy` in `tools/buy2day-policy.cjs`, then run `node tools/sync-buy2day-policy.mjs`. The browser gets an embedded copy, without a runtime dependency on GitHub. CI checks that copy for drift.

Defaults inferred from recent shopping are induction cookers (priority 2) and room/fan/oil/ceramic heaters (priority 1). These are editable starter categories, not confirmed model commitments. No brand, price ceiling, discount, or rewards eligibility is assumed. The allowlist must match both title and URL slug. Coffee/espresso machines, hair tools, choppers, blenders, waffle makers, water heaters/geysers and installment offers are blocked, even if another keyword matches.

Only in-stock matches qualify. Rank by descending category priority, ascending known numeric sale/current price, then title and ID for stable ties. Missing prices sort last. Browser users can still explicitly select another loaded sort.

Validate HTTPS, exact site host and product route. Require at least 75% overlap of normalized name/slug tokens and agreement of model-bearing numeric tokens. Fail closed on malformed URLs. This is a conservative identity heuristic, not merchant verification: valid alternate slugs can be quarantined, and similar wrong products can still pass. Do not auto-correct a URL from the title. A future manual override should record a verified product ID, canonical URL and evidence rather than bypass validation globally.

Suppress duplicate IDs, canonical URLs (strip tracking/fragment, normalize www and trailing slash), and near-duplicate names (token Jaccard >=85%, same model tokens). Distinct models remain separate; no fuzzy model collapsing. Compare against the entire prior catalog snapshot as well as the current result set, so changing IDs alone does not create another alert. Removed products later reappearing after a missing run may alert again; durable lifetime notification history is outside this change.

## State and issue behavior

Keep every API record, including rejected records, in the snapshot. Apply policy to newly observed records after catalog comparison. Existing snapshot records are baseline, so deploying this change does not flood issues with historical matches. Restocks, price drops and wishlist changes do not alert on existing IDs; those need an explicit future event policy. Failure to fetch any page aborts before writing state. Workflow concurrency serializes scheduled/manual runs.

Issue title: `Buy2Day: N new wishlist matches`. Body starts with ranked, linked matches, current price, stock, matched category, priority and product ID. Then show catalog count and active wishlist assumptions, followed by suppression counts and a collapsed data-quality section (IDs and names, with untrusted links withheld; capped at 20 records). Runs with only rejected records write the job summary but create no issue or mention. Only a real match triggers the existing optional username mention.

The summary counts describe newly observed records, not a whole-catalog audit. To inspect historical source quality without modifying the snapshot:

```sh
node -e 'const fs=require("fs");const p=require("./tools/buy2day-policy.cjs").Buy2DayPolicy; const rows=JSON.parse(fs.readFileSync("data/buy2day-products.json")).products; console.log(p.select(rows).rejected.filter(x=>/mismatch|invalid/.test(x.reason)))'
```

## Validation

Run `node --test tests/buy2day-policy.test.cjs`, `node tools/sync-buy2day-policy.mjs --check`, and `npm run lint`. Regression cases cover the issue examples, unsafe links, installment descriptions, stock, ranking, canonical and cross-run duplicates, and distinct/wrong model numbers. No live merchant requests are needed for these checks.
