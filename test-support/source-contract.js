'use strict';
// Line-ending-agnostic source-contract extraction for tests.
//
// Repository sources are stored with LF (git reports `i/lf`) but a Windows
// checkout with core.autocrlf=true materialises them as CRLF. A contract anchor
// such as '\n }\n\n async function createRequest' therefore matches on an LF
// checkout (Linux CI) and silently fails on a CRLF one, which turns a healthy
// runtime into a red test.
//
// Extract by function-signature boundaries instead: the body runs from the
// requested signature up to the start of the next top-level function
// declaration, whatever the newline style and blank-line shape happen to be.

// Matches the start of a top-level function declaration, including its leading
// newline and any indentation, tolerating both LF and CRLF.
const NEXT_FUNCTION = /\r?\n[ \t]*(?:async )?function [A-Za-z0-9_$]+\(/g;

// Returns { start, end, body } for the top-level function beginning at
// `signature`, or null when the signature is absent or has no following
// top-level function to bound it.
function functionBody(source, signature) {
  const text = String(source);
  const start = text.indexOf(signature);
  if (start < 0) return null;
  const boundary = new RegExp(NEXT_FUNCTION.source, 'g');
  boundary.lastIndex = start + signature.length;
  const next = boundary.exec(text);
  if (!next) return null;
  const end = next.index + (text[next.index] === '\r' ? 2 : 1);
  if (end <= start) return null;
  // Drop the trailing newline run so the body is byte-stable across LF/CRLF
  // checkouts and across blank-line spacing before the next declaration.
  return { start, end, body: text.slice(start, end).replace(/[\r\n]+$/, '') };
}

module.exports = { functionBody };
