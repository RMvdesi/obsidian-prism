// Local custom.css safe loader, @import blocker, SHA-256 fingerprint & template creator (L1, zero external deps)
'use strict';

const fs = require('fs');
const path = require('path');
const { sha256Text } = require('../utils/fs-safe.cjs');

const CUSTOM_CSS_FILENAME = 'custom.css';
const MAX_CUSTOM_CSS_BYTES = 256 * 1024; // 256 KiB hard safety cap (Issue #85)

// CSS Syntax Level 3 comment/string/escape-aware @import blocker (prevents remote URL exfiltration & backslash-escape bypasses while preserving comments and string literals)
const HEX_DIGIT_RE = /^[0-9a-fA-F]$/;
const CSS_IDENT_CHAR_RE = /^[A-Za-z0-9_-]$/;

function isCssIdentChar(ch) {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return code >= 0x80 || CSS_IDENT_CHAR_RE.test(ch);
}

function decodeCssEscape(src, pos) {
  const n = src.length;
  if (pos + 1 >= n || src[pos + 1] === '\n') return null;
  let j = pos + 1;
  if (HEX_DIGIT_RE.test(src[j])) {
    let hex = '';
    while (j < n && hex.length < 6 && HEX_DIGIT_RE.test(src[j])) {
      hex += src[j++];
    }
    let consumedWs = false;
    if (j < n && (src[j] === ' ' || src[j] === '\t' || src[j] === '\n')) {
      j += 1;
      consumedWs = true;
    }
    const cp = Number.parseInt(hex, 16);
    const ch = cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) ? '\uFFFD' : String.fromCodePoint(cp);
    return { ch, next: j, consumedWs };
  }
  return { ch: src[j], next: j + 1, consumedWs: false };
}

function readCssAtKeyword(src, atPos) {
  const n = src.length;
  let i = atPos + 1;
  let ident = '';
  while (i < n) {
    const ch = src[i];
    if (ch === '\\') {
      const dec = decodeCssEscape(src, i);
      if (!dec) break;
      ident += dec.ch;
      i = dec.next;
      if (dec.consumedWs && ident.toLowerCase() === 'import') break;
    } else if (isCssIdentChar(ch)) {
      ident += ch;
      i += 1;
    } else {
      break;
    }
  }
  return { ident, next: i };
}

function skipCssComment(src, start) {
  const end = src.indexOf('*/', start + 2);
  return end === -1 ? src.length : end + 2;
}

function skipCssString(src, start) {
  const q = src[start];
  const n = src.length;
  let i = start + 1;
  while (i < n) {
    const ch = src[i];
    if (ch === '\\') {
      i += i + 1 < n ? 2 : 1;
    } else if (ch === q) {
      return i + 1;
    } else if (ch === '\n') {
      return i;
    } else {
      i += 1;
    }
  }
  return n;
}

function consumeAtImportStatement(src, start) {
  const n = src.length;
  let i = start;
  let parenDepth = 0;
  while (i < n) {
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '*') {
      i = skipCssComment(src, i);
    } else if (ch === '"' || ch === "'") {
      i = skipCssString(src, i);
    } else if (ch === '\\') {
      i += i + 1 < n ? 2 : 1;
    } else if (ch === '(') {
      parenDepth += 1;
      i += 1;
    } else if (ch === ')') {
      if (parenDepth > 0) parenDepth -= 1;
      i += 1;
    } else if (ch === ';' && parenDepth === 0) {
      return i + 1;
    } else if ((ch === '{' || ch === '}') && parenDepth === 0) {
      return i;
    } else {
      i += 1;
    }
  }
  return n;
}

