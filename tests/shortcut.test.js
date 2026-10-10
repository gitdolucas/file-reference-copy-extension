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
      onClicked: { addListener() {} },
      async setBadgeBackgroundColor() {},
      async setBadgeText() {},
      async setTitle() {}
    },
    commands: {
      onCommand: { addListener(listener) { commandListener = listener; } }
    },
    tabs: {
      onUpdated: { addListener() {} },
      async query() { return [{ id: 42 }]; },
      async sendMessage(tabId, message) {
        sent.push({ tabId, message });
        return { status: "copied" };
      }
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

test("activation replaces an orphaned toolbar after an extension update", async () => {
  const operations = [];
  let actionListener;
  const chrome = {
    action: {
      onClicked: { addListener(listener) { actionListener = listener; } },
      async setBadgeBackgroundColor() {},
      async setBadgeText() {},
      async setTitle() {}
    },
    commands: { onCommand: { addListener() {} } },
    runtime: { getManifest() { return { version: "0.1.2" }; } },
    scripting: {
      async executeScript() { operations.push("script"); },
      async insertCSS() { operations.push("css"); }
    },
    tabs: {
      onUpdated: { addListener() {} },
      async sendMessage(_tabId, message) {
        operations.push(message.type);
        throw new Error("Receiving end does not exist");
      }
    }
  };
  const source = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
  vm.runInNewContext(source, { chrome });

  await actionListener({ id: 7 });
  assert.equal(operations.join(","), "code-ref-ping,script,css,script");
});
