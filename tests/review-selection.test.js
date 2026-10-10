const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const core = require("../reference-core.js");

test("review selection across td/tr boundaries shows toolbar and copies numbered code", async () => {
  const listeners = new Map();
  const copied = [];
  const controls = new Map();
  const control = () => ({
    hidden: true,
    disabled: false,
    textContent: "",
    style: {},
    offsetWidth: 250,
    offsetHeight: 40,
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}
  });
  for (const id of [
    "#code-ref-copy-toolbar", "#code-ref-copy-btn", "#code-ref-set-destination",
    "#code-ref-feedback", "#code-ref-destination-dock", "#code-ref-destination-label",
    "#code-ref-clear-destination"
  ]) controls.set(id, control());

  const codes = [45, 46, 47].map((line) => ({ start: line * 100, end: line * 100 + 20 }));
  const table = {
    getClientRects() { return [{}]; },
    rows: codes.map((code, index) => ({
      cells: [
        { textContent: String(45 + index) },
        { querySelector() { return code; } }
      ]
    }))
  };
  const heading = {
    textContent: "App.jsx  + 8  - 0",
    getClientRects() { return [{}]; },
    compareDocumentPosition() { return 4; }
  };
  const root = {
    id: "",
    isConnected: true,
    setAttribute() {},
    querySelector(selector) { return controls.get(selector); },
    contains() { return false; }
  };
  const document = {
    body: { appendChild() {} },
    activeElement: null,
    getElementById() { return null; },
    createElement() { return root; },
    querySelectorAll(selector) { return selector === "table" ? [table] : selector === "h3" ? [heading] : []; },
    createRange() {
      return { selectNodeContents(node) { this.node = node; } };
    },
    addEventListener(name, listener) { listeners.set(name, listener); }
  };
  const selectionStart = 4505;
  const selectionEnd = 4700; // Exactly the start of line 47: exclude it.
  const range = {
    commonAncestorContainer: table,
    intersectsNode(node) {
      return node === table || (selectionStart <= node.end && selectionEnd >= node.start);
    },
    compareBoundaryPoints(how, codeRange) {
      return Math.sign((how === "start-to-end" ? selectionEnd : selectionStart) -
        (how === "start-to-end" ? codeRange.node.start : codeRange.node.end));
    },
    cloneRange() { return this; },
    getClientRects() { return [{ left: 20, top: 20, bottom: 36, width: 100, height: 16 }]; }
  };
  const window = {
    addEventListener() {},
    getSelection() {
      return { isCollapsed: false, rangeCount: 1, toString: () => "selected code", getRangeAt: () => range };
    }
  };
  window.top = window;
  const chrome = { runtime: { onMessage: { addListener() {} }, getManifest: () => ({ version: "0.1.2" }) } };
  const source = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
  vm.runInNewContext(source, {
    CodeRefCore: core,
    document,
    window,
    chrome,
    location: { origin: "https://review.example", pathname: "/patch", search: "", hostname: "review.example" },
    Node: { ELEMENT_NODE: 1, DOCUMENT_POSITION_FOLLOWING: 4 },
    Range: { START_TO_END: "start-to-end", END_TO_START: "end-to-start" },
    MutationObserver: class { observe() {} },
    navigator: { clipboard: { async writeText(value) { copied.push(value); } } },
    getComputedStyle: () => ({ visibility: "visible" }),
    requestAnimationFrame: (callback) => callback(),
    performance: { now: () => 1000 },
    innerWidth: 1000,
    innerHeight: 700,
    setTimeout: () => 1,
    clearTimeout() {}
  });

  listeners.get("selectionchange")();
  assert.equal(controls.get("#code-ref-copy-toolbar").hidden, false);

  let prevented = false;
  listeners.get("keydown")({
    key: "Y", repeat: false, shiftKey: true, metaKey: true, ctrlKey: false, altKey: false,
    preventDefault() { prevented = true; },
    stopImmediatePropagation() {}
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(prevented, true);
  assert.deepEqual(copied, ["[A App.jsx:45-46]"]);
});