const DEFAULT_CUSTOM_CSS_TEMPLATE = [
  '/* Obsidian Prism - User Custom CSS (custom.css)',
  ' * Saved edits auto hot-reload (~120 ms, no restart). Preserved across upgrades.',
  ' * Self-contained live skeleton: paste this file to any AI for safe first-try CSS.',
  ' *',
  ' * HARD CONSTRAINTS (MUST FOLLOW):',
  ' * 1. Local CSS only: <= 256 KB, no @import (stripped), no http(s):// remote URLs.',
  ' * 2. No large base64 data: URIs (keeps memory and CSP clean).',
  ' * 3. No :has() selectors (forbidden for 300Hz streaming/scroll performance).',
  ' * 4. Icon immunity: never override .codicon, [class*="codicon-"], or .octicon',
  ' *    (never use blanket * { font-family: ... !important; }).',
  ' * 5. Layout safety: drive backgrounds via tokens so [data-has-browser-hole="true"]',
  ' *    stays transparent; never set overflow:hidden on code blocks or',
  ' *    content-visibility:auto on messages/code (preserves sticky code headers).',
  ' *',
  ' * STABLE CONTAINERS (verified host/Prism selectors; avoid Tailwind hashes):',
  ' * - Chat prose:      [data-testid="planner-response-text"], [data-testid="agent-response"]',
  ' * - Artifact view:   [data-testid="artifact-view"], [data-testid="artifact-card"]',
  ' * - Code block:      pre > div:is(.border, .bg-muted) (sticky: [data-ag-cs-code-sticky="1"])',
  ' * - Blockquote:      blockquote, .markdown-alert (inside prose containers above)',
  ' * - Sidebar:         [data-testid="sidebar-split"], [data-testid="conversation-row-sidebar"]',
  ' * - Composer input:  [data-testid="agent-input-box"], [data-lexical-editor="true"]',
  ' * - Thought section: [data-testid="thinking-collapsible-trigger"], .ag-prism-thought-body',
  ' * - User bubble:     [data-testid="user-message-bubble"]',
  ' */',
  '',
  '/* Example 1: 3-tier font bridge (zero !important; custom.css > Code > Chat > UI)',
  ':root {',
  '  --ag-prism-ui-font: "Inter", "PingFang SC", "Microsoft YaHei UI", system-ui, sans-serif;',
  '  --ag-prism-chat-font: "Charter", "Georgia", "Noto Serif SC", serif;',
  '  --ag-prism-code-font: "JetBrains Mono", "Cascadia Code", ui-monospace, monospace;',
  '}',
  '*/',
  '',
  '/* Example 2a: Dark theme tokens - (0,4,1)/(0,4,2) beats adoptedStyleSheets palettes',
  'html:root[data-ag-cs-style][data-ag-cs-style][data-ag-cs-theme="dark"],',
  'html:root[data-ag-cs-style][data-ag-cs-style][data-ag-cs-theme="dark"] > body {',
  '  --background: #0c0d10 !important;',
  '  --content: #0c0d10 !important;',
  '  --shell: var(--background) !important; --body-background: var(--background) !important;',
  '  --sidebar: #090a0d !important;',
  '  --card: #12141a !important;',
  '  --foreground: #eceef2 !important;',
  '  --muted-foreground: #8f98a8 !important;',
  '  --border: rgba(203, 213, 225, 0.10) !important;',
  '  --primary: #669df6 !important;',
  '  --link: #8ab4f8 !important;',
  '  --ag-cs-accent: #669df6 !important;',
  '  --ag-cs-r-sm: 4px; --ag-cs-r-md: 6px; --ag-cs-r-lg: 10px;',
  '}',
  '*/',
  '',
  '/* Example 2b: Light theme tokens - (0,6,1)/(0,6,2) beats Light non-follow accentTone',
  'html:root[data-ag-cs-style][data-ag-cs-style][data-ag-cs-style][data-ag-cs-style][data-ag-cs-theme="light"],',
  'html:root[data-ag-cs-style][data-ag-cs-style][data-ag-cs-style][data-ag-cs-style][data-ag-cs-theme="light"] > body {',
  '  --background: #f8fafc !important;',
  '  --content: #f8fafc !important;',
  '  --shell: var(--background) !important; --body-background: var(--background) !important;',
  '  --sidebar: #eef2f6 !important;',
  '  --card: #ffffff !important;',
  '  --foreground: #0f172a !important;',
  '  --muted-foreground: #475569 !important;',
  '  --border: rgba(15, 23, 42, 0.10) !important;',
  '  --primary: #2563eb !important;',
  '  --link: #1d4ed8 !important;',
  '  --ag-cs-accent: #2563eb !important;',
  '  --ag-cs-r-sm: 4px; --ag-cs-r-md: 6px; --ag-cs-r-lg: 10px;',
  '}',
  '*/',
  '',
  '/* Example 3: Prose typography & blockquote polish (works in both Dark and Light)',
  'html:root[data-ag-cs-style][data-ag-cs-style] :is([data-testid="planner-response-text"], [data-testid="agent-response"], [data-testid="artifact-view"]) :is(p, li) {',
  '  line-height: 1.72;',
  '}',
  'html:root[data-ag-cs-style][data-ag-cs-style] :is([data-testid="planner-response-text"], [data-testid="agent-response"], [data-testid="artifact-view"]) blockquote {',
  '  padding: 8px 16px 8px 15px !important;',
  '  background-image: none !important;',
  '  background-color: color-mix(in srgb, var(--primary) 6%, transparent) !important;',
  '}',
  '*/',
  '',
].join('\n');

