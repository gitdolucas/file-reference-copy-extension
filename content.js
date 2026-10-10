(function () {
  "use strict";

  if (window.top !== window || document.getElementById("code-ref-extension-root")) return;

  const core = globalThis.CodeRefCore;
  if (!core) return;

  let current = null;
  let destination = null;
  let picking = false;
  let updateQueued = false;
  let copyPending = false;
  let feedbackTimer = null;
  let pageKey = location.origin + location.pathname + location.search;
  let lastPointer = null;

  const root = document.createElement("div");
  root.id = "code-ref-extension-root";
  root.setAttribute("data-code-ref-ui", "");
  root.innerHTML = `
    <div id="code-ref-copy-toolbar" role="toolbar" aria-label="Code reference actions" hidden>
      <span class="code-ref-mark" aria-hidden="true">[A]</span>
      <button id="code-ref-copy-btn" type="button">Copy Ref</button>
      <span class="code-ref-divider" aria-hidden="true"></span>
      <button id="code-ref-set-destination" type="button">Set Destination</button>
      <span id="code-ref-feedback" role="status" aria-live="polite"></span>
    </div>
    <div id="code-ref-destination-dock" role="status" aria-live="polite" hidden>
      <span id="code-ref-destination-label"></span>
      <button id="code-ref-clear-destination" type="button" hidden>Clear</button>
    </div>`;
  (document.body || document.documentElement).appendChild(root);

  const toolbar = root.querySelector("#code-ref-copy-toolbar");
  const copyButton = root.querySelector("#code-ref-copy-btn");
  const destinationButton = root.querySelector("#code-ref-set-destination");
  const feedback = root.querySelector("#code-ref-feedback");
  const dock = root.querySelector("#code-ref-destination-dock");
  const dockLabel = root.querySelector("#code-ref-destination-label");
  const clearButton = root.querySelector("#code-ref-clear-destination");

  // Keep the page selection alive while a pointer activates the toolbar.
  toolbar.addEventListener("pointerdown", (event) => event.preventDefault());
  dock.addEventListener("pointerdown", (event) => event.preventDefault());

  function elementFor(node) {
    return node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement || null;
  }

  function fileFromUrl() {
    const segment = location.pathname.split("/").filter(Boolean).pop();
    if (!segment) return null;
    try {
      return core.basename(decodeURIComponent(segment));
    } catch {
      return null;
    }
  }

  function filenameFor(kind, codeRoot) {
    if (kind === "github") {
      return core.basename(
        document.querySelector("#file-name-id-wide, #file-name-id-mobile")?.textContent || ""
      ) || fileFromUrl();
    }
    if (kind === "gitlab") {
      return core.basename(
        codeRoot.getAttribute("data-path") ||
        document.querySelector('[data-testid="repository-heading"]')?.textContent || ""
      ) || fileFromUrl();
    }
    return core.basename(codeRoot.getAttribute("data-code-filename") || "");
  }

  function prefixWithin(element, node, offset) {
    const prefix = document.createRange();
    prefix.selectNodeContents(element);
    try {
      prefix.setEnd(node, offset);
      return prefix.toString();
    } catch {
      return null;
    }
  }

  function numberedCellBoundary(node, offset, selector, exclusiveEnd) {
    const cell = elementFor(node)?.closest(selector);
    const line = core.validLine(cell?.getAttribute("data-line-number"));
    if (!cell || !line) return null;
    const prefix = prefixWithin(cell, node, offset);
    if (prefix === null) return null;
    return { cell, line: exclusiveEnd && prefix.length === 0 ? line - 1 : line };
  }

  function githubSelection(range) {
    if (!/^\/[^/]+\/[^/]+\/blob\//.test(location.pathname)) return null;
    const selector = '[data-testid="code-cell"][data-line-number], td.blob-code[data-line-number], .js-file-line[data-line-number]';
    const start = numberedCellBoundary(range.startContainer, range.startOffset, selector, false);
    const end = numberedCellBoundary(range.endContainer, range.endOffset, selector, true);
    if (!start || !end) return null;
    const startRoot = start.cell.closest('[data-testid="code-lines-container"], .js-file-line-container, table');
    const endRoot = end.cell.closest('[data-testid="code-lines-container"], .js-file-line-container, table');
    if (!startRoot || startRoot !== endRoot || end.line < start.line) return null;
    return { file: filenameFor("github", startRoot), start: start.line, end: end.line };
  }

  function githubTextareaSelection() {
    if (!/^\/[^/]+\/[^/]+\/blob\//.test(location.pathname)) return null;
    const textarea = document.querySelector('#read-only-cursor-text-area');
    if (!textarea || document.activeElement !== textarea || textarea.selectionStart === textarea.selectionEnd) {
      return null;
    }
    const first = core.lineFromPrefix(1, textarea.value.slice(0, textarea.selectionStart), false);
    const last = core.lineFromPrefix(1, textarea.value.slice(0, textarea.selectionEnd), true);
    const reference = core.formatReference(filenameFor("github", document), first, last);
    if (!reference) return null;
    const lineCell = document.querySelector(`[data-testid="code-cell"][data-line-number="${last}"]`);
    return { reference, range: null, lineCell, pointer: lastPointer, pageKey };
  }

  function gitlabBoundary(node, offset, exclusiveEnd) {
    const code = elementFor(node)?.closest('code[data-testid="content"]');
    const viewer = code?.closest('[data-testid="blob-viewer-file-content"]');
    const grid = code?.closest(".gl-grid-cols-subgrid");
    const first = core.validLine(grid?.querySelector("[data-line-number]")?.getAttribute("data-line-number"));
    if (!code || !viewer || !first) return null;
    const prefix = prefixWithin(code, node, offset);
    if (prefix === null) return null;
    const line = exclusiveEnd && prefix.length === 0 && first > 1
      ? first - 1
      : core.lineFromPrefix(first, prefix, exclusiveEnd);
    return line ? { viewer, line } : null;
  }

  function gitlabSelection(range) {
    if (!location.pathname.includes("/-/blob/")) return null;
    const start = gitlabBoundary(range.startContainer, range.startOffset, false);
    const end = gitlabBoundary(range.endContainer, range.endOffset, true);
    if (!start || !end || start.viewer !== end.viewer || end.line < start.line) return null;
    return { file: filenameFor("gitlab", start.viewer), start: start.line, end: end.line };
  }

  function localSelection(range) {
    const selector = '[data-code-line][data-line-number]';
    const start = numberedCellBoundary(range.startContainer, range.startOffset, selector, false);
    const end = numberedCellBoundary(range.endContainer, range.endOffset, selector, true);
    const startRoot = start?.cell.closest("[data-code-filename]");
    const endRoot = end?.cell.closest("[data-code-filename]");
    if (!startRoot || startRoot !== endRoot || end.line < start.line) return null;
    return { file: filenameFor("local", startRoot), start: start.line, end: end.line };
  }

  function reviewBoundary(node, offset, exclusiveEnd) {
    const code = elementFor(node)?.closest("tr td code");
    const row = code?.closest("tr");
    if (!row || row.cells.length < 2 || !row.cells[1].contains(code)) return null;
    const line = core.validLine(row.cells[0].textContent.trim());
    if (!line) return null;
    const prefix = prefixWithin(code, node, offset);
    if (prefix === null) return null;
    return { table: row.closest("table"), line: exclusiveEnd && !prefix ? line - 1 : line };
  }

  function visible(element) {
    return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
  }

  function reviewFilename(table) {
    const headings = [...document.querySelectorAll("h3")];
    const heading = headings.reverse().find((item) =>
      visible(item) &&
      core.parseReviewHeading(item.textContent) &&
      Boolean(item.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
    if (!heading) return null;
    return core.parseReviewHeading(heading.textContent);
  }

  function reviewSelection(range) {
    const start = reviewBoundary(range.startContainer, range.startOffset, false);
    const end = reviewBoundary(range.endContainer, range.endOffset, true);
    if (!start?.table || start.table !== end?.table || end.line < start.line || !visible(start.table)) {
      return null;
    }
    return { file: reviewFilename(start.table), start: start.line, end: end.line };
  }

  function resolveSelection() {
    if (location.hostname === "github.com") {
      const textareaResult = githubTextareaSelection();
      if (textareaResult) return textareaResult;
    }
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount || !selection.toString()) return null;
    const range = selection.getRangeAt(0);
    if (root.contains(range.commonAncestorContainer)) return null;

    let result = null;
    if (location.hostname === "github.com") result = githubSelection(range) || reviewSelection(range);
    else if (location.hostname === "gitlab.com") result = gitlabSelection(range) || reviewSelection(range);
    else if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      result = localSelection(range) || reviewSelection(range);
    } else result = reviewSelection(range);

    const reference = result && core.formatReference(result.file, result.start, result.end);
    return reference ? { reference, range: range.cloneRange(), pageKey } : null;
  }

  function hideToolbar() {
    toolbar.hidden = true;
    current = null;
    feedback.textContent = "";
  }

  function positionToolbar() {
    if (!current || picking) return;
    const rects = current.range
      ? [...current.range.getClientRects()].filter((item) => item.width || item.height)
      : [];
    let rect = rects.at(-1) || current.range?.getBoundingClientRect();
    if (!rect && current.pointer) {
      rect = { left: current.pointer.x, top: current.pointer.y, bottom: current.pointer.y };
    }
    if (!rect) rect = current.lineCell?.getBoundingClientRect();
    if (!rect || rect.bottom < 0 || rect.top > innerHeight) {
      toolbar.hidden = true;
      return;
    }
    toolbar.hidden = false;
    const width = toolbar.offsetWidth || 250;
    const height = toolbar.offsetHeight || 40;
    let left = Math.min(Math.max(8, rect.left), Math.max(8, innerWidth - width - 8));
    let top = rect.bottom + 10;
    if (top + height > innerHeight - 8) top = Math.max(8, rect.top - height - 10);
    toolbar.style.left = `${left}px`;
    toolbar.style.top = `${top}px`;
  }

  function clearDestination() {
    destination?.classList.remove("code-ref-destination-active");
    destination = null;
    destinationButton.textContent = "Set Destination";
    renderDock();
  }

  function renderDock(message) {
    dock.hidden = !picking && !destination && !message;
    clearButton.hidden = !destination;
    if (message) dockLabel.textContent = message;
    else if (picking) dockLabel.textContent = "Click a text field · Esc to cancel";
    else if (destination) dockLabel.textContent = "Destination set";
    else dockLabel.textContent = "";
  }

  function checkPage() {
    const next = location.origin + location.pathname + location.search;
    if (next === pageKey) return;
    pageKey = next;
    picking = false;
    if (destination && !destination.isConnected) clearDestination();
    else renderDock();
    hideToolbar();
  }

  function syncSelection() {
    updateQueued = false;
    checkPage();
    if (picking || copyPending) return;
    if (current && root.contains(document.activeElement)) return;
    const next = resolveSelection();
    if (!next) return hideToolbar();
    current = next;
    feedback.textContent = "";
    positionToolbar();
  }

  function queueSelectionUpdate() {
    if (updateQueued) return;
    updateQueued = true;
    requestAnimationFrame(syncSelection);
  }

  function showFeedback(message, error) {
    clearTimeout(feedbackTimer);
    feedback.textContent = message;
    feedback.classList.toggle("code-ref-error", Boolean(error));
    if (current) positionToolbar();
    feedbackTimer = setTimeout(() => {
      feedback.textContent = "";
      feedback.classList.remove("code-ref-error");
      if (!window.getSelection()?.toString()) hideToolbar();
    }, 1800);
  }

  function editableTarget(node) {
    const element = elementFor(node);
    const field = element?.closest('textarea, input, [contenteditable="true"], [contenteditable="plaintext-only"]');
    if (!field || root.contains(field) || !field.isConnected) return null;
    if (field.matches("textarea")) return field.disabled || field.readOnly ? null : field;
    if (field.matches("input")) {
      const type = (field.getAttribute("type") || "text").toLowerCase();
      return ["text", "search"].includes(type) && !field.disabled && !field.readOnly ? field : null;
    }
    return field.isContentEditable ? field : null;
  }

  function appendToDestination(reference) {
    if (!destination) return true;
    if (!destination.isConnected || !editableTarget(destination)) {
      clearDestination();
      return false;
    }
    if (destination.matches("textarea, input")) {
      const descriptor = Object.getOwnPropertyDescriptor(
        destination.matches("textarea") ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        "value"
      );
      const next = core.appendValue(destination.value, reference, destination.matches("textarea"));
      descriptor.set.call(destination, next);
    } else {
      if (destination.textContent?.length) destination.appendChild(document.createElement("br"));
      destination.appendChild(document.createTextNode(reference));
    }
    destination.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  copyButton.addEventListener("click", async () => {
    checkPage();
    if (!current || copyPending) return;
    const snapshot = resolveSelection() || current;
    if (snapshot.pageKey !== pageKey) return hideToolbar();
    copyPending = true;
    copyButton.disabled = true;
    try {
      await navigator.clipboard.writeText(snapshot.reference);
      try {
        const appended = appendToDestination(snapshot.reference);
        showFeedback(appended ? "Copied!" : "Copied; destination unavailable", !appended);
      } catch {
        showFeedback("Copied; destination unavailable", true);
      }
    } catch {
      showFeedback("Clipboard unavailable — try again", true);
    } finally {
      copyPending = false;
      copyButton.disabled = false;
    }
  });

  destinationButton.addEventListener("click", () => {
    picking = true;
    toolbar.hidden = true;
    current = null;
    renderDock();
  });

  clearButton.addEventListener("click", clearDestination);

  document.addEventListener("click", (event) => {
    if (!picking || root.contains(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const field = editableTarget(event.target);
    if (!field) return renderDock("Choose an editable text field · Esc to cancel");
    clearDestination();
    destination = field;
    destination.classList.add("code-ref-destination-active");
    destinationButton.textContent = "Change Destination";
    picking = false;
    renderDock();
  }, true);

  document.addEventListener("pointerdown", (event) => {
    if (!root.contains(event.target) && !picking) hideToolbar();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (picking) {
      picking = false;
      renderDock();
    } else hideToolbar();
  }, true);

  document.addEventListener("selectionchange", queueSelectionUpdate);
  document.addEventListener("pointerup", (event) => {
    if (root.contains(event.target)) return;
    lastPointer = { x: event.clientX, y: event.clientY };
    queueSelectionUpdate();
  });
  document.addEventListener("keyup", () => {
    lastPointer = null;
    queueSelectionUpdate();
  });
  window.addEventListener("scroll", () => {
    if (current) current.pointer = null;
    positionToolbar();
  }, true);
  window.addEventListener("resize", positionToolbar);
  window.addEventListener("popstate", checkPage);
  window.addEventListener("hashchange", checkPage);

  new MutationObserver(() => {
    checkPage();
    if (destination && !destination.isConnected) clearDestination();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
