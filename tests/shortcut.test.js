const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("shortcut sends copy request only to the active tab", async () => {
  const sent = [];
  let commandListener;
  const chrome = {
    action: {
      onClicked: { addListener() {} }
    },
    commands: {
      onCommand: { addListener(listener) { commandListener = listener; } }
    },
    tabs: {
      onUpdated: { addListener() {} },
      async query() { return [{ id: 42 }]; },
      async sendMessage(tabId, message) { sent.push({ tabId, message }); }
    }
  };
  const source = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
  vm.runInNewContext(source, { chrome });

  await commandListener("other-command", { id: 7 });
  assert.equal(sent.length, 0);

  await commandListener("copy-reference", { id: 7 });
  assert.equal(sent[0].tabId, 7);
  assert.equal(sent[0].message.type, "code-ref-copy-selection");

  await commandListener("copy-reference");
  assert.equal(sent[1].tabId, 42);
  assert.equal(sent[1].message.type, "code-ref-copy-selection");
});