function isPathStrictlyInside(rootReal, targetReal) {
  const rel = path.relative(rootReal, targetReal);
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function sanitizeCustomCssContent(rawCss) {
  if (typeof rawCss !== 'string') return { css: '', blockedImports: 0 };
  const src = rawCss.replace(/^\uFEFF/, '').replace(/\0/g, '').replace(/\r\n?|\f/g, '\n');
  const n = src.length;
  let out = '';
  let chunkStart = 0;
  let i = 0;
  let blockedImports = 0;
  while (i < n) {
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '*') {
      i = skipCssComment(src, i);
    } else if (ch === '"' || ch === "'") {
      i = skipCssString(src, i);
    } else if (ch === '\\') {
      i += i + 1 < n ? 2 : 1;
    } else if (ch === '@') {
      const { ident, next } = readCssAtKeyword(src, i);
      if (ident.toLowerCase() === 'import') {
        out += src.slice(chunkStart, i) + '/* [obsidian-prism] blocked @import */';
        blockedImports += 1;
        i = consumeAtImportStatement(src, next);
        chunkStart = i;
      } else {
        i = next > i ? next : i + 1;
      }
    } else {
      i += 1;
    }
  }
  if (blockedImports === 0) return { css: src, blockedImports: 0 };
  out += src.slice(chunkStart);
  return { css: out, blockedImports };
}

function resolveCustomCssPath(rootDir) {
  return path.join(path.resolve(String(rootDir || '')), CUSTOM_CSS_FILENAME);
}

