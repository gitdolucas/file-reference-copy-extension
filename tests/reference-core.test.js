const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../reference-core.js");

test("formats exact one-line and multi-line references", () => {
  assert.equal(core.formatReference("src/App.jsx", 45, 52), "[A App.jsx:45-52]");
  assert.equal(core.formatReference("App.jsx", 45, 45), "[A App.jsx:45-45]");
  assert.equal(core.formatReference("App.jsx", 52, 45), "[A App.jsx:45-52]");
  assert.equal(core.formatReference("app/[id].tsx", 4, 7), "[A [id].tsx:4-7]");
});

test("rejects ambiguous or invalid metadata", () => {
  assert.equal(core.formatReference("", 1, 2), null);
  assert.equal(core.formatReference("bad\nname.js", 1, 2), null);
  assert.equal(core.formatReference("App.jsx", 0, 2), null);
  assert.equal(core.formatReference("App.jsx", 1.5, 2), null);
});

test("reads review file headings without accepting unrelated headings", () => {
  assert.equal(core.parseReviewHeading("README.md \u00a0 + 98 \u00a0 - 21"), "README.md");
  assert.equal(core.parseReviewHeading("src/[id].tsx + 4 - 2"), "[id].tsx");
  assert.equal(core.parseReviewHeading("Review notes"), null);
});

test("maps GitLab text boundaries without counting exclusive next line", () => {
  assert.equal(core.lineFromPrefix(40, "alpha\nbeta", false), 41);
  assert.equal(core.lineFromPrefix(40, "alpha\n", true), 40);
  assert.equal(core.lineFromPrefix(40, "alpha\nbeta", true), 41);
});

test("appends repeated references with field-specific separators", () => {
  assert.equal(core.appendValue("", "[A App.jsx:1-2]", true), "[A App.jsx:1-2]");
  assert.equal(core.appendValue("draft", "[A App.jsx:1-2]", true), "draft\n[A App.jsx:1-2]");
  assert.equal(core.appendValue("draft", "[A App.jsx:1-2]", false), "draft [A App.jsx:1-2]");
  assert.equal(core.appendValue("draft\n", "[A App.jsx:1-2]", true), "draft\n[A App.jsx:1-2]");
});
