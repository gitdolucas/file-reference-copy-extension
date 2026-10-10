# Code Reference Copier — MVP Plan

Project repository: [gitdolucas/file-reference-copy-extension](https://github.com/gitdolucas/file-reference-copy-extension).

## Goal

Let a reviewer select code in a supported Chrome page, click **Copy Ref**, and get a reference such as `[A App.jsx:45-52]`. Optionally, the reviewer can choose an editable field on that same page as a destination. Each later copy also appends the reference to that field.

All extension names, labels, errors, documentation, and test fixtures use US English.

## MVP decisions

| Area | Decision |
| --- | --- |
| Browser | Google Chrome, Manifest V3. |
| Initial views | Web review tables with a file `h3`, numbered first `td`, and code in the second `td`; GitHub and GitLab file views; marked local HTML code views. Validate each adapter before release. |
| Reference | `[A <basename>:<start>-<end>]`, including `[A App.jsx:45-45]` for one line. Prefix `A` is fixed for MVP. |
| File name | Prefer file-view metadata; use URL path only when unambiguous. Show an error instead of copying a guessed name. |
| Selection | Code text in one file view. Reject selections spanning files or lacking reliable line numbers. |
| Destination | One explicitly selected editable element in the current document. Keep it across same-document SPA file changes while connected; reset on reload. No cross-tab destination or saved selector. |
| Copy behavior | Copy each reference to clipboard. If destination is set, append the same reference after successful copy. Never submit the field. |
| Activation | Click the extension icon in each tab. Use `activeTab` and `scripting` for one-tab injection; no broad host matches. Declare `clipboardWrite` for the copy action. |

## User flow

1. Open a supported file view. Select part of one or more code lines with mouse or keyboard.
2. **Copy Ref** appears beside the selection. Click or keyboard-activate it.
3. Extension resolves filename and selected line interval, writes reference to clipboard, then shows **Copied!** briefly. On failure, show a specific error; do not claim success.
4. Optional: click **Set Destination**, then click an editable field on the same page. Show **Destination set** and offer **Clear Destination**. Press `Esc` to cancel picking.
5. Later **Copy Ref** actions append references to the destination. Use a newline for `textarea`/`contenteditable`; use a space for a single-line text input. Preserve existing field content.
6. Clear selection or interact elsewhere: hide the selection toolbar. Destination remains set until cleared, removed from DOM, or page reload.

## Build sequence

### 1. Site and DOM validation

- Collect representative review-table, GitHub, GitLab, and localhost file views: one line, multiple lines, syntax-highlighted spans, reverse selection, and long files.
- Record stable line-number nodes/attributes and filename sources for each site. Put site-specific selectors behind adapters; keep a generic adapter for local pages with `data-line-number` or equivalent markers.
- Mark unsupported renderers clearly. Virtualized editors, canvas code views, and raw text pages without reliable line metadata are outside MVP until an adapter proves accurate.

**Gate:** Each advertised view has fixtures and a reliable filename + line-number strategy. Do not claim support for a view if this gate fails.

### 2. Extension shell

- Add `manifest.json` with Manifest V3, `clipboardWrite`, `activeTab`, and `scripting`.
- Add `background.js` for action-click injection, plus `content.js` and `styles.css`. Run the content script in its default isolated world.
- Add `README.md` with installation, supported pages, destination behavior, limits, and manual test steps.

**Gate:** Unpacked extension loads cleanly; script runs only after the reviewer clicks the extension icon in that tab.

### 3. Selection → reference

- Listen to `selectionchange` and completed pointer selection. Ignore empty selections and selections in the extension's own UI.
- Resolve intersected code-line elements from the DOM `Range`; derive lowest/highest actual selected line numbers, independent of drag direction. Avoid counting an unselected trailing line at a boundary.
- Resolve filename through the active site adapter. Format one deterministic reference string.
- Keep a validated selection snapshot while the user activates the toolbar so button interaction does not lose the selection.

**Gate:** Exact reference for single, partial, multi-line, and reverse selections; no reference when metadata is ambiguous.

### 4. Floating UI and clipboard

- Create one scoped toolbar with **Copy Ref** and **Set Destination**. Position it from selection geometry, account for scroll and viewport edges, and update/hide it on selection, scroll, resize, and outside interaction.
- Write via `navigator.clipboard.writeText()` from the user's click/keyboard action. Handle rejection with visible feedback; keep the reference available for retry.
- Add accessible button names, focus states, and a short live status message. Prevent pointer activation from prematurely clearing the selected range.

**Gate:** Toolbar stays visible long enough to activate, never covers the selected code unnecessarily, and reports clipboard success/failure accurately.

### 5. Destination picker

- Enter a one-click picking mode from **Set Destination**. Accept `textarea`, ordinary text inputs, and `contenteditable` elements. Reject password, hidden, disabled, and read-only controls.
- Visually identify the chosen field. Append each successfully copied reference; update native value/content and dispatch an `input` event so page frameworks can observe the change.
- Detect removed destinations and clear state. Offer **Clear Destination**. Do not store destination selectors or field content.

**Gate:** Two sequential copies produce two ordered references in the chosen field; clipboard contains the latest reference; page never auto-submits.

### 6. Verification and release

- Unit-test formatting, filename normalization, line intersection, reverse selection, boundary handling, and destination separators using DOM fixtures.
- Smoke-test unpacked extension on real GitHub/GitLab file views and a localhost fixture. Include dynamic navigation, viewport scroll, keyboard activation, clipboard denial, and an invalid destination.
- Review permission prompts and ensure labels/docs are US English. Package source plus README for team review.

**Release gate:** RF01–RF05 pass on every advertised site. Destination flow passes for supported field types. Failures show clear feedback and never copy an incorrect reference.

## Key risks

- **Site markup changes:** adapters and fixtures isolate selector updates. Do not infer line numbers from visual row position.
- **Virtualized or shadow-root editors:** defer until explicitly supported; DOM selection alone may not expose correct lines.
- **Clipboard restrictions:** keep copy action tied to user activation and handle `writeText()` rejection.
- **Controlled fields:** test `input` event behavior on target pages; if a framework rejects programmatic updates, show a destination error rather than silently losing a reference.

## Reference docs

- [Chrome content-script manifest](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)
- [Chrome match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)
- [Chrome extension permissions](https://developer.chrome.com/docs/extensions/reference/permissions-list)
- [Clipboard.writeText()](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText)
- [Selection API](https://developer.mozilla.org/en-US/docs/Web/API/Selection)