function readCustomCssSafe(rootDir) {
  if (typeof rootDir !== 'string' || !rootDir.trim()) {
    return {
      status: 'missing',
      css: '',
      bytes: 0,
      rawBytes: 0,
      maxBytes: MAX_CUSTOM_CSS_BYTES,
      sha256: '',
      blockedImports: 0,
      filePath: '',
    };
  }
  const absRoot = path.resolve(rootDir);
  const filePath = path.join(absRoot, CUSTOM_CSS_FILENAME);
  const emptyBase = {
    status: 'missing',
    css: '',
    bytes: 0,
    rawBytes: 0,
    maxBytes: MAX_CUSTOM_CSS_BYTES,
    sha256: '',
    blockedImports: 0,
    filePath,
  };

  let st;
  try {
    st = fs.lstatSync(filePath);
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return emptyBase;
    return { ...emptyBase, status: 'error' };
  }

  if (st.isSymbolicLink()) {
    return { ...emptyBase, status: 'rejected-symlink', rawBytes: Number(st.size) || 0 };
  }
  if (!st.isFile()) {
    return { ...emptyBase, status: 'rejected-non-file', rawBytes: Number(st.size) || 0 };
  }

  let realRoot;
  let realFile;
  try {
    realRoot = fs.realpathSync(absRoot);
    realFile = fs.realpathSync(filePath);
  } catch {
    return { ...emptyBase, status: 'error' };
  }

  if (!isPathStrictlyInside(realRoot, realFile) || path.basename(realFile).toLowerCase() !== CUSTOM_CSS_FILENAME) {
    return { ...emptyBase, status: 'rejected-symlink', rawBytes: Number(st.size) || 0 };
  }

  if (st.size > MAX_CUSTOM_CSS_BYTES) {
    return { ...emptyBase, status: 'rejected-too-large', rawBytes: st.size };
  }

  let raw;
  let rawBytes = 0;
  try {
    const buf = fs.readFileSync(realFile);
    rawBytes = buf.length;
    if (buf.length > MAX_CUSTOM_CSS_BYTES) {
      return { ...emptyBase, status: 'rejected-too-large', rawBytes: buf.length };
    }
    raw = buf.toString('utf8');
  } catch {
    return { ...emptyBase, status: 'error' };
  }

  const { css, blockedImports } = sanitizeCustomCssContent(raw);
  const hasExecutableCss = css.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, '').trim().length > 0;
  const bytes = Buffer.byteLength(css, 'utf8');
  const sha256 = sha256Text(css);

  return {
    status: hasExecutableCss ? 'active' : 'empty',
    css: hasExecutableCss ? css : '',
    bytes: hasExecutableCss ? bytes : 0,
    rawBytes,
    maxBytes: MAX_CUSTOM_CSS_BYTES,
    sha256,
    blockedImports,
    filePath,
  };
}

function createDefaultCustomCssTemplate(rootDir) {
  if (typeof rootDir !== 'string' || !rootDir.trim()) {
    return { ok: false, status: 'invalid-root', filePath: '' };
  }
  const absRoot = path.resolve(rootDir);
  const filePath = path.join(absRoot, CUSTOM_CSS_FILENAME);
  try {
    const rootStat = fs.lstatSync(absRoot);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
      return { ok: false, status: 'invalid-root', filePath };
    }
  } catch {
    return { ok: false, status: 'invalid-root', filePath };
  }

  try {
    const existing = fs.lstatSync(filePath);
    if (existing) {
      if (existing.isSymbolicLink()) {
        return { ok: false, created: false, exists: true, status: 'rejected-symlink', filePath };
      }
      if (!existing.isFile()) {
        return { ok: false, created: false, exists: true, status: 'rejected-non-file', filePath };
      }
      return { ok: true, created: false, exists: true, status: 'exists', filePath };
    }
  } catch (err) {
    if (!err || err.code !== 'ENOENT') {
      return { ok: false, status: 'error', filePath };
    }
  }

  try {
    fs.writeFileSync(filePath, DEFAULT_CUSTOM_CSS_TEMPLATE, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    return { ok: true, created: true, exists: true, status: 'created', filePath };
  } catch (err) {
    if (err && err.code === 'EEXIST') {
      try {
        const st = fs.lstatSync(filePath);
        if (st.isSymbolicLink()) return { ok: false, created: false, exists: true, status: 'rejected-symlink', filePath };
        if (!st.isFile()) return { ok: false, created: false, exists: true, status: 'rejected-non-file', filePath };
      } catch {}
      return { ok: true, created: false, exists: true, status: 'exists', filePath };
    }
    return { ok: false, status: 'write-failed', filePath };
  }
}

module.exports = {
  CUSTOM_CSS_FILENAME,
  MAX_CUSTOM_CSS_BYTES,
  DEFAULT_CUSTOM_CSS_TEMPLATE,
  resolveCustomCssPath,
  sanitizeCustomCssContent,
  readCustomCssSafe,
  createDefaultCustomCssTemplate,
};
