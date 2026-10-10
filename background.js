chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    const [state] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => Boolean(document.getElementById("code-ref-extension-root"))
    });
    if (!state?.result) {
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

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  chrome.action.setBadgeText({ tabId, text: "" });
  chrome.action.setTitle({ tabId, title: "Enable Code Reference Copier on this page" });
});
