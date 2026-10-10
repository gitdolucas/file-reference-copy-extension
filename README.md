# Code Reference Copier

Chrome Manifest V3 extension for copying code-line references from supported file views. Select code, then click **Copy Ref** to copy `[A App.jsx:45-52]`.

## Install for development

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** and choose **Load unpacked**.
3. Select this repository directory.
4. Open a supported file view and click the extension icon to enable it in that tab. The badge reads **ON**.
5. Select code text.

## Keyboard shortcut

After enabling the current tab with the extension icon, select code and press **Command+Shift+Y** on macOS or **Ctrl+Shift+Y** on Windows/Linux to copy its reference. The shortcut performs the same clipboard and destination-field actions as **Copy Ref**. Change the binding at `chrome://extensions/shortcuts` if needed.

Chrome uses **Command+Shift+C** on macOS for DevTools Inspect mode (and **Ctrl+Shift+C** on Windows/Linux). Chrome and operating-system shortcuts can take priority over extension commands, so this extension cannot reliably override that key combination.

## Supported views

- GitHub repository file **Code** view (`/owner/repo/blob/...`). For Markdown files, switch from **Preview** to **Code**.
- GitLab repository file **Code** view (`/.../-/blob/...`). For rendered Markdown, choose **Display source**.
- Web review pages with a visible `h3` file heading like `README.md + 98 - 21`, followed by a table whose rows contain a numeric first `td` and code inside the second `td`.
- Local HTML pages served from `http://localhost` or `http://127.0.0.1` with a container carrying `data-code-filename="path/File.ext"` and each selectable code line carrying both `data-code-line` and `data-line-number="N"`.

The extension does not infer line numbers from visual position. It stays quiet on unsupported code renderers and on pages without reliable line metadata. A single-line selection uses a repeated interval, for example `[A App.jsx:45-45]`.

## Destination field

After selecting code, click **Set Destination**, then click a textarea, a text/search input, or a contenteditable element on the same page. Every later successful copy still updates the clipboard and also appends the reference to that field. Textareas and contenteditable fields receive separate lines; single-line inputs receive spaces. **Clear** removes the destination; `Esc` cancels selection mode. The destination survives same-document SPA file changes while the field exists. It resets on reload or when the field is removed. The extension never submits a form.

## Local check

Run `python3 -m http.server 8765` in this directory, then open `http://localhost:8765/fixtures/code-view.html` or `http://localhost:8765/fixtures/review-view.html`. Click the extension icon. Select lines 45–52, copy, set the textarea destination, then copy another range. Check that the clipboard has the latest reference and the textarea has both in order.

Run `npm test` for dependency-free core checks.

## Limits

Only one file view and the current top-level document are supported at a time. Cross-tab destinations, raw text pages without line markers, canvas editors, and virtualized code lines without a reliable DOM selection are outside this MVP.
