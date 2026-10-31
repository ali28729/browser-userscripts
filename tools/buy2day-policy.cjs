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
