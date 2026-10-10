/* Shared, dependency-free reference rules. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CodeRefCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function validLine(value) {
    const line = Number(value);
    return Number.isSafeInteger(line) && line > 0 ? line : null;
  }

  function basename(value) {
    if (typeof value !== "string") return null;
    const name = value.trim().split(/[\\/]/).pop();
    return name && name !== "." && name !== ".." && !/[\r\n\x00-\x1f]/.test(name)
      ? name
      : null;
  }

  function formatReference(file, first, last) {
    const name = basename(file);
    const start = validLine(first);
    const end = validLine(last);
    if (!name || !start || !end) return null;
    return `[A ${name}:${Math.min(start, end)}-${Math.max(start, end)}]`;
  }

  function parseReviewHeading(label) {
    if (typeof label !== "string") return null;
    const match = label.match(/^(.*?)\s*\+\s*\d+\s*-\s*\d+\s*$/);
    return match ? basename(match[1]) : null;
  }

  function lineFromPrefix(firstLine, prefix, exclusiveEnd) {
    const first = validLine(firstLine);
    if (!first || typeof prefix !== "string") return null;
    const newlines = (prefix.match(/\n/g) || []).length;
    return Math.max(first, first + newlines - (exclusiveEnd && prefix.endsWith("\n") ? 1 : 0));
  }

  function appendValue(current, reference, multiline) {
    const value = String(current || "");
    if (!value) return reference;
    const separator = multiline ? "\n" : " ";
    return value + (value.endsWith(separator) ? "" : separator) + reference;
  }

  return { validLine, basename, formatReference, parseReviewHeading, lineFromPrefix, appendValue };
});
