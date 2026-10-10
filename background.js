chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    let currentContent = false;
    try {
      const state = await chrome.tabs.sendMessage(tab.id, { type: "code-ref-ping" });
      currentContent = state?.version === chrome.runtime.getManifest().version && state?.rootConnected;
    } catch {
      // A previous extension version may have left its toolbar in the page.
    }
    if (!currentContent) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.getElementById("code-ref-extension-root")?.remove()
      });
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["styles.css"] });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["reference-core.js", "content.js"]
      });
    }
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#355842" });
    await chrome.action.setBadgeText({ tabId: tab.id, text: "ON" });
    await chrome.action.setTitle({ tabId: tab.id, title: "Code Reference Copier is active" });
  } catch {
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#9d4c38" });
    await chrome.action.setBadgeText({ tabId: tab.id, text: "ERR" });
    await chrome.action.setTitle({ tabId: tab.id, title: "Cannot run on this page" });
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "copy-reference") return;
  const activeTab = tab?.id ? tab : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!activeTab?.id) return;
  try {
    const response = await chrome.tabs.sendMessage(activeTab.id, { type: "code-ref-copy-selection" });
    if (response?.status === "copied" || response?.status === "duplicate") {
      await chrome.action.setBadgeBackgroundColor({ tabId: activeTab.id, color: "#355842" });
      await chrome.action.setBadgeText({ tabId: activeTab.id, text: "ON" });
      await chrome.action.setTitle({ tabId: activeTab.id, title: "Code Reference Copier is active" });
      return;
    }
    if (response?.status === "no-selection") {
      await chrome.action.setBadgeBackgroundColor({ tabId: activeTab.id, color: "#9d4c38" });
      await chrome.action.setBadgeText({ tabId: activeTab.id, text: "SEL" });
      await chrome.action.setTitle({
        tabId: activeTab.id,
        title: "Select code lines in a supported file view"
      });
      return;
    }
    if (response?.status) {
      await chrome.action.setBadgeBackgroundColor({ tabId: activeTab.id, color: "#9d4c38" });
      await chrome.action.setBadgeText({ tabId: activeTab.id, text: "ERR" });
      await chrome.action.setTitle({ tabId: activeTab.id, title: "Could not copy this reference" });
      return;
    }
  } catch {
    // The tab has not been enabled or contains an old extension instance.
  }
  await chrome.action.setBadgeBackgroundColor({ tabId: activeTab.id, color: "#9d4c38" });
  await chrome.action.setBadgeText({ tabId: activeTab.id, text: "OFF" });
  await chrome.action.setTitle({
    tabId: activeTab.id,
    title: "Click the extension icon to enable Code Reference Copier on this page"
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  chrome.action.setBadgeText({ tabId, text: "" });
  chrome.action.setTitle({ tabId, title: "Enable Code Reference Copier on this page" });
});
