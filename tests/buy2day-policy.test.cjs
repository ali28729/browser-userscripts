const { test } = require("node:test");
const assert = require("node:assert/strict");
const { select, evaluate, duplicate } = require("../tools/buy2day-policy.cjs").Buy2DayPolicy;
const product = (name, slug, extra = {}) => ({
  id: 1,
  name,
  url: `https://buy2day.pk/product/${slug}/`,
  inStock: true,
  amount: 10000,
  ...extra,
});
test("issue 25 unrelated categories never alert", () => {
  for (const [name, slug] of [
    ["DELONGHI COFFEE MAKER EC685.BK", "delonghi-coffee-maker-ec685-bk"],
    ["REMINGTON S9100 HAIR STRAIGHTENER PROLUXE", "remington-s9100-hair-straightener-proluxe"],
    ["Moulinex Chopper DPA-810810", "moulinex-chopper-dpa-810810"],
  ])
    assert.equal(select([product(name, slug)]).matches.length, 0);
});
test("issue 26 mismatch is quarantined before category filtering", () => {
  assert.equal(
    evaluate(
      product(
        "Black + Decker Blender Grinder BX600G",
        "alpina-alpina-belgian-waffle-maker-1000w-sf-2611",
      ),
    ).reason,
    "name/URL mismatch",
  );
});
test("rank by category then price; unknown price last", () => {
  const p = product("Anex induction cooker AG2174", "anex-induction-cooker-ag2174");
  const cheap = product("Westpoint induction cooker WF143", "westpoint-induction-cooker-wf143", {
    id: 2,
    amount: 5000,
  });
  const heater = product("Anex fan heater AG5015", "anex-fan-heater-ag5015", {
    id: 3,
    amount: 1000,
  });
  assert.deepEqual(
    select([heater, p, cheap]).matches.map((x) => x.id),
    [2, 1, 3],
  );
  assert.equal(select([{ ...p, amount: null }, cheap]).matches[0].id, 2);
});
test("canonical URLs, reordered names and previously seen duplicates", () => {
  const p = product("Anex induction cooker AG2174", "anex-induction-cooker-ag2174");
  const copy = { ...p, id: 2, url: p.url + "?tracking=1" };
  assert.equal(select([p, copy]).matches.length, 1);
  assert.equal(select([copy], [p]).matches.length, 0);
  assert.equal(
    duplicate(p, {
      ...p,
      id: 3,
      name: "Induction cooker Anex AG2174",
      url: "https://buy2day.pk/product/induction-cooker-anex-ag2174/",
    }),
    true,
  );
});
test("different models survive dedupe, wrong models fail validation", () => {
  const a = product("Anex fan heater AG5015", "anex-fan-heater-ag5015");
  const b = product("Anex fan heater AG5017", "anex-fan-heater-ag5017", { id: 2 });
  assert.equal(select([a, b]).matches.length, 2);
  assert.equal(evaluate({ ...a, url: b.url }).reason, "name/URL mismatch");
});
test("fail closed for unsafe links, blocked descriptions and missing stock", () => {
  const p = product("Anex induction cooker AG2174", "anex-induction-cooker-ag2174");
  for (const extra of [
    { url: "https://evil.example/product/anex-induction-cooker-ag2174/" },
    { url: "javascript:alert(1)" },
    { inStock: false },
    { description: "installment only" },
    { url: p.url.replace("ag2174", "%ZZ") },
  ])
    assert.equal(select([{ ...p, ...extra }]).matches.length, 0);
});
