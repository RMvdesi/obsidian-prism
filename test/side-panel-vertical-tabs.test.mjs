import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectNativePluginEntries } from '../scripts/build-common.mjs';
import { ARCHIVE_ROOT_PREFIX, collectLinuxPortableEntries } from '../scripts/build-linux.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cdp = require(path.join(ROOT, 'cdp.js'));
const i18nCore = require(path.join(ROOT, 'i18n-core.js'));
const i18nLocales = require(path.join(ROOT, 'i18n-locales.js'));
const i18nExtBeta4 = require(path.join(ROOT, 'src', 'runtime', 'i18n-ext-beta4.js'));
const settingsPanel = require(path.join(ROOT, 'settings-panel.js'));
const settingsExtBeta4 = require(path.join(ROOT, 'src', 'runtime', 'settings-ext-beta4.js'));
const domBusMod = require(path.join(ROOT, 'src', 'runtime', 'dom-bus.js'));
const rmGuard = require(path.join(ROOT, 'src', 'runtime', 'reduced-motion-guard.js'));

const SUPPORTED_9 = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'tr'];
const NON_CJK_6 = ['en', 'ko', 'es', 'fr', 'de', 'tr'];
const LATIN_5 = ['en', 'es', 'fr', 'de', 'tr'];
const HAN_RE = /[\u3400-\u9fff]/;
const CJK_RE = /[\u3000-\u30ff\u3400-\u9fff\uac00-\ud7af\uff00-\uffef]/;
const STORAGE_COLLAPSED_KEY = 'ag-prism:side-panel-vtabs-collapsed';
const STORAGE_WIDTH_KEY = 'ag-prism:side-panel-vtabs-width';
const STYLE_ID = 'ag-prism-side-panel-vtabs-css';
const ALL_29_VTABS_ATTRS = [
  'data-ag-vtabs-host',
  'data-ag-vtabs-strip',
  'data-ag-vtabs-body',
  'data-ag-vtabs-strip-slot',
  'data-ag-vtabs-strip-wrap',
  'data-ag-vtabs-body-slot',
  'data-ag-vtabs-list',
  'data-ag-vtabs-wrap',
  'data-ag-vtabs-flat',
  'data-ag-vtabs-actions',
  'data-ag-vtabs-tab',
  'data-ag-vtabs-label',
  'data-ag-vtabs-meta',
  'data-ag-vtabs-icon',
  'data-ag-vtabs-close',
  'data-ag-vtabs-no-icon',
  'data-ag-vtabs-collapsed',
  'data-ag-vtabs-auto-collapsed',
  'data-ag-vtabs-hole',
  'data-ag-vtabs-title',
  'data-ag-vtabs-dragging',
  'data-ag-vtabs-cat',
  'data-ag-vtabs-tone',
  'data-ag-vtabs-ord',
  'data-ag-vtabs-gliding',
  'data-ag-vtabs-caustic',
  'data-ag-vtabs-ready',
  'data-ag-vtabs-active',
  'data-ag-vtabs-top-inset',
];
const NO_TRANSLATE_ATTRS = [
  ['translate', 'no'],
  ['data-no-translate', 'true'],
  ['data-ag-localization-skip', 'true'],
  ['data-agy-no-translate', 'true'],
  ['data-antigravity-zh-skip', '1'],
  ['data-ag-no-i18n', '1'],
];
const PROTECTED_UPSTREAM_KEYS = [
  'ag-pulse-enabled',
  'ag-pulse-theme',
  'ag-pulse-cache-v1',
];

const VTABS_JS_FILES = [
  'vendor/side-panel-vertical-tabs/vtabs-constants.js',
  'vendor/side-panel-vertical-tabs/vtabs-dom.js',
  'vendor/side-panel-vertical-tabs/vtabs-fiber.js',
  'vendor/side-panel-vertical-tabs/vtabs-sash.js',
  'vendor/side-panel-vertical-tabs/vtabs-motion.js',
  'vendor/side-panel-vertical-tabs/vtabs-controller.js',
];
const VTABS_CSS_FILES = [
  'vendor/side-panel-vertical-tabs/vtabs-layout.css',
  'vendor/side-panel-vertical-tabs/vtabs-theme.css',
];
const VTABS_ENTRY_REL = 'vendor/side-panel-vertical-tabs/vtabs-controller.js';

function loadVerticalTabsModule() {
  return require(path.join(ROOT, VTABS_ENTRY_REL));
}

function readVerticalTabsCss() {
  return VTABS_CSS_FILES.map((rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')).join('\n');
}

function readAllVerticalTabsJs() {
  return VTABS_JS_FILES.map((rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')).join('\n');
}

function checkBalancedBraces(css) {
  let depth = 0;
  let inComment = false;
  let quote = '';
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    const next = css[i + 1];
    if (inComment) {
      if (ch === '*' && next === '/') {
        inComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '*') {
      inComment = true;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0 && !inComment && !quote;
}

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function splitTopLevelCommas(str) {
  const out = [];
  let depth = 0;
  let bracket = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (quote) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === '[') bracket += 1;
    else if (ch === ']') bracket = Math.max(0, bracket - 1);
    else if (ch === ',' && depth === 0 && bracket === 0) {
      const part = str.slice(start, i).trim();
      if (part) out.push(part);
      start = i + 1;
    }
  }
  const tail = str.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

function parseFlatCssRules(rawCss) {
  const cleaned = stripCssComments(rawCss);
  const rules = [];
  let i = 0;
  const len = cleaned.length;

  function parseBlock(mediaCtx) {
    while (i < len) {
      while (i < len && /\s/.test(cleaned[i])) i += 1;
      if (i >= len || cleaned[i] === '}') {
        if (cleaned[i] === '}') i += 1;
        return;
      }
      const start = i;
      let quote = '';
      while (i < len) {
        const ch = cleaned[i];
        if (quote) {
          if (ch === '\\') { i += 2; continue; }
          if (ch === quote) quote = '';
          i += 1;
          continue;
        }
        if (ch === '"' || ch === "'") { quote = ch; i += 1; continue; }
        if (ch === '{' || ch === ';' || ch === '}') break;
        i += 1;
      }
      const prelude = cleaned.slice(start, i).trim();
      if (i >= len) break;
      if (cleaned[i] === ';') {
        i += 1;
        continue;
      }
      if (cleaned[i] === '}') {
        i += 1;
        return;
      }
      // cleaned[i] === '{'
      i += 1;
      if (prelude.startsWith('@media') || prelude.startsWith('@supports')) {
        parseBlock(mediaCtx ? `${mediaCtx} && ${prelude}` : prelude);
      } else if (prelude.startsWith('@')) {
        // Skip @keyframes or other at-rule blocks
        let d = 1;
        while (i < len && d > 0) {
          if (cleaned[i] === '{') d += 1;
          else if (cleaned[i] === '}') d -= 1;
          i += 1;
        }
      } else {
        const bodyStart = i;
        let d = 1;
        let q = '';
        while (i < len && d > 0) {
          const ch = cleaned[i];
          if (q) {
            if (ch === '\\') { i += 2; continue; }
            if (ch === q) q = '';
            i += 1;
            continue;
          }
          if (ch === '"' || ch === "'") { q = ch; i += 1; continue; }
          if (ch === '{') d += 1;
          else if (ch === '}') d -= 1;
          if (d > 0) i += 1;
        }
        const body = cleaned.slice(bodyStart, i).trim();
        if (cleaned[i] === '}') i += 1;
        rules.push({
          media: mediaCtx,
          prelude,
          selectors: splitTopLevelCommas(prelude),
          body,
        });
      }
    }
  }

  parseBlock('');
  return rules;
}

function getRightmostCompoundSelector(sel) {
  let depth = 0;
  let bracket = 0;
  let quote = '';
  let lastSplit = -1;
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    if (quote) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === '[') bracket += 1;
    else if (ch === ']') bracket = Math.max(0, bracket - 1);
    else if (depth === 0 && bracket === 0 && (ch === ' ' || ch === '\t' || ch === '\n' || ch === '>' || ch === '+' || ch === '~')) {
      lastSplit = i;
    }
  }
  return sel.slice(lastSplit + 1).trim();
}

function createRichMockDom(opts = {}) {
  const initialLang = opts.lang || 'zh-CN';
  const initialStorage = opts.initialStorage || {};
  const storeMap = new Map(Object.entries(initialStorage));
  const storage = {
    get length() { return storeMap.size; },
    key: (i) => Array.from(storeMap.keys())[i] ?? null,
    getItem: (k) => (storeMap.has(String(k)) ? storeMap.get(String(k)) : null),
    setItem: (k, v) => { storeMap.set(String(k), String(v)); },
    removeItem: (k) => { storeMap.delete(String(k)); },
    clear: () => { storeMap.clear(); },
  };

  const activeMOs = new Set();
  const activeROs = new Set();
  const activeTimers = new Set();
  const rafQueue = new Map();
  let nextRafId = 1;
  let totalRectReads = 0;

  const docListeners = new Map();
  const winListeners = new Map();

  function addL(map, type, fn, opt) {
    if (!fn) return;
    if (!map.has(type)) map.set(type, new Set());
    const capture = typeof opt === 'boolean' ? opt : Boolean(opt && opt.capture);
    for (const rec of map.get(type)) {
      if (rec.fn === fn && rec.capture === capture) return;
    }
    map.get(type).add({ fn, capture, opts: opt });
  }
  function remL(map, type, fn, opt) {
    const s = map.get(type);
    if (!s) return;
    const capture = typeof opt === 'boolean' ? opt : Boolean(opt && opt.capture);
    for (const rec of s) {
      if (rec.fn === fn && (opt === undefined || rec.capture === capture)) {
        s.delete(rec);
      }
    }
    if (s.size === 0) map.delete(type);
  }
  function countListeners(map, types = null) {
    let n = 0;
    for (const [t, s] of map.entries()) {
      if (!types || types.includes(t)) n += s.size;
    }
    return n;
  }

  class MockEvent {
    constructor(type, init = {}) {
      this.type = String(type);
      this.bubbles = Boolean(init.bubbles);
      this.cancelable = Boolean(init.cancelable);
      this.defaultPrevented = false;
      this.cancelBubble = false;
      this._stopped = false;
      this._stoppedImmediate = false;
      this.target = null;
      this.currentTarget = null;
      for (const [k, v] of Object.entries(init)) {
        if (!(k in this)) this[k] = v;
      }
    }
    preventDefault() {
      this.defaultPrevented = true;
    }
    stopPropagation() {
      this.cancelBubble = true;
      this._stopped = true;
    }
    stopImmediatePropagation() {
      this.cancelBubble = true;
      this._stopped = true;
      this._stoppedImmediate = true;
    }
  }

  function queueMutationRecord(rec) {
    for (const mo of activeMOs) {
      if (!mo._targets || mo._targets.size === 0) continue;
      let matched = false;
      for (const [target, opts] of mo._targets.entries()) {
        if (target === rec.target || (opts.subtree && target.contains(rec.target))) {
          if (rec.type === 'childList' && !opts.childList) continue;
          if (rec.type === 'attributes') {
            if (!opts.attributes) continue;
            if (Array.isArray(opts.attributeFilter) && !opts.attributeFilter.includes(rec.attributeName)) continue;
          }
          if (rec.type === 'characterData' && !opts.characterData) continue;
          matched = true;
          break;
        }
      }
      if (matched) mo._records.push(rec);
    }
  }

  class MockMutationObserver {
    constructor(cb) {
      this.cb = cb;
      this._targets = new Map();
      this._records = [];
    }
    observe(target, opts = {}) {
      if (!target) return;
      this._targets.set(target, opts || {});
      activeMOs.add(this);
    }
    disconnect() {
      this._targets.clear();
      this._records.length = 0;
      activeMOs.delete(this);
    }
    takeRecords() {
      const out = this._records.slice();
      this._records.length = 0;
      return out;
    }
  }

  class MockResizeObserver {
    constructor(cb) {
      this.cb = cb;
      this.targets = new Set();
    }
    observe(el) {
      if (!el) return;
      this.targets.add(el);
      activeROs.add(this);
    }
    unobserve(el) {
      this.targets.delete(el);
      if (this.targets.size === 0) activeROs.delete(this);
    }
    disconnect() {
      this.targets.clear();
      activeROs.delete(this);
    }
  }

  // Full CSS selector matcher supporting combinators (' ', '>', '+', '~'), :is(), :where(), :not(), attrs (^=, $=, *=, ~=, =), #id, .cls, tag
  function splitSelectorTokens(chain) {
    const tokens = [];
    let cur = '';
    let paren = 0;
    let bracket = 0;
    let quote = '';
    const flushCur = () => {
      if (cur.trim()) tokens.push({ type: 'compound', value: cur.trim() });
      cur = '';
    };
    for (let i = 0; i < chain.length; i++) {
      const ch = chain[i];
      if (quote) {
        cur += ch;
        if (ch === '\\' && i + 1 < chain.length) { cur += chain[++i]; continue; }
        if (ch === quote) quote = '';
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
      if (ch === '(') { paren += 1; cur += ch; continue; }
      if (ch === ')') { paren = Math.max(0, paren - 1); cur += ch; continue; }
      if (ch === '[') { bracket += 1; cur += ch; continue; }
      if (ch === ']') { bracket = Math.max(0, bracket - 1); cur += ch; continue; }
      if (paren === 0 && bracket === 0) {
        if (ch === '>' || ch === '+' || ch === '~') {
          flushCur();
          if (tokens.length && tokens[tokens.length - 1].type === 'comb' && tokens[tokens.length - 1].value === ' ') {
            tokens[tokens.length - 1].value = ch;
          } else {
            tokens.push({ type: 'comb', value: ch });
          }
          continue;
        }
        if (/\s/.test(ch)) {
          flushCur();
          if (tokens.length && tokens[tokens.length - 1].type === 'compound') {
            tokens.push({ type: 'comb', value: ' ' });
          }
          continue;
        }
      }
      cur += ch;
    }
    flushCur();
    while (tokens.length && tokens[tokens.length - 1].type === 'comb') tokens.pop();
    return tokens;
  }

  function extractBalancedParen(str, startIdx) {
    let depth = 0;
    let quote = '';
    for (let i = startIdx; i < str.length; i++) {
      const ch = str[i];
      if (quote) {
        if (ch === '\\') { i += 1; continue; }
        if (ch === quote) quote = '';
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === '(') depth += 1;
      else if (ch === ')') {
        depth -= 1;
        if (depth === 0) return { inner: str.slice(startIdx + 1, i), end: i + 1 };
      }
    }
    return null;
  }

  function matchCompound(el, compound) {
    if (!el || el.nodeType !== 1) return false;
    if (!compound || compound === '*') return true;
    let i = 0;
    const len = compound.length;
    if (compound[0] === '*') {
      i = 1;
    } else if (/^[a-zA-Z0-9_-]/.test(compound[0])) {
      const m = /^[a-zA-Z0-9_-]+/.exec(compound);
      if (el.tagName !== m[0].toUpperCase()) return false;
      i = m[0].length;
    }
    while (i < len) {
      const ch = compound[i];
      if (ch === '#') {
        const m = /^#([a-zA-Z0-9_-]+)/.exec(compound.slice(i));
        if (!m || el.id !== m[1]) return false;
        i += m[0].length;
      } else if (ch === '.') {
        const m = /^\.([a-zA-Z0-9_-]+)/.exec(compound.slice(i));
        if (!m || !el.classList.contains(m[1])) return false;
        i += m[0].length;
      } else if (ch === '[') {
        const closeIdx = compound.indexOf(']', i);
        if (closeIdx < 0) return false;
        const inner = compound.slice(i + 1, closeIdx).trim();
        const m = /^([^\]=~|^$*\s]+)(?:\s*([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+)))?(?:\s+[iIsS])?$/.exec(inner);
        if (!m) return false;
        const attrName = m[1];
        const op = m[2];
        const expected = m[3] ?? m[4] ?? m[5];
        const actual = el.getAttribute(attrName);
        if (!op) {
          if (!el.hasAttribute(attrName)) return false;
        } else {
          if (actual === null) return false;
          if (op === '=' && actual !== expected) return false;
          if (op === '^=' && !actual.startsWith(expected)) return false;
          if (op === '$=' && !actual.endsWith(expected)) return false;
          if (op === '*=' && !actual.includes(expected)) return false;
          if (op === '~=' && !actual.split(/\s+/).includes(expected)) return false;
          if (op === '|=' && actual !== expected && !actual.startsWith(expected + '-')) return false;
        }
        i = closeIdx + 1;
      } else if (ch === ':') {
        if (compound.startsWith(':not(', i) || compound.startsWith(':is(', i) || compound.startsWith(':where(', i)) {
          const isNot = compound.startsWith(':not(', i);
          const openParen = compound.indexOf('(', i);
          const ext = extractBalancedParen(compound, openParen);
          if (!ext) return false;
          const matched = matchesSelector(el, ext.inner);
          if (isNot ? matched : !matched) return false;
          i = ext.end;
        } else if (compound.startsWith(':first-child', i)) {
          if (!el.parentElement || el.parentElement.children[0] !== el) return false;
          i += ':first-child'.length;
        } else if (compound.startsWith(':last-child', i)) {
          const chs = el.parentElement?.children || [];
          if (chs[chs.length - 1] !== el) return false;
          i += ':last-child'.length;
        } else if (compound.startsWith(':empty', i)) {
          if (el.childNodes.length > 0) return false;
          i += ':empty'.length;
        } else {
          return false;
        }
      } else {
        return false;
      }
    }
    return true;
  }

  function matchChain(el, tokens, idx) {
    if (!matchCompound(el, tokens[idx].value)) return false;
    if (idx === 0) return true;
    const comb = tokens[idx - 1].value;
    const prevIdx = idx - 2;
    if (comb === '>') {
      return el.parentElement ? matchChain(el.parentElement, tokens, prevIdx) : false;
    }
    if (comb === ' ') {
      let p = el.parentElement;
      while (p) {
        if (matchChain(p, tokens, prevIdx)) return true;
        p = p.parentElement;
      }
      return false;
    }
    if (comb === '+') {
      return el.previousElementSibling ? matchChain(el.previousElementSibling, tokens, prevIdx) : false;
    }
    if (comb === '~') {
      let s = el.previousElementSibling;
      while (s) {
        if (matchChain(s, tokens, prevIdx)) return true;
        s = s.previousElementSibling;
      }
      return false;
    }
    return false;
  }

  function matchesSelector(el, selectorList) {
    if (!el || el.nodeType !== 1 || !selectorList) return false;
    const groups = splitTopLevelCommas(String(selectorList));
    return groups.some((chain) => {
      const tokens = splitSelectorTokens(chain);
      if (!tokens.length || tokens[tokens.length - 1].type !== 'compound') return false;
      return matchChain(el, tokens, tokens.length - 1);
    });
  }

  function mkText(text) {
    return {
      nodeType: 3,
      nodeName: '#text',
      _value: String(text ?? ''),
      parentNode: null,
      get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; },
      get nodeValue() { return this._value; },
      set nodeValue(v) {
        this._value = String(v ?? '');
        queueMutationRecord({ type: 'characterData', target: this });
      },
      get textContent() { return this._value; },
      set textContent(v) { this.nodeValue = v; },
      get isConnected() { return Boolean(this.parentNode?.isConnected); },
      remove() {
        if (this.parentNode) this.parentNode.removeChild(this);
      },
    };
  }

  function mkEl(tag, attrs = {}, rect = null, ns = null) {
    const attrMap = new Map();
    const childNodes = [];
    const elListeners = new Map();
    const styleProps = new Map();
    let elRef = null;
    const emitStyleMut = (prevCss) => {
      if (elRef) {
        queueMutationRecord({ type: 'attributes', target: elRef, attributeName: 'style', oldValue: prevCss });
      }
    };
    const styleObj = new Proxy(
      {
        getPropertyValue(k) { return styleProps.get(k) || ''; },
        setProperty(k, v) {
          const prevCss = styleObj.cssText;
          styleProps.set(k, String(v));
          // Match Blink/Chromium: CSSStyleDeclaration.setProperty emits an attributes:'style' record
          emitStyleMut(prevCss);
        },
        removeProperty(k) {
          const had = styleProps.has(k);
          const prevCss = styleObj.cssText;
          const prev = styleProps.get(k) || '';
          styleProps.delete(k);
          if (had) emitStyleMut(prevCss);
          return prev;
        },
        get cssText() {
          return Array.from(styleProps.entries()).map(([k, v]) => `${k}:${v}`).join(';');
        },
        set cssText(v) {
          const prevCss = styleObj.cssText;
          styleProps.clear();
          for (const decl of String(v || '').split(';')) {
            const idx = decl.indexOf(':');
            if (idx > 0) styleProps.set(decl.slice(0, idx).trim(), decl.slice(idx + 1).trim());
          }
          emitStyleMut(prevCss);
        },
      },
      {
        get(target, prop) {
          if (prop in target) return target[prop];
          if (typeof prop === 'string') {
            const kebab = prop.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
            return styleProps.get(prop) ?? styleProps.get(kebab) ?? '';
          }
          return undefined;
        },
        set(target, prop, val) {
          if (prop in target && prop !== 'cssText') { target[prop] = val; return true; }
          if (prop === 'cssText') { target.cssText = val; return true; }
          if (typeof prop === 'string') {
            const prevCss = target.cssText;
            const kebab = prop.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
            if (val === '' || val === null || val === undefined) {
              styleProps.delete(prop);
              styleProps.delete(kebab);
            } else {
              styleProps.set(kebab, String(val));
            }
            emitStyleMut(prevCss);
            return true;
          }
          return false;
        },
      }
    );

    const el = {
      nodeType: 1,
      tagName: String(tag).toUpperCase(),
      nodeName: String(tag).toUpperCase(),
      namespaceURI: ns || 'http://www.w3.org/1999/xhtml',
      parentNode: null,
      get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; },
      childNodes,
      get children() { return childNodes.filter((c) => c.nodeType === 1); },
      get childElementCount() { return this.children.length; },
      get firstChild() { return childNodes[0] || null; },
      get lastChild() { return childNodes[childNodes.length - 1] || null; },
      get firstElementChild() { return this.children[0] || null; },
      get lastElementChild() { const cs = this.children; return cs[cs.length - 1] || null; },
      get nextSibling() {
        if (!this.parentNode) return null;
        const i = this.parentNode.childNodes.indexOf(this);
        return i >= 0 ? this.parentNode.childNodes[i + 1] || null : null;
      },
      get previousSibling() {
        if (!this.parentNode) return null;
        const i = this.parentNode.childNodes.indexOf(this);
        return i > 0 ? this.parentNode.childNodes[i - 1] : null;
      },
      get nextElementSibling() {
        let s = this.nextSibling;
        while (s && s.nodeType !== 1) s = s.nextSibling;
        return s;
      },
      get previousElementSibling() {
        let s = this.previousSibling;
        while (s && s.nodeType !== 1) s = s.previousSibling;
        return s;
      },
      get isConnected() {
        let c = this;
        while (c) {
          if (c === html || c === doc) return true;
          c = c.parentNode;
        }
        return false;
      },
      get ownerDocument() { return doc; },
      style: styleObj,
      _rect: rect || { left: 0, top: 0, width: 560, height: 680, right: 560, bottom: 680 },
      _rectReads: 0,
      get clientWidth() { return this._clientWidth !== undefined ? this._clientWidth : this._rect.width; },
      set clientWidth(v) { this._clientWidth = v; },
      get clientHeight() { return this._clientHeight !== undefined ? this._clientHeight : this._rect.height; },
      set clientHeight(v) { this._clientHeight = v; },
      get offsetWidth() { return this.clientWidth; },
      get offsetHeight() { return this.clientHeight; },
      clientLeft: 0,
      clientTop: 0,
      scrollTop: 0,
      scrollLeft: 0,
      disabled: false,
      tabIndex: 0,
      get hidden() { return attrMap.has('hidden'); },
      set hidden(v) {
        if (v) this.setAttribute('hidden', '');
        else this.removeAttribute('hidden');
      },
      get id() { return attrMap.get('id') || ''; },
      set id(v) { if (v) this.setAttribute('id', String(v)); else this.removeAttribute('id'); },
      get className() { return attrMap.get('class') || ''; },
      set className(v) { this.setAttribute('class', String(v || '')); },
      get title() { return attrMap.get('title') || ''; },
      set title(v) {
        if (v === '' || v === null || v === undefined) this.removeAttribute('title');
        else this.setAttribute('title', String(v));
      },
      get type() { return attrMap.get('type') || ''; },
      set type(v) { this.setAttribute('type', String(v)); },
      get attributes() {
        return Array.from(attrMap.entries()).map(([name, value]) => ({ name, value }));
      },
      getAttributeNames() {
        return Array.from(attrMap.keys());
      },
      get textContent() {
        return childNodes.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join('');
      },
      set textContent(v) {
        const removed = childNodes.splice(0);
        for (const r of removed) r.parentNode = null;
        const s = String(v ?? '');
        const added = [];
        if (s.length > 0) {
          const tn = mkText(s);
          tn.parentNode = this;
          childNodes.push(tn);
          added.push(tn);
        }
        queueMutationRecord({ type: 'childList', target: this, addedNodes: added, removedNodes: removed });
      },
      get innerText() { return this.textContent; },
      set innerText(v) { this.textContent = v; },
      classList: {
        contains: (c) => (attrMap.get('class') || '').split(/\s+/).filter(Boolean).includes(c),
        add: (...cs) => {
          const s = new Set((attrMap.get('class') || '').split(/\s+/).filter(Boolean));
          cs.forEach((c) => { if (c) s.add(c); });
          el.setAttribute('class', [...s].join(' '));
        },
        remove: (...cs) => {
          const s = new Set((attrMap.get('class') || '').split(/\s+/).filter(Boolean));
          cs.forEach((c) => s.delete(c));
          el.setAttribute('class', [...s].join(' '));
        },
        toggle: (c, force) => {
          const on = force === undefined ? !el.classList.contains(c) : Boolean(force);
          if (on) el.classList.add(c);
          else el.classList.remove(c);
          return on;
        },
      },
      setAttribute(k, v) {
        const key = String(k);
        const val = String(v);
        const prev = attrMap.has(key) ? attrMap.get(key) : null;
        attrMap.set(key, val);
        if (prev !== val) {
          queueMutationRecord({ type: 'attributes', target: this, attributeName: key, oldValue: prev });
        }
      },
      getAttribute(k) {
        const key = String(k);
        return attrMap.has(key) ? attrMap.get(key) : null;
      },
      hasAttribute(k) {
        return attrMap.has(String(k));
      },
      removeAttribute(k) {
        const key = String(k);
        if (!attrMap.has(key)) return;
        const prev = attrMap.get(key);
        attrMap.delete(key);
        queueMutationRecord({ type: 'attributes', target: this, attributeName: key, oldValue: prev });
      },
      toggleAttribute(k, force) {
        const on = force === undefined ? !this.hasAttribute(k) : Boolean(force);
        if (on) this.setAttribute(k, '');
        else this.removeAttribute(k);
        return on;
      },
      appendChild(c) {
        if (!c) return c;
        if (c.nodeType === 11) {
          const items = c.childNodes.slice();
          for (const item of items) this.appendChild(item);
          return c;
        }
        if (c.parentNode) c.parentNode.removeChild(c);
        c.parentNode = this;
        childNodes.push(c);
        queueMutationRecord({ type: 'childList', target: this, addedNodes: [c], removedNodes: [] });
        return c;
      },
      insertBefore(c, ref) {
        if (!c) return c;
        if (c.nodeType === 11) {
          const items = c.childNodes.slice();
          for (const item of items) this.insertBefore(item, ref);
          return c;
        }
        if (c.parentNode) c.parentNode.removeChild(c);
        c.parentNode = this;
        const idx = ref ? childNodes.indexOf(ref) : -1;
        if (idx >= 0) childNodes.splice(idx, 0, c);
        else childNodes.push(c);
        queueMutationRecord({ type: 'childList', target: this, addedNodes: [c], removedNodes: [] });
        return c;
      },
      prepend(...nodes) {
        const first = childNodes[0] || null;
        for (const n of nodes) {
          this.insertBefore(typeof n === 'string' ? mkText(n) : n, first);
        }
      },
      append(...nodes) {
        for (const n of nodes) {
          this.appendChild(typeof n === 'string' ? mkText(n) : n);
        }
      },
      replaceChildren(...nodes) {
        const removed = childNodes.splice(0);
        for (const r of removed) r.parentNode = null;
        const added = [];
        for (const n of nodes) {
          const item = typeof n === 'string' ? mkText(n) : n;
          if (item.parentNode) item.parentNode.removeChild(item);
          item.parentNode = this;
          childNodes.push(item);
          added.push(item);
        }
        queueMutationRecord({ type: 'childList', target: this, addedNodes: added, removedNodes: removed });
      },
      removeChild(c) {
        const idx = childNodes.indexOf(c);
        if (idx >= 0) {
          childNodes.splice(idx, 1);
          c.parentNode = null;
          queueMutationRecord({ type: 'childList', target: this, addedNodes: [], removedNodes: [c] });
        }
        return c;
      },
      remove() {
        if (this.parentNode) this.parentNode.removeChild(this);
      },
      contains(other) {
        let c = other;
        while (c) {
          if (c === this) return true;
          c = c.parentNode;
        }
        return false;
      },
      matches(sel) {
        return matchesSelector(this, sel);
      },
      closest(sel) {
        let c = this;
        while (c && c.nodeType === 1) {
          if (matchesSelector(c, sel)) return c;
          c = c.parentElement;
        }
        return null;
      },
      querySelectorAll(sel) {
        const out = [];
        const walk = (n) => {
          for (const c of n.childNodes) {
            if (c.nodeType === 1) {
              if (matchesSelector(c, sel)) out.push(c);
              walk(c);
            }
          }
        };
        walk(this);
        return out;
      },
      querySelector(sel) {
        return this.querySelectorAll(sel)[0] || null;
      },
      getElementById(id) {
        return this.querySelector(`#${id}`);
      },
      getBoundingClientRect() {
        this._rectReads += 1;
        totalRectReads += 1;
        return { ...this._rect };
      },
      focus() {
        doc.activeElement = this;
      },
      _capturedPointers: new Set(),
      _captureHistory: [],
      setPointerCapture(pid) {
        this._capturedPointers.add(pid);
        this._captureHistory.push({ op: 'set', pointerId: pid });
      },
      releasePointerCapture(pid) {
        this._capturedPointers.delete(pid);
        this._captureHistory.push({ op: 'release', pointerId: pid });
      },
      hasPointerCapture(pid) {
        return this._capturedPointers.has(pid);
      },
      animate() {
        return { cancel() {}, finished: Promise.resolve() };
      },
      _listeners: elListeners,
      addEventListener(t, fn, opt) { addL(elListeners, t, fn, opt); },
      removeEventListener(t, fn, opt) { remL(elListeners, t, fn, opt); },
      dispatchEvent(rawEv) {
        const ev = rawEv instanceof MockEvent ? rawEv : Object.assign(new MockEvent(rawEv?.type || 'event', rawEv), rawEv);
        ev.target = ev.target || this;
        const pathNodes = [];
        let cur = this;
        while (cur) {
          pathNodes.push(cur);
          cur = cur.parentNode;
        }
        // Capture phase: win -> doc -> ancestors -> target
        const captureTargets = [
          { node: win, map: winListeners },
          { node: doc, map: docListeners },
          ...pathNodes.slice().reverse().map((n) => ({ node: n, map: n._listeners })),
        ];
        for (const item of captureTargets) {
          if (ev._stopped) break;
          const set = item.map?.get(ev.type);
          if (!set) continue;
          ev.currentTarget = item.node;
          for (const rec of [...set]) {
            if (ev._stoppedImmediate) break;
            if (rec.capture) rec.fn.call(item.node, ev);
          }
        }
        // Target & bubble phase
        const bubbleTargets = [
          ...pathNodes.map((n) => ({ node: n, map: n._listeners })),
          { node: doc, map: docListeners },
          { node: win, map: winListeners },
        ];
        for (let idx = 0; idx < bubbleTargets.length; idx++) {
          if (ev._stopped) break;
          if (idx > 0 && !ev.bubbles) break;
          const item = bubbleTargets[idx];
          const set = item.map?.get(ev.type);
          if (!set) continue;
          ev.currentTarget = item.node;
          for (const rec of [...set]) {
            if (ev._stoppedImmediate) break;
            if (!rec.capture) rec.fn.call(item.node, ev);
          }
        }
        return !ev.defaultPrevented;
      },
      click() {
        const ev = new MockEvent('click', { bubbles: true, cancelable: true });
        this.dispatchEvent(ev);
        return ev;
      },
    };
    elRef = el;

    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') el.textContent = v;
      else if (k === 'hidden') { if (v) el.setAttribute('hidden', ''); }
      else el.setAttribute(k, v);
    }
    return el;
  }

  const html = mkEl('html', { 'data-ag-cs-style': '1', 'data-ag-cs-side-panel-vertical-tabs': 'on', 'data-ag-cs-lang': initialLang });
  const head = mkEl('head');
  const body = mkEl('body', { class: 'theme-dark' });
  html.appendChild(head);
  html.appendChild(body);

  const doc = {
    nodeType: 9,
    documentElement: html,
    head,
    body,
    hidden: false,
    visibilityState: 'visible',
    activeElement: body,
    hasFocus: () => true,
    createElement: (t) => mkEl(t),
    createElementNS: (ns, t) => mkEl(t, {}, null, ns),
    createTextNode: (t) => mkText(t),
    createDocumentFragment: () => {
      const frag = {
        nodeType: 11,
        childNodes: [],
        appendChild(c) { this.childNodes.push(c); return c; },
      };
      return frag;
    },
    getElementById: (id) => html.querySelector(`#${id}`),
    querySelector: (s) => html.querySelector(s),
    querySelectorAll: (s) => html.querySelectorAll(s),
    contains: (n) => html.contains(n),
    addEventListener: (t, fn, opt) => addL(docListeners, t, fn, opt),
    removeEventListener: (t, fn, opt) => remL(docListeners, t, fn, opt),
    dispatchEvent(rawEv) {
      const ev = rawEv instanceof MockEvent ? rawEv : Object.assign(new MockEvent(rawEv?.type || 'event', rawEv), rawEv);
      ev.target = ev.target || doc;
      ev.currentTarget = doc;
      for (const rec of [...(docListeners.get(ev.type) || [])]) rec.fn.call(doc, ev);
      return !ev.defaultPrevented;
    },
  };

  let reducedMotion = Boolean(opts.reducedMotion);
  const win = {
    document: doc,
    localStorage: storage,
    navigator: { language: initialLang, languages: [initialLang, 'en'] },
    location: { href: 'https://127.0.0.1:14472/c/test-pane-1', pathname: '/c/test-pane-1' },
    innerWidth: 1440,
    innerHeight: 900,
    Event: MockEvent,
    CustomEvent: MockEvent,
    MutationObserver: MockMutationObserver,
    ResizeObserver: MockResizeObserver,
    performance: { now: () => Date.now() },
    matchMedia(q) {
      const isReduce = String(q || '').includes('prefers-reduced-motion') && String(q || '').includes('reduce');
      return {
        get matches() { return isReduce ? Boolean(reducedMotion) : false; },
        addEventListener() {},
        removeEventListener() {},
      };
    },
    getComputedStyle(el) {
      const hidden = !el || el.hidden || el.style.display === 'none' || el.classList?.contains?.('hidden');
      return {
        display: hidden ? 'none' : (el.style.display || 'flex'),
        visibility: el?.style?.visibility || 'visible',
        flexDirection: el?.style?.flexDirection || 'column',
        position: el?.style?.position || 'static',
        getPropertyValue: (k) => el?.style?.getPropertyValue?.(k) || '',
      };
    },
    requestAnimationFrame(cb) {
      const id = nextRafId++;
      rafQueue.set(id, cb);
      return id;
    },
    cancelAnimationFrame(id) {
      rafQueue.delete(id);
    },
    setTimeout(fn, ms) {
      const id = setTimeout(() => {
        activeTimers.delete(id);
        fn();
      }, ms);
      activeTimers.add(id);
      return id;
    },
    clearTimeout(id) {
      activeTimers.delete(id);
      clearTimeout(id);
    },
    addEventListener: (t, fn, opt) => addL(winListeners, t, fn, opt),
    removeEventListener: (t, fn, opt) => remL(winListeners, t, fn, opt),
    dispatchEvent(rawEv) {
      const ev = rawEv instanceof MockEvent ? rawEv : Object.assign(new MockEvent(rawEv?.type || 'event', rawEv), rawEv);
      ev.target = ev.target || win;
      ev.currentTarget = win;
      for (const rec of [...(winListeners.get(ev.type) || [])]) rec.fn.call(win, ev);
      return !ev.defaultPrevented;
    },
  };
  win.window = win;
  win.globalThis = win;
  win.self = win;
  win.top = win;
  doc.defaultView = win;

  function flushRaf() {
    let guard = 0;
    while (rafQueue.size > 0 && guard < 12) {
      guard += 1;
      const batch = Array.from(rafQueue.entries());
      rafQueue.clear();
      for (const [, cb] of batch) cb(Date.now());
    }
  }

  function deliverMutations(explicitRecords = null) {
    for (const mo of [...activeMOs]) {
      const recs = explicitRecords || mo.takeRecords();
      if (recs.length > 0) mo.cb(recs, mo);
    }
    flushRaf();
  }

  function drainMutationsAndRaf(maxCycles = 12) {
    let cycles = 0;
    let moBatches = 0;
    let rafFrames = 0;
    while (cycles < maxCycles) {
      let didWork = false;
      for (const mo of [...activeMOs]) {
        const recs = mo.takeRecords();
        if (recs.length > 0) {
          moBatches += 1;
          didWork = true;
          mo.cb(recs, mo);
        }
      }
      if (rafQueue.size > 0) {
        rafFrames += 1;
        didWork = true;
        const batch = Array.from(rafQueue.entries());
        rafQueue.clear();
        for (const [, cb] of batch) cb(Date.now());
      }
      if (!didWork) break;
      cycles += 1;
    }
    const stillPending =
      rafQueue.size > 0 || [...activeMOs].some((mo) => (mo._records?.length || 0) > 0);
    return { cycles, moBatches, rafFrames, saturated: stillPending };
  }

  function triggerResize(target, width, height = 680) {
    if (target) {
      target._rect = { left: 0, top: 0, width, height, right: width, bottom: height };
      target._clientWidth = width;
      target._clientHeight = height;
    }
    for (const ro of [...activeROs]) {
      if (ro.targets.has(target)) {
        ro.cb(
          [
            {
              target,
              contentRect: { left: 0, top: 0, width, height, right: width, bottom: height },
              borderBoxSize: [{ inlineSize: width, blockSize: height }],
            },
          ],
          ro
        );
      }
    }
    flushRaf();
  }

  function collectAllElements(rootEl = html) {
    const out = [rootEl];
    const walk = (n) => {
      for (const c of n.children) {
        out.push(c);
        walk(c);
      }
    };
    walk(rootEl);
    return out;
  }

  function findAnyVtabsAttrs(rootEl = html) {
    const found = [];
    for (const el of collectAllElements(rootEl)) {
      for (const name of el.getAttributeNames()) {
        if (name.startsWith('data-ag-vtabs-')) found.push({ el, attr: name, val: el.getAttribute(name) });
      }
    }
    return found;
  }

  return {
    win,
    doc,
    html,
    head,
    body,
    storage,
    storeMap,
    mkEl,
    mkText,
    MockEvent,
    activeMOs,
    activeROs,
    activeTimers,
    rafQueue,
    docListeners,
    winListeners,
    countDocListeners: (types) => countListeners(docListeners, types),
    countWinListeners: (types) => countListeners(winListeners, types),
    get reducedMotion() { return reducedMotion; },
    set reducedMotion(v) { reducedMotion = Boolean(v); },
    get totalRectReads() { return totalRectReads; },
    resetRectReads() {
      totalRectReads = 0;
      for (const el of collectAllElements(html)) el._rectReads = 0;
    },
    flushRaf,
    deliverMutations,
    drainMutationsAndRaf,
    triggerResize,
    collectAllElements,
    findAnyVtabsAttrs,
  };
}

function createNativeTab(env, spec, callbacks) {
  const tab = env.mkEl('div', {
    class: 'agy-aux-tab',
    role: 'tab',
    'aria-selected': spec.active ? 'true' : 'false',
    ...(spec.active ? { 'data-active': 'true', 'data-state': 'active' } : {}),
    ...(spec.nativeTitle ? { title: spec.nativeTitle } : {}),
    'data-tab-id': spec.id,
  });

  if (!spec.noIcon) {
    const svg = env.doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'agy-tab-icon');
    const p = env.doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M2 2h12v12H2z');
    svg.appendChild(p);
    tab.appendChild(svg);
  }

  const label = env.mkEl('span', { class: 'agy-tab-title', text: spec.label });
  tab.appendChild(label);

  const closeBtn = env.mkEl('button', {
    type: 'button',
    class: 'agy-aux-tab-close',
    'aria-label': spec.closeLabel || 'Close Tab',
  });
  if (spec.noIcon) {
    closeBtn.textContent = 'x';
  } else {
    const closeSvg = env.doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    closeSvg.setAttribute('width', '12');
    closeSvg.setAttribute('height', '12');
    closeBtn.appendChild(closeSvg);
  }
  tab.appendChild(closeBtn);

  tab.addEventListener('click', (ev) => {
    callbacks.onSelect?.(spec.id, tab, ev);
  });
  closeBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    callbacks.onClose?.(spec.id, tab, ev);
  });

  return { tab, label, closeBtn };
}

function buildRightSidePanelFixture(env, opts = {}) {
  const topology = opts.topology || 'nested';
  const hostWidth = opts.hostWidth ?? 560;
  const tabSpecs = opts.tabs || [
    { id: 'btw-1', label: '/btw How does Channel 18 disk cache invalidate?', active: true },
    { id: 'btw-2', label: '/btw Compare flex row vs grid for WebContentsView hole' },
    { id: 'btw-3', label: '/btw Check 8-locale CJK leakage guard in i18n-locales.js' },
    { id: 'btw-4', label: '/btw Explain ResizeObserver contentRect vs getBoundingClientRect' },
    { id: 'art-1', label: 'Artifact: SPEC_VERTICAL_TABS.md', nativeTitle: 'Native Host Artifact Tooltip' },
    { id: 'diff-1', label: 'Diff: cdp.js (+120 -4)' },
    { id: 'term-1', label: 'Terminal: npm test' },
    { id: 'web-1', label: 'Browser: localhost:5173' },
    { id: 'plug-1', label: 'Plugin: Obsidian Prism' },
    { id: 'note-1', label: 'Notes: No-Icon Tab', noIcon: true },
  ];

  // Authentic Antigravity Desktop DOM (workbench/replica.html:56-161):
  // body > #root > .app-shell-wrap > [data-testid="sidebar-split"].agy-shell
  //   > div:first-child (left main sidebar)
  //   > [data-testid="sidebar-sash"]
  //   > div:last-child (workspace col) > [data-testid="aux-pane-split"] > [mainSlot, sash, rightSlot > host]
  const root = env.mkEl('div', { id: 'root' });
  const shellWrap = env.mkEl('div', { class: 'flex-1 min-h-0 w-full relative overflow-hidden' });
  const sidebarSplit = env.mkEl('div', { 'data-testid': 'sidebar-split', class: 'agy-shell relative flex w-full h-full' });
  const leftSidebar = env.mkEl('div', { class: 'flex ag-replica-sb-wrap bg-sidebar h-full', id: 'ag-sidebar-pane' });
  const sidebarSash = env.mkEl('div', { 'data-testid': 'sidebar-sash' });
  const workspaceRightCol = env.mkEl('div', { class: 'flex-1 min-w-0 h-full overflow-hidden' });
  const auxSplit = env.mkEl('div', { 'data-testid': 'aux-pane-split', 'data-ag-cs-aux-dual': '1' });

  const mainSlot = env.mkEl('div', { class: 'main-workspace-slot' });
  const pane1 = env.mkEl('div', { 'data-tiling-pane': '1' });
  pane1.appendChild(env.mkEl('div', { 'data-testid': 'conversation-view', 'data-cascade-id': 'cid-pane-1' }));
  const pane2 = env.mkEl('div', { 'data-tiling-pane': '2' });
  pane2.appendChild(env.mkEl('div', { 'data-testid': 'conversation-view', 'data-cascade-id': 'cid-pane-2' }));
  mainSlot.appendChild(pane1);
  mainSlot.appendChild(env.mkEl('div', { 'data-testid': 'tiling-splitter' }));
  mainSlot.appendChild(pane2);

  const sash = env.mkEl('div', { role: 'separator' });
  const rightSlot = env.mkEl('div', { class: 'right-panel-slot' });
  const host = env.mkEl(
    'div',
    { class: 'agy-inset-shell', 'data-side-panel-focus-scope': 'true' },
    { left: 880, top: 0, width: hostWidth, height: 720, right: 880 + hostWidth, bottom: 720 }
  );
  const strip = env.mkEl('div', { 'data-side-panel-strip': '' }, { left: 880, top: 0, width: hostWidth, height: 36, right: 880 + hostWidth, bottom: 36 });
  const panelBody = env.mkEl('div', { 'data-side-panel-body': '' }, { left: 880, top: 36, width: hostWidth, height: 684, right: 880 + hostWidth, bottom: 720 });
  panelBody.appendChild(env.mkEl('div', { 'data-testid': 'side-question-panel', text: 'Active /btw thread content' }));

  const selectedLog = [];
  const closedLog = [];
  let tabEntries = [];

  const selectTab = (id) => {
    for (const entry of tabEntries) {
      const isAct = entry.spec.id === id;
      entry.tab.setAttribute('aria-selected', isAct ? 'true' : 'false');
      if (isAct) {
        entry.tab.setAttribute('data-active', 'true');
        entry.tab.setAttribute('data-state', 'active');
      } else {
        entry.tab.removeAttribute('data-active');
        entry.tab.removeAttribute('data-state');
      }
    }
  };

  let tabList = null;
  let toolbar = null;
  const tabParent = topology === 'nested' ? (tabList = env.mkEl('div', { role: 'tablist', class: 'agy-aux-tablist' })) : strip;
  if (topology === 'nested') {
    strip.appendChild(tabList);
    toolbar = env.mkEl('div', { 'data-testid': 'pane-titlebar-toolbar' });
    toolbar.appendChild(env.mkEl('button', { type: 'button', 'data-testid': 'toggle-maximize-pane', 'aria-label': 'Toggle Maximize Side Panel' }));
    strip.appendChild(toolbar);
  }

  const mountTabs = (specs, targetParent = tabParent) => {
    const created = [];
    for (const spec of specs) {
      const built = createNativeTab(env, spec, {
        onSelect(id, _tab, ev) {
          selectedLog.push({ id, defaultPrevented: ev.defaultPrevented });
          selectTab(id);
        },
        onClose(id, tabEl, ev) {
          closedLog.push({ id, defaultPrevented: ev.defaultPrevented });
          tabEl.remove();
          tabEntries = tabEntries.filter((e) => e.spec.id !== id);
        },
      });
      targetParent.appendChild(built.tab);
      created.push({ spec, ...built });
    }
    tabEntries = created;
    return created;
  };

  mountTabs(tabSpecs, tabParent);

  host.appendChild(strip);
  host.appendChild(panelBody);
  rightSlot.appendChild(host);
  auxSplit.appendChild(mainSlot);
  auxSplit.appendChild(sash);
  auxSplit.appendChild(rightSlot);
  workspaceRightCol.appendChild(auxSplit);
  sidebarSplit.appendChild(leftSidebar);
  sidebarSplit.appendChild(sidebarSash);
  sidebarSplit.appendChild(workspaceRightCol);
  shellWrap.appendChild(sidebarSplit);
  root.appendChild(shellWrap);
  env.body.appendChild(root);

  return {
    root,
    shellWrap,
    shell: sidebarSplit,
    sidebarSplit,
    leftSidebar,
    sidebarSash,
    workspaceRightCol,
    auxSplit,
    mainSlot,
    pane1,
    pane2,
    rightSlot,
    host,
    strip,
    tabList,
    toolbar,
    panelBody,
    get tabEntries() { return tabEntries; },
    selectedLog,
    closedLog,
    mountTabs,
  };
}

function assertOwnedAndNoTranslate(el, label) {
  assert.ok(el, `${label} must exist`);
  assert.equal(el.getAttribute('data-ag-owned'), '1', `${label} must carry data-ag-owned="1"`);
  for (const [attr, val] of NO_TRANSLATE_ATTRS) {
    assert.equal(el.getAttribute(attr), val, `${label} must carry ${attr}="${val}"`);
  }
}

function assertNoHostTranslationContamination(hostNodes) {
  for (const node of hostNodes) {
    if (!node) continue;
    assert.equal(node.hasAttribute('data-ag-owned'), false, `Host <${node.tagName}> must NOT carry data-ag-owned`);
    for (const [attr] of NO_TRANSLATE_ATTRS) {
      assert.equal(node.hasAttribute(attr), false, `Host <${node.tagName}> must NOT carry anti-translation attr ${attr}`);
    }
  }
}

// ── 1. Config, Channel 1 Budget, Channel 18 Gating, Law 2 Modularity, Disk Cache & Packaging Parity ──
test('1. Config schema, Channel 1 byte budgets, Channel 18 gating, Law 2 modular files, disk cache hit & cross-OS packaging parity', () => {
  // Config defaults, validators, alias coercion & config.example.json
  assert.equal(cdp.DEFAULT_CONFIG.sidePanelVerticalTabs, 'off');
  assert.ok(Array.isArray(cdp.VALIDATORS.sidePanelVerticalTabs));
  assert.equal(cdp.validateConfigEntry('sidePanelVerticalTabs', 'off'), true);
  assert.equal(cdp.validateConfigEntry('sidePanelVerticalTabs', 'on'), true);
  assert.equal(cdp.validateConfigEntry('sidePanelVerticalTabs', 'auto'), false);
  assert.equal(cdp.validateConfigEntry('sidePanelVerticalTabs', 'invalid'), false);
  assert.equal(cdp.validateConfigEntry('sidePanelVerticalTabs', 123), false);

  assert.equal(cdp.reconcileConfigAliases({ sidePanelVerticalTabs: true }).sidePanelVerticalTabs, 'on');
  assert.equal(cdp.reconcileConfigAliases({ sidePanelVerticalTabs: false }).sidePanelVerticalTabs, 'off');
  assert.equal(cdp.reconcileConfigAliases({ sidePanelVerticalTabs: 'on' }).sidePanelVerticalTabs, 'on');
  assert.equal(cdp.reconcileConfigAliases({ sidePanelVerticalTabs: 'off' }).sidePanelVerticalTabs, 'off');

  const cfgExBuf = fs.readFileSync(path.join(ROOT, 'config.example.json'));
  const cfgExTxt = cfgExBuf.toString('utf8');
  assert.equal(cfgExBuf[0] === 0xef && cfgExBuf[1] === 0xbb && cfgExBuf[2] === 0xbf, false, 'config.example.json must have 0 BOM');
  assert.equal(cfgExTxt.includes('\r'), false, 'config.example.json must use pure LF');
  const cfgEx = JSON.parse(cfgExTxt);
  assert.equal(cfgEx.sidePanelVerticalTabs, 'off');

  // Module placement & Law 2 cap: Channel 18 lives under modular vendor/ files (each <= 800 lines & <= 40,960 B), NEVER in Channel 1 RUNTIME_PARTS or root lists
  assert.equal(fs.existsSync(path.join(ROOT, 'vendor/side-panel-vertical-tabs/side-panel-vertical-tabs.js')), false, 'Legacy unsplit monolith .js must be removed');
  assert.equal(fs.existsSync(path.join(ROOT, 'vendor/side-panel-vertical-tabs/side-panel-vertical-tabs.css')), false, 'Legacy unsplit monolith .css must be removed');
  for (const rel of [...VTABS_JS_FILES, ...VTABS_CSS_FILES]) {
    const abs = path.join(ROOT, rel);
    assert.equal(fs.existsSync(abs), true, `Missing modular vtabs file: ${rel}`);
    const buf = fs.readFileSync(abs);
    const lines = buf.toString('utf8').split('\n').length;
    assert.ok(lines <= 800, `Law 2 violation: ${rel} has ${lines} lines (> 800)`);
    assert.ok(buf.length <= 40960, `Law 2 violation: ${rel} is ${buf.length} B (> 40,960 B)`);
    const base = path.basename(rel);
    assert.equal(cdp.RUNTIME_PARTS.includes(base), false);
    assert.equal(cdp.DEFERRED_ROOT_MODULES.includes(base), false);
    assert.equal(cdp.SYNC_ROOT_FILES.includes(base), false);
  }

  // Channel 18 registry contract & gating: strictly 0 B when off
  const ch18 = cdp.findChannel('sidePanelVtabs');
  assert.ok(ch18, 'CHANNEL_REGISTRY must register sidePanelVtabs');
  assert.equal(ch18.channelNumber, 18);
  assert.equal(ch18.order, 180);
  assert.deepEqual([...ch18.files], [...VTABS_JS_FILES, ...VTABS_CSS_FILES]);
  assert.equal(cdp.shouldEnableSidePanelVerticalTabs({ sidePanelVerticalTabs: 'off' }), false);
  assert.equal(cdp.shouldEnableSidePanelVerticalTabs(cdp.DEFAULT_CONFIG), false);
  assert.equal(cdp.buildSidePanelVerticalTabsExpression({ ...cdp.DEFAULT_CONFIG, sidePanelVerticalTabs: 'off' }), '');
  assert.equal(ch18.shouldEnable(cdp.DEFAULT_CONFIG), false);
  assert.equal(ch18.build(cdp.DEFAULT_CONFIG, { noDiskCache: true }), '');

  // Channel 18 enabled: valid JS, valid remove expression, within budgetBytes, disk cache byte-for-byte hit
  assert.equal(cdp.shouldEnableSidePanelVerticalTabs({ sidePanelVerticalTabs: 'on' }), true);
  assert.equal(typeof cdp.SIDE_PANEL_VTABS_REMOVE_EXPRESSION, 'string');
  assert.doesNotThrow(() => new vm.Script(cdp.SIDE_PANEL_VTABS_REMOVE_EXPRESSION));
  assert.equal(ch18.teardown, cdp.SIDE_PANEL_VTABS_REMOVE_EXPRESSION);

  if (typeof cdp.readCompiledSidePanelVtabsAssets === 'function') {
    const assets = cdp.readCompiledSidePanelVtabsAssets({ noDiskCache: true });
    assert.ok(assets && assets.minRuntime && assets.codeHash, 'readCompiledSidePanelVtabsAssets must return compiled runtime & codeHash');
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-vtabs-cache-'));
  const cachePath = path.join(tmpDir, '.bundle-cache.json');
  try {
    cdp.resetBundleCacheStats();
    const coldExpr = cdp.buildSidePanelVerticalTabsExpression(
      { ...cdp.DEFAULT_CONFIG, sidePanelVerticalTabs: 'on' },
      { cachePath }
    );
    const coldBytes = Buffer.byteLength(coldExpr, 'utf8');
    assert.ok(coldBytes > 500 && coldBytes <= ch18.budgetBytes, `Enabled Channel 18 payload ${coldBytes} B must stay within budgetBytes ${ch18.budgetBytes} B`);
    assert.doesNotThrow(() => new vm.Script(coldExpr), 'Compiled Channel 18 expression must be valid JS');
    assert.ok(coldExpr.includes('__agPrismSidePanelVtabsCss'), 'Channel 18 expression must bind minified CSS global');

    // Red-team #168 #3: compiled Ch18 browser IIFE must work even when host defines window.module={exports:{}} without require
    const modTrapEnv = createRichMockDom({ lang: 'en' });
    buildRightSidePanelFixture(modTrapEnv, { topology: 'nested', hostWidth: 560 });
    const modTrapObj = { exports: {} };
    const modTrapSb = {
      window: null,
      globalThis: null,
      self: null,
      top: null,
      module: modTrapObj,
      document: modTrapEnv.doc,
      navigator: modTrapEnv.win.navigator,
      location: modTrapEnv.win.location,
      localStorage: modTrapEnv.storage,
      getComputedStyle: modTrapEnv.win.getComputedStyle,
      matchMedia: modTrapEnv.win.matchMedia,
      MutationObserver: modTrapEnv.win.MutationObserver,
      ResizeObserver: modTrapEnv.win.ResizeObserver,
      Event: modTrapEnv.win.Event,
      CustomEvent: modTrapEnv.win.CustomEvent,
      requestAnimationFrame: modTrapEnv.win.requestAnimationFrame,
      cancelAnimationFrame: modTrapEnv.win.cancelAnimationFrame,
      setTimeout: modTrapEnv.win.setTimeout,
      clearTimeout: modTrapEnv.win.clearTimeout,
      addEventListener: modTrapEnv.win.addEventListener,
      removeEventListener: modTrapEnv.win.removeEventListener,
      dispatchEvent: modTrapEnv.win.dispatchEvent,
      performance: modTrapEnv.win.performance,
      __agPrism: { getState: () => ({ cfg: { sidePanelVerticalTabs: 'on', language: 'en' } }) },
      Math, Date, JSON, Map, Set, WeakMap, WeakSet, Array, Object, String, Number, Boolean, Promise, RegExp,
    };
    modTrapSb.window = modTrapSb;
    modTrapSb.globalThis = modTrapSb;
    modTrapSb.self = modTrapSb;
    modTrapSb.top = modTrapSb;
    const modTrapRes = vm.runInNewContext(coldExpr, modTrapSb);
    assert.equal(modTrapRes?.ok, true, 'Compiled Ch18 IIFE must succeed when window.module={exports:{}} exists without require');
    assert.ok(modTrapSb.__agPrismSidePanelVtabs, 'Compiled Ch18 IIFE must mount __agPrismSidePanelVtabs despite browser module global');
    assert.deepEqual(Object.keys(modTrapObj.exports), [], 'Compiled Ch18 IIFE must not write into host window.module.exports');
    assert.equal(modTrapSb.__vtabsNs, undefined, 'Compiled Ch18 IIFE must not leak __vtabsNs onto window');
    assert.equal(modTrapSb.__vtabsInit, undefined, 'Compiled Ch18 IIFE must not leak __vtabsInit onto window');
    modTrapSb.__agPrismSidePanelVtabs.destroy();

    assert.equal(fs.existsSync(cachePath), true, '.bundle-cache.json must be written on cold Channel 18 build');
    const diskJson = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    assert.ok(diskJson.channels && diskJson.channels.sidePanelVtabs, 'channels.sidePanelVtabs must be persisted in .bundle-cache.json');
    assert.match(diskJson.channels.sidePanelVtabs.sourceHash, /^[0-9a-f]{64}$/);
    assert.match(diskJson.channels.sidePanelVtabs.payloadSha256, /^[0-9a-f]{64}$/);

    // Cold reload cdp.js to verify true disk-cache hit with 0 recompilation
    const cdpPath = require.resolve(path.join(ROOT, 'cdp.js'));
    delete require.cache[cdpPath];
    const freshCdp = require(cdpPath);
    freshCdp.resetBundleCacheStats();
    const hitExpr = freshCdp.buildSidePanelVerticalTabsExpression(
      { ...freshCdp.DEFAULT_CONFIG, sidePanelVerticalTabs: 'on' },
      { cachePath }
    );
    assert.equal(hitExpr, coldExpr, 'Channel 18 disk cache hit must match cold compile byte-for-byte');
    const stats = freshCdp.getBundleCacheStats();
    assert.ok(
      stats.channelHitsByName.sidePanelVtabs >= 1,
      `Expected channelHitsByName.sidePanelVtabs >= 1, got ${stats.channelHitsByName.sidePanelVtabs}`
    );
    assert.ok(stats.channelDiskHits >= 1);
    assert.equal(stats.channelCompileRuns, 0, 'Cold disk hit must skip recompiling Channel 18');
  } finally {
    cdp.resetBundleCacheStats();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // Channel 1 Law 4 hard byte budgets (< 390,000 B across auto + 9 locales) & runtime slices
  const autoExpr = cdp.buildInjectExpression({ ...cdp.DEFAULT_CONFIG, language: 'auto' }, { noDiskCache: true });
  const autoBytes = Buffer.byteLength(autoExpr, 'utf8');
  assert.ok(autoBytes < 390000, `Channel 1 (auto) must stay < 390,000 B, got ${autoBytes} B`);

  for (const lang of ['auto', ...SUPPORTED_9]) {
    const expr = cdp.buildInjectExpression({ ...cdp.DEFAULT_CONFIG, language: lang }, { noDiskCache: true });
    const bytes = Buffer.byteLength(expr, 'utf8');
    assert.ok(bytes < 390000, `Channel 1 (${lang}) must stay < 390,000 B, got ${bytes} B`);
  }

  const refreshExpr = cdp.buildConfigRefreshExpression({ palette: 'warm', lightPreset: 'alabaster', accentTone: 'cobalt' });
  const refreshBytes = Buffer.byteLength(refreshExpr, 'utf8');
  assert.ok(refreshBytes < 4096, `buildConfigRefreshExpression must stay < 4,096 B, got ${refreshBytes} B`);

  const jaSliceBytes = Buffer.byteLength(JSON.stringify(i18nLocales.getRuntimeUiSlice('ja')), 'utf8');
  assert.ok(jaSliceBytes < 4096, `getRuntimeUiSlice('ja') must stay < 4,096 B, got ${jaSliceBytes} B`);

  // Windows/macOS & Linux packaging parity (walkSubDir('vendor')) for ALL modular JS & CSS files
  const nativeEntries = collectNativePluginEntries(null);
  const linuxEntries = collectLinuxPortableEntries();
  for (const rel of [...VTABS_JS_FILES, ...VTABS_CSS_FILES]) {
    assert.ok(
      nativeEntries.some((e) => e.name === `native-plugin/${rel}` && e.data.length > 0),
      `collectNativePluginEntries must bundle native-plugin/${rel}`
    );
    assert.ok(
      linuxEntries.some((e) => e.name === `${ARCHIVE_ROOT_PREFIX}/native-plugin/${rel}` && e.data.length > 0),
      `collectLinuxPortableEntries must bundle ${rel}`
    );
  }
});

// ── 2. Settings UI (Ch9 settings-ext-beta4), Hot Toggle, Scene Preset Isolation, 9-Locale Parity & Storage Cleanup ──
test('2. Settings UI switch (settings-ext-beta4), zero-dim independence, hot toggle, scene preset isolation, 9-locale parity & reset/purge cleanup', () => {
  const env = createRichMockDom({
    lang: 'zh-CN',
    initialStorage: {
      'ag-prism:settings-open': '1',
      'ag-prism:settings-subtab': 'interaction',
      [STORAGE_COLLAPSED_KEY]: '1',
      'ag-pulse-enabled': 'keep-2',
      'ag-pulse-theme': 'keep-3',
      'ag-pulse-cache-v1': 'keep-4',
    },
  });

  // Build host Appearance settings dialog
  const dialog = env.mkEl('div', { role: 'dialog' });
  const panel = env.mkEl('div', { class: 'p-6' });
  panel.appendChild(env.mkEl('h2', { text: 'Appearance' }));
  panel.appendChild(env.mkEl('div', { class: 'space-y-2' }));
  dialog.appendChild(panel);
  env.body.appendChild(dialog);

  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const prevStorage = globalThis.localStorage;
  const prevI18nExt = globalThis.__agPrismI18nExtBeta4;
  const prevSetExt = globalThis.__agPrismSettingsExtBeta4;
  env.win.localStorage = env.storage;
  env.win.__agPrismI18nExtBeta4 = i18nExtBeta4;
  env.win.__agPrismSettingsExtBeta4 = settingsExtBeta4;
  env.doc.defaultView = env.win;
  globalThis.document = env.doc;
  globalThis.window = env.win;
  globalThis.localStorage = env.storage;
  globalThis.__agPrismI18nExtBeta4 = i18nExtBeta4;
  globalThis.__agPrismSettingsExtBeta4 = settingsExtBeta4;

  const state = { ...settingsPanel.getDefaultSettingsPatch(), sidePanelVerticalTabs: 'off' };
  const resolveLang = () => (state.language === 'auto' ? 'zh-CN' : state.language);
  const mount = () =>
    settingsPanel.mountOrSyncSettingsSection({
      version: cdp.PLUGIN_VERSION,
      lazyFold: false,
      getLang: resolveLang,
      uiText: (l) => i18nLocales.getUiStrings(l),
      isZh: () => ['zh-CN', 'zh-TW'].includes(resolveLang()),
      i18nCore,
      formatSettingsSummary: () => `${resolveLang()}:${state.palette}`,
      resolveSettingRowActiveValue: (k) => (k === 'language' ? resolveLang() : state[k]),
      isSettingButtonMatch: (_k, valJson, cur) => JSON.parse(valJson) === cur,
      saveSetting: (k, v) => { state[k] = v; },
      saveSettingsBatch: (p) => { Object.assign(state, p); },
      getThoughtTranslateMode: () => state.thoughtTranslate,
      handledGroupClicks: new WeakSet(),
      runSettingsGroupGlide: () => {},
      runGuardedMut: (fn) => fn(),
    });

  try {
    mount();
    const sec = env.doc.getElementById(settingsPanel.SETTINGS_SEC_ID);
    assert.ok(sec);

    // Mounts in interaction group right after projectPartitions (or sidebarNavFold fallback) as a sliding switch
    const interactionGrp = sec.querySelector('[data-ag-cs-group="interaction"]');
    const keys = interactionGrp.querySelectorAll('[data-ag-cs-row]').map((r) => r.getAttribute('data-ag-cs-row'));
    assert.ok(keys.includes('sidePanelVerticalTabs'));
    const anchorIdx = keys.includes('projectPartitions') ? keys.indexOf('projectPartitions') : keys.indexOf('sidebarNavFold');
    assert.equal(keys.indexOf('sidePanelVerticalTabs'), anchorIdx + 1);

    const row = sec.querySelector('[data-ag-cs-row="sidePanelVerticalTabs"]');
    const switchGrp = row.querySelector('[data-ui-kind="switch"]');
    assert.ok(switchGrp, 'sidePanelVerticalTabs must render with data-ui-kind="switch"');
    assert.ok(switchGrp.querySelector('.ag-cs-switch-thumb'), 'Switch must include sliding thumb element');
    assert.equal(switchGrp.getAttribute('data-switch-on'), '0');

    const findBtn = (k, v) => {
      const targetVal = JSON.stringify(v);
      return (
        sec.querySelectorAll(`button[data-ag-cs-key="${k}"]`).find((b) => b.getAttribute('data-ag-cs-val') === targetVal) ||
        sec.querySelectorAll(`button[data-ag-cs-ext-key="${k}"]`).find((b) => b.getAttribute('data-ag-cs-ext-val') === targetVal)
      );
    };

    // NOT dimmed when sidebarRestyle === false (left sidebar is independent)
    findBtn('sidebarRestyle', false).click();
    assert.equal(sec.querySelector('[data-ag-cs-row="sidebarCompact"]').getAttribute('data-ag-cs-dimmed'), '1');
    assert.equal(sec.querySelector('[data-ag-cs-row="sidebarNavFold"]').getAttribute('data-ag-cs-dimmed'), '1');
    assert.equal(row.getAttribute('data-ag-cs-dimmed'), null, 'sidePanelVerticalTabs must NEVER dim when sidebarRestyle=false');
    assert.equal(row.style.opacity, '');
    findBtn('sidebarRestyle', true).click();

    // Preset isolation in BOTH 'on' and 'off' states + active preset pill stability
    const clickPreset = (pid) => sec.querySelector(`button[data-ag-cs-preset="${pid}"]`).click();
    const isPresetActive = (pid) => sec.querySelector(`button[data-ag-cs-preset="${pid}"]`).getAttribute('data-active') === '1';

    // Case A: sidePanelVerticalTabs === 'on'
    findBtn('sidePanelVerticalTabs', 'on').click();
    assert.equal(state.sidePanelVerticalTabs, 'on');
    assert.equal(switchGrp.getAttribute('data-switch-on'), '1');
    for (const pid of ['ultra', 'focus', 'eco', 'ultra']) {
      clickPreset(pid);
      assert.equal(state.sidePanelVerticalTabs, 'on', `Preset ${pid} must not mutate sidePanelVerticalTabs='on'`);
      assert.equal(isPresetActive(pid), true, `Preset ${pid} pill must highlight active`);
    }

    // Toggling sidePanelVerticalTabs must NOT break active preset pill highlighting
    findBtn('sidePanelVerticalTabs', 'off').click();
    assert.equal(state.sidePanelVerticalTabs, 'off');
    assert.equal(isPresetActive('ultra'), true, 'Toggling sidePanelVerticalTabs must keep ultra preset pill active');

    // Case B: sidePanelVerticalTabs === 'off'
    for (const pid of ['focus', 'eco', 'ultra']) {
      clickPreset(pid);
      assert.equal(state.sidePanelVerticalTabs, 'off', `Preset ${pid} must not mutate sidePanelVerticalTabs='off'`);
      assert.equal(isPresetActive(pid), true);
    }

    // 9-locale parity (incl. Turkish tr) in i18n-ext-beta4.js & 0 Han/CJK leaks & absent from RUNTIME_UI_KEYS
    const runtimeSet = new Set(i18nLocales.RUNTIME_UI_KEYS);
    const vtabsKeys = [
      'setSidePanelVerticalTabsTitle',
      'setSidePanelVerticalTabsDesc',
      'sidePanelVtabsCollapse',
      'sidePanelVtabsExpand',
    ];
    for (const k of vtabsKeys) {
      assert.equal(runtimeSet.has(k), false, `${k} must NOT be in RUNTIME_UI_KEYS`);
      assert.equal(i18nExtBeta4.TABLE[k].length, 9, `i18n-ext-beta4.${k} must have exactly 9 locales`);
    }
    for (const lang of SUPPORTED_9) {
      const ui = i18nExtBeta4.getStrings(lang);
      for (const k of vtabsKeys) {
        assert.ok(typeof ui[k] === 'string' && ui[k].trim().length > 0, `Missing ${k} for ${lang}`);
        if (NON_CJK_6.includes(lang)) {
          assert.equal(HAN_RE.test(ui[k]), false, `Han leak in ${lang}.${k}: ${ui[k]}`);
        }
        if (LATIN_5.includes(lang)) {
          assert.equal(CJK_RE.test(ui[k]), false, `CJK leak in ${lang}.${k}: ${ui[k]}`);
        }
      }
    }
    assert.equal(i18nExtBeta4.getStrings('zh-CN').setSidePanelVerticalTabsDesc.includes('右侧侧面板'), false, 'zh-CN desc must not stutter 右侧侧面板');
    assert.equal(i18nExtBeta4.getStrings('zh-TW').setSidePanelVerticalTabsDesc.includes('右側側面板'), false, 'zh-TW desc must not stutter 右側側面板');

    // Reset Defaults clears BOTH ag-prism:side-panel-vtabs-collapsed & ag-prism:side-panel-vtabs-width WITHOUT wiping settings-open/settings-subtab
    state.sidePanelVerticalTabs = 'on';
    env.storage.setItem(STORAGE_COLLAPSED_KEY, '1');
    env.storage.setItem(STORAGE_WIDTH_KEY, '260');
    sec.querySelector('button[data-ag-cs-cfg-action="reset"]').click();
    assert.equal(state.sidePanelVerticalTabs, 'off');
    assert.equal(env.storage.getItem(STORAGE_COLLAPSED_KEY), null, 'resetBtn must clear ag-prism:side-panel-vtabs-collapsed');
    assert.equal(env.storage.getItem(STORAGE_WIDTH_KEY), null, 'resetBtn must clear ag-prism:side-panel-vtabs-width');
    assert.equal(env.storage.getItem('ag-prism:settings-open'), '1', 'resetBtn must preserve ag-prism:settings-open');
    assert.equal(env.storage.getItem('ag-prism:settings-subtab'), 'interaction', 'resetBtn must preserve ag-prism:settings-subtab');

    // Purge uninstall (clearPrismLocalStorage) removes both keys while preserving external Pulse keys
    env.storage.setItem(STORAGE_COLLAPSED_KEY, '1');
    env.storage.setItem(STORAGE_WIDTH_KEY, '260');
    settingsPanel.clearPrismLocalStorage(env.storage);
    assert.equal(env.storage.getItem(STORAGE_COLLAPSED_KEY), null, 'clearPrismLocalStorage must purge collapsed key');
    assert.equal(env.storage.getItem(STORAGE_WIDTH_KEY), null, 'clearPrismLocalStorage must purge width key');
    for (const upKey of PROTECTED_UPSTREAM_KEYS) {
      assert.ok(env.storage.getItem(upKey), `clearPrismLocalStorage must preserve protected upstream key ${upKey}`);
    }
  } finally {
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
    if (prevStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevStorage;
    if (prevI18nExt === undefined) delete globalThis.__agPrismI18nExtBeta4;
    else globalThis.__agPrismI18nExtBeta4 = prevI18nExt;
    if (prevSetExt === undefined) delete globalThis.__agPrismSettingsExtBeta4;
    else globalThis.__agPrismSettingsExtBeta4 = prevSetExt;
  }

  // Live hot-toggle via compiled Channel 1 ui-runtime: updates <html data-ag-cs-side-panel-vertical-tabs> without restart
  const rtEnv = createRichMockDom({ lang: 'zh-CN' });
  rtEnv.html.removeAttribute('data-ag-cs-style');
  rtEnv.html.removeAttribute('data-ag-cs-side-panel-vertical-tabs');
  const bindingCalls = [];
  const sandbox = {
    window: null,
    globalThis: null,
    document: rtEnv.doc,
    navigator: rtEnv.win.navigator,
    location: rtEnv.win.location,
    localStorage: rtEnv.storage,
    getComputedStyle: rtEnv.win.getComputedStyle,
    matchMedia: () => ({ matches: false }),
    MutationObserver: rtEnv.win.MutationObserver,
    ResizeObserver: rtEnv.win.ResizeObserver,
    Event: rtEnv.win.Event,
    requestAnimationFrame: rtEnv.win.requestAnimationFrame,
    cancelAnimationFrame: rtEnv.win.cancelAnimationFrame,
    setTimeout: rtEnv.win.setTimeout,
    clearTimeout: rtEnv.win.clearTimeout,
    setInterval: () => 1,
    clearInterval: () => {},
    addEventListener: rtEnv.win.addEventListener,
    removeEventListener: rtEnv.win.removeEventListener,
    performance: rtEnv.win.performance,
    [cdp.SETTING_BINDING]: (payload) => { try { bindingCalls.push(JSON.parse(payload)); } catch {} },
    Math, Date, JSON, Map, Set, WeakMap, WeakSet, Array, Object, String, Number, Boolean, Promise, Uint8Array, Float32Array, Intl, RegExp,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.top = sandbox;

  const bootRes = vm.runInNewContext(cdp.buildInjectExpression(cdp.DEFAULT_CONFIG), sandbox);
  assert.equal(bootRes.status, 'ok');
  assert.equal(rtEnv.html.getAttribute('data-ag-cs-side-panel-vertical-tabs'), 'off');

  sandbox.window.__agPrism.saveSettingsBatch({ sidePanelVerticalTabs: 'on' });
  rtEnv.flushRaf();
  assert.equal(rtEnv.html.getAttribute('data-ag-cs-side-panel-vertical-tabs'), 'on', 'Hot toggle to on must update <html> attr without restart');
  assert.ok(
    bindingCalls.some((c) => c.action === 'request-side-panel-vtabs'),
    'Enabling sidePanelVerticalTabs when Channel 18 is not loaded must request Channel 18 over __agPrismSetting'
  );

  sandbox.window.__agPrism.saveSettingsBatch({ sidePanelVerticalTabs: 'off' });
  rtEnv.flushRaf();
  assert.equal(rtEnv.html.getAttribute('data-ag-cs-side-panel-vertical-tabs'), 'off', 'Hot toggle back to off must update <html> attr without restart');

  vm.runInNewContext(cdp.REMOVE_EXPRESSION, sandbox);
  assert.equal(rtEnv.html.hasAttribute('data-ag-cs-side-panel-vertical-tabs'), false);
});

// ── 3. Multi-/btw (>= 10 Tabs), Native Click/Close Forwarding & Hover Tooltips (Nested + Flat Topologies) ──
test('3. Multi-/btw (>= 10 tabs), native click/close forwarding & hover tooltips across both nested and flat strip topologies', () => {
  const vtabsMod = loadVerticalTabsModule();
  const cssText = readVerticalTabsCss();

  for (const topology of ['nested', 'flat']) {
    const env = createRichMockDom({ lang: 'en' });
    const fx = buildRightSidePanelFixture(env, { topology, hostWidth: 560 });

    const ctl = vtabsMod.createSidePanelVerticalTabsController({
      win: env.win,
      doc: env.doc,
      storage: env.storage,
      cssText,
      getLang: () => 'en',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
    });
    ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
    env.flushRaf();

    const st = ctl.getState();
    assert.equal(st.active, true, `[${topology}] controller must be active`);
    assert.equal(st.mounted, true, `[${topology}] controller must be mounted`);
    assert.equal(st.tabCount, 10, `[${topology}] must detect all 10 tabs`);

    assert.equal(fx.host.getAttribute('data-ag-vtabs-host'), '1', `[${topology}] host must be marked`);
    assert.equal(fx.strip.getAttribute('data-ag-vtabs-strip'), '1', `[${topology}] strip must be marked`);
    assert.equal(fx.panelBody.getAttribute('data-ag-vtabs-body'), '1', `[${topology}] body must be marked`);

    if (topology === 'nested') {
      assert.equal(fx.tabList.getAttribute('data-ag-vtabs-list'), '1', '[nested] inner tablist must carry data-ag-vtabs-list="1"');
      assert.equal(fx.toolbar.getAttribute('data-ag-vtabs-actions'), '1', '[nested] sibling toolbar must carry data-ag-vtabs-actions="1"');
      assert.equal(fx.strip.hasAttribute('data-ag-vtabs-flat'), false, '[nested] strip must not carry data-ag-vtabs-flat');
    } else {
      assert.equal(fx.strip.getAttribute('data-ag-vtabs-flat'), '1', '[flat] direct-child strip must carry data-ag-vtabs-flat="1"');
    }

    // Every tab, label, close trigger & iconless tab is marked cleanly
    for (const entry of fx.tabEntries) {
      assert.equal(entry.tab.getAttribute('data-ag-vtabs-tab'), '1');
      assert.equal(entry.label.getAttribute('data-ag-vtabs-label'), '1');
      assert.equal(entry.closeBtn.getAttribute('data-ag-vtabs-close'), '1');
    }
    const noIconEntry = fx.tabEntries.find((e) => e.spec.id === 'note-1');
    assert.equal(noIconEntry.tab.getAttribute('data-ag-vtabs-no-icon'), '1', `[${topology}] iconless tab must carry data-ag-vtabs-no-icon="1"`);

    // Hover tooltips: reflect readable title, NEVER clobber pre-existing native title
    const btw2 = fx.tabEntries.find((e) => e.spec.id === 'btw-2');
    assert.equal(btw2.tab.getAttribute('title'), '/btw Compare flex row vs grid for WebContentsView hole');
    assert.equal(btw2.tab.getAttribute('data-ag-vtabs-title'), '1');

    const artifactEntry = fx.tabEntries.find((e) => e.spec.id === 'art-1');
    assert.equal(artifactEntry.tab.getAttribute('title'), 'Native Host Artifact Tooltip', `[${topology}] must NEVER overwrite pre-existing native title`);
    assert.equal(artifactEntry.tab.hasAttribute('data-ag-vtabs-title'), false, `[${topology}] must NOT stamp data-ag-vtabs-title on host-owned title`);

    // Clicking a tab forwards 100% unmodified to real native tab listener & syncs active state
    const diffEntry = fx.tabEntries.find((e) => e.spec.id === 'diff-1');
    diffEntry.tab.click();
    env.deliverMutations();
    assert.equal(fx.selectedLog.length, 1, `[${topology}] native tab click listener must fire`);
    assert.equal(fx.selectedLog[0].id, 'diff-1');
    assert.equal(fx.selectedLog[0].defaultPrevented, false, `[${topology}] tab click must NOT be prevented`);
    assert.equal(diffEntry.tab.getAttribute('aria-selected'), 'true');
    assert.equal(fx.tabEntries[0].tab.getAttribute('aria-selected'), 'false');

    // Clicking close x triggers real native close listener unmodified & does not accidentally select closed tab
    const btw3 = fx.tabEntries.find((e) => e.spec.id === 'btw-3');
    btw3.closeBtn.click();
    env.deliverMutations();
    assert.equal(fx.closedLog.length, 1, `[${topology}] native close button click listener must fire`);
    assert.equal(fx.closedLog[0].id, 'btw-3');
    assert.equal(fx.closedLog[0].defaultPrevented, false);
    assert.equal(fx.selectedLog.length, 1, `[${topology}] close click must not trigger tab select`);
    assert.equal(ctl.getState().tabCount, 9, `[${topology}] tabCount must sync to 9 after close`);

    // On destroy(), Prism-stamped titles are removed while host-owned native titles are preserved
    ctl.destroy();
    assert.equal(btw2.tab.getAttribute('title'), null, `[${topology}] destroy() must remove Prism-stamped title`);
    assert.equal(btw2.tab.hasAttribute('data-ag-vtabs-title'), false);
    assert.equal(artifactEntry.tab.getAttribute('title'), 'Native Host Artifact Tooltip', `[${topology}] destroy() must preserve pre-existing native title`);
  }
});

// ── 4. Expand/Collapse Toggle, Persistence, Cross-Window Storage Sync & 5+1 Anti-Translation ──
test('4. Expand/collapse toggle, persistence across reload, cross-window storage sync & 5+1 anti-translation hygiene', () => {
  const vtabsMod = loadVerticalTabsModule();
  const cssText = readVerticalTabsCss();

  assert.equal(vtabsMod.STORAGE_COLLAPSED_KEY, STORAGE_COLLAPSED_KEY);
  assert.equal(vtabsMod.STYLE_ID, STYLE_ID);
  assert.equal(vtabsMod.EXPANDED_WIDTH_PX, 180);
  assert.equal(vtabsMod.COLLAPSED_WIDTH_PX, 42);
  assert.equal(vtabsMod.NARROW_WIDTH_PX, 420);

  // VTABS_I18N covers all 9 locales (incl. Turkish tr) verbatim with i18n-ext-beta4.js and 0 Han/CJK leaks
  for (const lang of SUPPORTED_9) {
    const entry = vtabsMod.VTABS_I18N[lang];
    const ui = i18nExtBeta4.getStrings(lang);
    assert.ok(entry && typeof entry.collapse === 'string' && entry.collapse.trim().length > 0, `VTABS_I18N.${lang}.collapse missing`);
    assert.ok(entry && typeof entry.expand === 'string' && entry.expand.trim().length > 0, `VTABS_I18N.${lang}.expand missing`);
    assert.equal(entry.collapse, ui.sidePanelVtabsCollapse, `VTABS_I18N.${lang}.collapse must match i18n-ext-beta4.js verbatim`);
    assert.equal(entry.expand, ui.sidePanelVtabsExpand, `VTABS_I18N.${lang}.expand must match i18n-ext-beta4.js verbatim`);
    if (NON_CJK_6.includes(lang)) {
      assert.equal(HAN_RE.test(entry.collapse), false, `Han leak in VTABS_I18N.${lang}.collapse`);
      assert.equal(HAN_RE.test(entry.expand), false, `Han leak in VTABS_I18N.${lang}.expand`);
    }
    if (LATIN_5.includes(lang)) {
      assert.equal(CJK_RE.test(entry.collapse), false, `CJK leak in VTABS_I18N.${lang}.collapse`);
      assert.equal(CJK_RE.test(entry.expand), false, `CJK leak in VTABS_I18N.${lang}.expand`);
    }
  }
  if (typeof vtabsMod.normalizeLang === 'function') {
    assert.equal(vtabsMod.normalizeLang('tr-TR'), 'tr');
    assert.equal(vtabsMod.normalizeLang('yue'), 'zh-CN');
  }

  const env = createRichMockDom({ lang: 'zh-CN' });
  const fx = buildRightSidePanelFixture(env, { topology: 'nested', hostWidth: 640 });
  let curLang = 'zh-CN';

  const makeCtl = () =>
    vtabsMod.createSidePanelVerticalTabsController({
      win: env.win,
      doc: env.doc,
      storage: env.storage,
      cssText,
      getLang: () => curLang,
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: curLang }),
    });

  let ctl = makeCtl();
  ctl.sync({ sidePanelVerticalTabs: 'on', language: curLang });
  env.flushRaf();

  const styleEl = env.doc.getElementById(STYLE_ID);
  const headEl = fx.strip.querySelector('.ag-cs-vtabs-head');
  const toggleBtn = fx.strip.querySelector('.ag-cs-vtabs-toggle');

  // Plugin-injected nodes carry data-ag-owned="1" + all 5+1 anti-translation attributes
  assertOwnedAndNoTranslate(styleEl, `#${STYLE_ID}`);
  assertOwnedAndNoTranslate(headEl, '.ag-cs-vtabs-head');
  assertOwnedAndNoTranslate(toggleBtn, '.ag-cs-vtabs-toggle');
  assert.equal(toggleBtn.getAttribute('data-no-press-spring'), '1');
  assert.equal(toggleBtn.getAttribute('type'), 'button');
  assert.equal(toggleBtn.getAttribute('aria-expanded'), 'true');

  // Host elements MUST carry ZERO anti-translation attributes and ZERO data-ag-owned
  assertNoHostTranslationContamination([
    fx.host,
    fx.strip,
    fx.panelBody,
    fx.tabList,
    fx.toolbar,
    ...fx.tabEntries.map((e) => e.tab),
    ...fx.tabEntries.map((e) => e.label),
    ...fx.tabEntries.map((e) => e.closeBtn),
  ]);

  // Initial expanded state (180px)
  assert.equal(fx.host.hasAttribute('data-ag-vtabs-collapsed'), false);
  assert.equal(fx.strip.hasAttribute('data-ag-vtabs-collapsed'), false);
  assert.equal(ctl.getState().collapsed, false);
  assert.equal(ctl.getState().userCollapsed, false);

  // Click toggle -> collapses (42px), persists '1', prevents bubbling to host strip
  let stripClicked = false;
  fx.strip.addEventListener('click', () => { stripClicked = true; });
  const clickEv = toggleBtn.click();
  assert.equal(clickEv.defaultPrevented, true, 'Toggle click must call preventDefault()');
  assert.equal(stripClicked, false, 'Toggle click must call stopPropagation()');
  assert.equal(fx.host.getAttribute('data-ag-vtabs-collapsed'), '1');
  assert.equal(fx.strip.getAttribute('data-ag-vtabs-collapsed'), '1');
  assert.equal(toggleBtn.getAttribute('aria-expanded'), 'false');
  assert.equal(env.storage.getItem(STORAGE_COLLAPSED_KEY), '1');
  assert.equal(ctl.getState().collapsed, true);
  assert.equal(ctl.getState().userCollapsed, true);

  // Click toggle again -> expands, persists '0'
  toggleBtn.click();
  assert.equal(fx.host.hasAttribute('data-ag-vtabs-collapsed'), false);
  assert.equal(fx.strip.hasAttribute('data-ag-vtabs-collapsed'), false);
  assert.equal(toggleBtn.getAttribute('aria-expanded'), 'true');
  assert.equal(env.storage.getItem(STORAGE_COLLAPSED_KEY), '0');
  assert.equal(ctl.getState().collapsed, false);

  // Collapse again ('1'), destroy & recreate fresh controller (simulating reload/restart)
  toggleBtn.click();
  assert.equal(env.storage.getItem(STORAGE_COLLAPSED_KEY), '1');
  ctl.destroy();

  ctl = makeCtl();
  ctl.sync({ sidePanelVerticalTabs: 'on', language: curLang });
  env.flushRaf();
  assert.equal(fx.host.getAttribute('data-ag-vtabs-collapsed'), '1', 'Collapsed state must persist across controller reload');
  assert.equal(fx.strip.getAttribute('data-ag-vtabs-collapsed'), '1');
  assert.equal(ctl.getState().collapsed, true);
  assert.equal(ctl.getState().userCollapsed, true);
  const toggleAfterReload = fx.strip.querySelector('.ag-cs-vtabs-toggle');
  assert.equal(toggleAfterReload.getAttribute('aria-expanded'), 'false');

  // Cross-window storage event sync: another window expands ('0')
  env.storage.setItem(STORAGE_COLLAPSED_KEY, '0');
  env.win.dispatchEvent(new env.MockEvent('storage', {
    key: STORAGE_COLLAPSED_KEY,
    oldValue: '1',
    newValue: '0',
    storageArea: env.storage,
  }));
  env.flushRaf();
  assert.equal(fx.host.hasAttribute('data-ag-vtabs-collapsed'), false, 'storage event newValue="0" must expand');
  assert.equal(fx.strip.hasAttribute('data-ag-vtabs-collapsed'), false);
  assert.equal(ctl.getState().collapsed, false);
  assert.equal(ctl.getState().userCollapsed, false);

  // Cross-window storage event sync: another window collapses ('1')
  env.storage.setItem(STORAGE_COLLAPSED_KEY, '1');
  env.win.dispatchEvent(new env.MockEvent('storage', {
    key: STORAGE_COLLAPSED_KEY,
    oldValue: '0',
    newValue: '1',
    storageArea: env.storage,
  }));
  env.flushRaf();
  assert.equal(fx.host.getAttribute('data-ag-vtabs-collapsed'), '1', 'storage event newValue="1" must collapse');
  assert.equal(fx.strip.getAttribute('data-ag-vtabs-collapsed'), '1');
  assert.equal(ctl.getState().collapsed, true);

  // Language switch updates toggle aria-label/title (and honors Channel 9 __agPrismI18nExtBeta4 across ja & tr)
  env.win.__agPrismI18nExtBeta4 = i18nExtBeta4;
  for (const nextLang of ['ja', 'tr']) {
    curLang = nextLang;
    env.html.setAttribute('data-ag-cs-lang', nextLang);
    ctl.sync({ sidePanelVerticalTabs: 'on', language: nextLang });
    env.flushRaf();
    assert.equal(toggleAfterReload.getAttribute('aria-label'), i18nExtBeta4.getStrings(nextLang).sidePanelVtabsExpand);
  }

  ctl.destroy();
});

// ── 5. Multi-Pane Split-View Focus Switching (>= 2 [data-tiling-pane]) & Single-Tab Steady State ──
test('5. Multi-pane split-view focus switching (9 tabs -> 1 tab) keeps vertical steady state across both in-place swap and full remount', () => {
  const vtabsMod = loadVerticalTabsModule();
  const cssText = readVerticalTabsCss();
  const env = createRichMockDom({ lang: 'en' });

  const nineTabs = Array.from({ length: 9 }, (_, i) => ({
    id: `pane1-tab-${i + 1}`,
    label: i < 5 ? `/btw Thread #${i + 1} on Pane 1` : `Artifact #${i + 1}`,
    active: i === 0,
  }));
  const fx = buildRightSidePanelFixture(env, { topology: 'nested', tabs: nineTabs, hostWidth: 560 });

  const ctl = vtabsMod.createSidePanelVerticalTabsController({
    win: env.win,
    doc: env.doc,
    storage: env.storage,
    cssText,
    getLang: () => 'en',
    getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
  });
  ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
  env.flushRaf();

  assert.equal(env.doc.querySelectorAll('[data-tiling-pane]').length, 2, 'Fixture must contain 2 split panes');
  assert.equal(ctl.getState().mounted, true);
  assert.equal(ctl.getState().tabCount, 9);
  assert.equal(fx.host.getAttribute('data-ag-vtabs-host'), '1');
  assert.equal(fx.strip.getAttribute('data-ag-vtabs-strip'), '1');

  // Scenario A: Focus switches to Pane 2; React swaps 9 tabs in-place to 1 single tab
  fx.pane2.dispatchEvent(new env.MockEvent('pointerdown', { bubbles: true }));
  fx.pane2.dispatchEvent(new env.MockEvent('focusin', { bubbles: true }));
  fx.tabList.replaceChildren();
  const singleSwap = fx.mountTabs([{ id: 'pane2-only', label: '/btw Single tab on Pane 2', active: true }], fx.tabList);
  env.deliverMutations();

  assert.equal(ctl.getState().mounted, true, 'Single-tab pane must stay mounted in vertical mode');
  assert.equal(ctl.getState().tabCount, 1);
  assert.equal(fx.host.getAttribute('data-ag-vtabs-host'), '1', 'Host must stay vertical with 1 tab (0 horizontal jump)');
  assert.equal(fx.strip.getAttribute('data-ag-vtabs-strip'), '1', 'Strip must stay vertical with 1 tab (0 horizontal jump)');
  assert.equal(fx.panelBody.getAttribute('data-ag-vtabs-body'), '1');
  assert.equal(singleSwap[0].tab.getAttribute('data-ag-vtabs-tab'), '1');
  assert.equal(singleSwap[0].tab.getAttribute('title'), '/btw Single tab on Pane 2');
  assert.equal(fx.strip.querySelectorAll('.ag-cs-vtabs-toggle').length, 1, 'Must never duplicate toggle button');

  // Scenario B: Focus switches back to Pane 1; React unmounts entire old strip+body and mounts brand-new single-tab side panel
  fx.pane1.dispatchEvent(new env.MockEvent('pointerdown', { bubbles: true }));
  fx.host.remove();

  const newHost = env.mkEl(
    'div',
    { class: 'agy-inset-shell', 'data-side-panel-focus-scope': 'true' },
    { left: 880, top: 0, width: 560, height: 720, right: 1440, bottom: 720 }
  );
  const newStrip = env.mkEl('div', { 'data-side-panel-strip': '' });
  const newList = env.mkEl('div', { role: 'tablist' });
  const newBody = env.mkEl('div', { 'data-side-panel-body': '' });
  const remountedTab = createNativeTab(env, { id: 'remount-1', label: 'Remounted Single Artifact', active: true }, {});
  newList.appendChild(remountedTab.tab);
  newStrip.appendChild(newList);
  newHost.appendChild(newStrip);
  newHost.appendChild(newBody);
  fx.rightSlot.appendChild(newHost);
  env.deliverMutations();

  assert.equal(ctl.getState().mounted, true, 'Remounted single-tab side panel must re-engage vertical mode');
  assert.equal(ctl.getState().tabCount, 1);
  assert.equal(newHost.getAttribute('data-ag-vtabs-host'), '1');
  assert.equal(newStrip.getAttribute('data-ag-vtabs-strip'), '1');
  assert.equal(newBody.getAttribute('data-ag-vtabs-body'), '1');
  assert.equal(newStrip.querySelectorAll('.ag-cs-vtabs-toggle').length, 1);
  assert.equal(remountedTab.tab.getAttribute('data-ag-vtabs-tab'), '1');
  assert.equal(remountedTab.tab.getAttribute('title'), 'Remounted Single Artifact');

  // New toggle button works interactively
  newStrip.querySelector('.ag-cs-vtabs-toggle').click();
  assert.equal(newHost.getAttribute('data-ag-vtabs-collapsed'), '1');
  assert.equal(env.storage.getItem(STORAGE_COLLAPSED_KEY), '1');

  ctl.destroy();
});

// ── 6. Narrow Width < 420px Auto-Collapse & Restore + ZERO Reflow Inside ResizeObserver ──
test('6. Narrow width < 420px auto-collapse, exact 420px restore, persisted-collapse respect & ZERO reflow inside ResizeObserver', () => {
  const vtabsMod = loadVerticalTabsModule();
  const cssText = readVerticalTabsCss();
  const env = createRichMockDom({
    lang: 'en',
    initialStorage: { [STORAGE_COLLAPSED_KEY]: '0' },
  });
  const fx = buildRightSidePanelFixture(env, { topology: 'nested', hostWidth: 520 });

  const ctl = vtabsMod.createSidePanelVerticalTabsController({
    win: env.win,
    doc: env.doc,
    storage: env.storage,
    cssText,
    getLang: () => 'en',
    getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
  });
  ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
  env.flushRaf();

  assert.equal(ctl.getState().collapsed, false);
  assert.equal(ctl.getState().autoCollapsed, false);
  const toggleBtn = fx.strip.querySelector('.ag-cs-vtabs-toggle');
  assert.ok(toggleBtn);

  // Verify ResizeObserver is observing host
  assert.ok(env.activeROs.size >= 1, 'Controller must attach ResizeObserver to right panel host');

  // Width = 419 (< 420) -> auto-collapse with ZERO synchronous getBoundingClientRect() inside RO
  env.resetRectReads();
  env.triggerResize(fx.host, 419);
  assert.equal(fx.host._rectReads, 0, 'RO callback must perform 0 getBoundingClientRect() reads on host');
  assert.equal(fx.strip._rectReads, 0, 'RO callback must perform 0 getBoundingClientRect() reads on strip');
  assert.equal(env.totalRectReads, 0, 'RO callback must perform ZERO sync layout reflow reads across entire DOM');

  assert.equal(fx.host.getAttribute('data-ag-vtabs-collapsed'), '1');
  assert.equal(fx.strip.getAttribute('data-ag-vtabs-collapsed'), '1');
  assert.equal(fx.host.getAttribute('data-ag-vtabs-auto-collapsed'), '1');
  assert.equal(fx.strip.getAttribute('data-ag-vtabs-auto-collapsed'), '1');
  assert.equal(toggleBtn.getAttribute('aria-disabled'), 'true', 'Toggle must set aria-disabled="true" while auto-collapsed');
  assert.equal(ctl.getState().autoCollapsed, true);
  assert.equal(ctl.getState().collapsed, true);
  assert.equal(ctl.getState().userCollapsed, false);

  // Clicking toggle or calling toggleCollapsed() while auto-collapsed MUST NOT mutate localStorage
  toggleBtn.click();
  ctl.toggleCollapsed();
  assert.equal(env.storage.getItem(STORAGE_COLLAPSED_KEY), '0', 'Clicking toggle during narrow auto-collapse must NOT overwrite localStorage');
  assert.equal(fx.host.getAttribute('data-ag-vtabs-collapsed'), '1');
  assert.equal(fx.host.getAttribute('data-ag-vtabs-auto-collapsed'), '1');

  // Width = 420 (>= 420) -> clears auto-collapsed & restores persisted expanded state, with ZERO rect reads
  env.resetRectReads();
  env.triggerResize(fx.host, 420);
  assert.equal(env.totalRectReads, 0, 'Expanding RO callback must perform ZERO sync layout reflow reads');
  assert.equal(fx.host.hasAttribute('data-ag-vtabs-auto-collapsed'), false);
  assert.equal(fx.strip.hasAttribute('data-ag-vtabs-auto-collapsed'), false);
  assert.equal(fx.host.hasAttribute('data-ag-vtabs-collapsed'), false, 'Restoring to 420px must re-expand when user preference was expanded');
  assert.equal(fx.strip.hasAttribute('data-ag-vtabs-collapsed'), false);
  assert.notEqual(toggleBtn.getAttribute('aria-disabled'), 'true');
  assert.equal(ctl.getState().autoCollapsed, false);
  assert.equal(ctl.getState().collapsed, false);

  // Width = 0 (hidden/transient frame) must NOT spuriously trigger narrow auto-collapse when expanded
  env.resetRectReads();
  env.triggerResize(fx.host, 0);
  assert.equal(env.totalRectReads, 0);
  assert.equal(fx.host.hasAttribute('data-ag-vtabs-auto-collapsed'), false, 'width=0 must not falsely trigger auto-collapse');

  // ISSUE-6: Narrow 360 -> transient 0 -> 360 -> 420 must PRESERVE autoCollapsed during 0px frame
  env.resetRectReads();
  env.triggerResize(fx.host, 360);
  assert.equal(env.totalRectReads, 0);
  assert.equal(ctl.getState().autoCollapsed, true);
  assert.equal(ctl.getState().collapsed, true);
  assert.equal(fx.host.getAttribute('data-ag-vtabs-auto-collapsed'), '1');

  env.resetRectReads();
  env.triggerResize(fx.host, 0);
  assert.equal(env.totalRectReads, 0);
  assert.equal(ctl.getState().autoCollapsed, true, 'Transient 0px RO frame while narrow must NOT clear autoCollapsed');
  assert.equal(ctl.getState().collapsed, true, 'Transient 0px RO frame while narrow must stay collapsed');
  assert.equal(fx.host.getAttribute('data-ag-vtabs-auto-collapsed'), '1');
  assert.equal(fx.host.getAttribute('data-ag-vtabs-collapsed'), '1');

  env.resetRectReads();
  env.triggerResize(fx.host, 360);
  assert.equal(env.totalRectReads, 0);
  assert.equal(ctl.getState().autoCollapsed, true);

  env.resetRectReads();
  env.triggerResize(fx.host, 420);
  assert.equal(env.totalRectReads, 0);
  assert.equal(ctl.getState().autoCollapsed, false, 'Widening 360 -> 0 -> 360 -> 420 must restore expanded state');
  assert.equal(ctl.getState().collapsed, false);
  assert.equal(fx.host.hasAttribute('data-ag-vtabs-auto-collapsed'), false);
  assert.equal(fx.host.hasAttribute('data-ag-vtabs-collapsed'), false);

  // User explicitly persists collapsed ('1') -> resize < 420 then >= 420 MUST STAY COLLAPSED!
  toggleBtn.click();
  assert.equal(env.storage.getItem(STORAGE_COLLAPSED_KEY), '1');
  assert.equal(ctl.getState().userCollapsed, true);
  assert.equal(fx.host.getAttribute('data-ag-vtabs-collapsed'), '1');

  env.resetRectReads();
  env.triggerResize(fx.host, 360);
  assert.equal(env.totalRectReads, 0);
  assert.equal(fx.host.getAttribute('data-ag-vtabs-auto-collapsed'), '1');
  assert.equal(fx.host.getAttribute('data-ag-vtabs-collapsed'), '1');

  env.resetRectReads();
  env.triggerResize(fx.host, 560);
  assert.equal(env.totalRectReads, 0);
  assert.equal(fx.host.hasAttribute('data-ag-vtabs-auto-collapsed'), false, 'auto-collapsed marker must clear at 560px');
  assert.equal(fx.host.getAttribute('data-ag-vtabs-collapsed'), '1', 'Persisted user collapse must stay collapsed after widening back >= 420px');
  assert.equal(fx.strip.getAttribute('data-ag-vtabs-collapsed'), '1');
  assert.equal(ctl.getState().collapsed, true);
  assert.equal(ctl.getState().userCollapsed, true);
  assert.equal(env.storage.getItem(STORAGE_COLLAPSED_KEY), '1');

  ctl.destroy();
});

// ── 7. Browser Hole ([data-has-browser-hole="true"]) Safety & CSS Static Hygiene ──
test('7. Browser hole ([data-has-browser-hole="true"]) passive resize dispatch & strict CSS/JS hygiene gates', () => {
  const vtabsMod = loadVerticalTabsModule();

  // Part A: Static CSS & JS hygiene gates across ALL modular files (Law 2 <= 800 L / <= 40,960 B)
  for (const rel of VTABS_CSS_FILES) {
    const cssBuf = fs.readFileSync(path.join(ROOT, rel));
    const cssPart = cssBuf.toString('utf8');
    assert.equal(cssBuf[0] === 0xef && cssBuf[1] === 0xbb && cssBuf[2] === 0xbf, false, `${rel} must have 0 BOM`);
    assert.equal(cssPart.includes('\r'), false, `${rel} must use pure LF (0 CRLF)`);
    assert.equal(/[^\x00-\x7f]/.test(cssPart), false, `${rel} must be 100% pure ASCII`);
    assert.equal(/:has\(/.test(cssPart), false, `${rel} must contain 0 :has()`);
    assert.equal(/scrollbar-width\s*:\s*thin/i.test(cssPart), false, `${rel} must contain 0 scrollbar-width:thin`);
    assert.equal(/blur\(\s*(?:20|24)px\s*\)/i.test(cssPart), false, `${rel} must contain 0 blur(20px)/blur(24px)`);
    assert.equal(checkBalancedBraces(cssPart), true, `${rel} braces must be balanced`);
  }
  const css = readVerticalTabsCss();

  const rules = parseFlatCssRules(css);
  assert.ok(rules.length >= 10, 'Modular vertical-tabs CSS must define structured vertical rail rules');

  let foundRailBgRule = false;
  let foundHoleNoTransition = false;
  let foundResizingNoTransition = false;
  let foundMotionOffNoTransition = false;
  let foundWinBlurPerfNoTransition = false;
  let foundUnscopedWinBlurNoTransition = false;
  let foundReducedMotionRule = false;
  let foundReducedMotionIgnoreGuard = false;

  for (const rule of rules) {
    // Flat standard CSS only: 0 `&` nesting
    assert.equal(rule.prelude.includes('&'), false, `Flat CSS only (0 '&' nesting allowed), found in: ${rule.prelude}`);

    const hasPaintProp = /(?:^|;|\s)(?:background(?:-color|-image)?|backdrop-filter)\s*:/i.test(rule.body);
    const hasTransitionNone = /(?:^|;|\s)transition\s*:\s*none\b/i.test(rule.body);

    for (const sel of rule.selectors) {
      // Every rule must be gated by html[data-ag-cs-style][data-ag-cs-side-panel-vertical-tabs="on"]
      assert.ok(
        sel.includes('html[data-ag-cs-style][data-ag-cs-side-panel-vertical-tabs="on"]'),
        `Selector must be gated by html[data-ag-cs-style][data-ag-cs-side-panel-vertical-tabs="on"]: ${sel}`
      );

      const subject = getRightmostCompoundSelector(sel);

      // NEVER paint background / backdrop-filter onto [data-ag-vtabs-host="1"], [data-ag-vtabs-body="1"], or [data-ag-vtabs-body-slot="1"]
      if (subject.includes('data-ag-vtabs-host') || subject.includes('data-ag-vtabs-body')) {
        assert.equal(
          hasPaintProp,
          false,
          `Browser-hole violation: rule targeting host/body/body-slot must NEVER set background/backdrop-filter: ${sel} { ${rule.body} }`
        );
      }

      // Rail paint rule on [data-ag-vtabs-strip="1"] MUST guard :not([data-has-browser-hole="true"])
      if (subject.includes('data-ag-vtabs-strip') && !subject.includes('::-webkit-scrollbar') && hasPaintProp) {
        foundRailBgRule = true;
        assert.ok(
          sel.includes(':not([data-has-browser-hole="true"])'),
          `Rail paint rule must guard :not([data-has-browser-hole="true"]): ${sel}`
        );
      }

      if (hasTransitionNone) {
        if (sel.includes('data-has-browser-hole="true"') || sel.includes('data-ag-vtabs-hole="1"')) foundHoleNoTransition = true;
        if (sel.includes('data-ag-cs-resizing="1"')) foundResizingNoTransition = true;
        if (sel.includes('data-ag-cs-motion="off"')) foundMotionOffNoTransition = true;
        if (sel.includes('data-ag-cs-win-blur="1"')) {
          if (sel.includes('data-ag-cs-perf-mode="performance"') || sel.includes('data-ag-cs-perf-mode="eco"')) {
            foundWinBlurPerfNoTransition = true;
          } else {
            foundUnscopedWinBlurNoTransition = true;
          }
        }
        if (rule.media.includes('prefers-reduced-motion')) {
          foundReducedMotionRule = true;
          if (sel.includes(':not([data-ag-cs-ignore-rm="1"])')) foundReducedMotionIgnoreGuard = true;
        }
      }
    }
  }

  assert.equal(foundRailBgRule, true, 'Must define guarded rail paint rule on [data-ag-vtabs-strip="1"]:not([data-has-browser-hole="true"])');
  assert.equal(foundHoleNoTransition, true, 'Must disable transitions under [data-has-browser-hole="true"] / [data-ag-vtabs-hole="1"]');
  assert.equal(foundResizingNoTransition, true, 'Must disable transitions under html[data-ag-cs-resizing="1"]');
  assert.equal(foundMotionOffNoTransition, true, 'Must disable transitions under html[data-ag-cs-motion="off"]');
  assert.equal(foundWinBlurPerfNoTransition, true, 'Must disable transitions under perf-mode-scoped win-blur="1" (performance/eco)');
  assert.equal(foundUnscopedWinBlurNoTransition, false, 'AGENTS.md §二.3: win-blur="1" transition suppression must NEVER apply unconditionally to balanced/quality');
  assert.equal(foundReducedMotionRule, true, 'Must disable transitions under @media (prefers-reduced-motion: reduce)');
  assert.equal(foundReducedMotionIgnoreGuard, true, 'Issue #101: @media (prefers-reduced-motion: reduce) must guard :not([data-ag-cs-ignore-rm="1"])');
  assert.ok(css.includes('180px') && css.includes('42px') && css.includes('--ag-vtabs-w'), 'CSS must declare 180px expanded & 42px collapsed --ag-vtabs-w');
  assert.ok(css.includes('[data-ag-vtabs-strip-slot="1"]'), 'CSS must style multi-hop [data-ag-vtabs-strip-slot="1"]');
  assert.ok(css.includes('[data-ag-vtabs-body-slot="1"]'), 'CSS must style multi-hop [data-ag-vtabs-body-slot="1"]');
  assert.ok(css.includes('[data-ag-vtabs-meta="1"]'), 'CSS must hide secondary [data-ag-vtabs-meta="1"] in collapsed mode');
  assert.ok(css.includes('[data-ag-vtabs-icon="1"]'), 'CSS must style wrapped [data-ag-vtabs-icon="1"] icon spans');
  assert.ok(css.includes('button:is([role="tab"], [data-tab-id])'), 'CSS must style inner HTML5 button[role="tab"] & Zvd button[data-tab-id]');
  assert.ok(/font-size\s*:\s*0\b/.test(css), 'CSS must suppress direct TextNodes via font-size:0 in collapsed mode');

  // JS file hygiene across ALL 6 modular JS files: 0 BOM, 0 CRLF, 0 innerHTML/eval/console.log
  for (const rel of VTABS_JS_FILES) {
    const jsBuf = fs.readFileSync(path.join(ROOT, rel));
    const jsSrc = jsBuf.toString('utf8');
    assert.equal(jsBuf[0] === 0xef && jsBuf[1] === 0xbb && jsBuf[2] === 0xbf, false, `${rel} must have 0 BOM`);
    assert.equal(jsSrc.includes('\r'), false, `${rel} must use pure LF`);
    assert.equal(/\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/.test(jsSrc), false, `${rel} must have 0 innerHTML/outerHTML/insertAdjacentHTML`);
    assert.equal(/\beval\s*\(|\bnew\s+Function\b/.test(jsSrc), false, `${rel} must have 0 eval / new Function`);
    assert.equal(/\bconsole\.log\s*\(/.test(jsSrc), false, `${rel} must have 0 console.log`);
  }

  // Part B: Runtime Browser Hole detection & passive rAF window 'resize' signal
  const env = createRichMockDom({ lang: 'en' });
  const fx = buildRightSidePanelFixture(env, { topology: 'nested', hostWidth: 600 });

  let resizeEvents = 0;
  env.win.addEventListener('resize', () => { resizeEvents += 1; });

  const ctl = vtabsMod.createSidePanelVerticalTabsController({
    win: env.win,
    doc: env.doc,
    storage: env.storage,
    cssText: css,
    getLang: () => 'en',
    getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
  });
  ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
  env.flushRaf();

  assert.equal(ctl.getState().hasBrowserHole, false);
  assert.equal(fx.host.hasAttribute('data-ag-vtabs-hole'), false);
  assert.equal(fx.strip.hasAttribute('data-ag-vtabs-hole'), false);

  // Activate browser hole on body & panelBody
  env.body.setAttribute('data-has-browser-hole', 'true');
  fx.panelBody.setAttribute('data-has-browser-hole', 'true');
  env.deliverMutations();

  assert.equal(ctl.getState().hasBrowserHole, true);
  assert.equal(fx.host.getAttribute('data-ag-vtabs-hole'), '1');
  assert.equal(fx.strip.getAttribute('data-ag-vtabs-hole'), '1');

  // Toggling collapse dispatches passive window 'resize' on rAF so WebContentsView snaps cleanly
  const toggleBtn = fx.strip.querySelector('.ag-cs-vtabs-toggle');
  const beforeCollapseResize = resizeEvents;
  toggleBtn.click();
  env.flushRaf();
  assert.ok(resizeEvents > beforeCollapseResize, 'Collapsing under active browser hole must dispatch passive window resize on rAF');

  const beforeExpandResize = resizeEvents;
  toggleBtn.click();
  env.flushRaf();
  assert.ok(resizeEvents > beforeExpandResize, 'Expanding under active browser hole must dispatch passive window resize on rAF');

  // Clearing browser hole removes data-ag-vtabs-hole
  env.body.removeAttribute('data-has-browser-hole');
  fx.panelBody.removeAttribute('data-has-browser-hole');
  env.deliverMutations();
  assert.equal(ctl.getState().hasBrowserHole, false);
  assert.equal(fx.host.hasAttribute('data-ag-vtabs-hole'), false);
  assert.equal(fx.strip.hasAttribute('data-ag-vtabs-hole'), false);

  // Also test when ONLY panelBody carries data-has-browser-hole="true" (normal -> browser tab switch dispatches passive resize!)
  const beforeTabSwitchResize = resizeEvents;
  fx.panelBody.setAttribute('data-has-browser-hole', 'true');
  env.deliverMutations();
  assert.equal(ctl.getState().hasBrowserHole, true);
  assert.equal(fx.host.getAttribute('data-ag-vtabs-hole'), '1');
  assert.ok(resizeEvents > beforeTabSwitchResize, 'Normal -> browser tab switch must dispatch passive window resize');

  // Safety #6: on -> off unbind while browser hole is active must dispatch passive resize so WebContentsView reclaims full width
  const beforeDisableResize = resizeEvents;
  env.html.setAttribute('data-ag-cs-side-panel-vertical-tabs', 'off');
  ctl.sync({ sidePanelVerticalTabs: 'off', language: 'en' });
  env.flushRaf();
  assert.ok(resizeEvents > beforeDisableResize, 'on -> off unbind under active browser hole must dispatch passive window resize');

  // Safety #6: Initial off -> on mount while browser hole is ALREADY active must dispatch passive resize
  const beforeMountResize = resizeEvents;
  env.html.setAttribute('data-ag-cs-side-panel-vertical-tabs', 'on');
  ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
  env.flushRaf();
  assert.equal(ctl.getState().mounted, true);
  assert.equal(ctl.getState().hasBrowserHole, true);
  assert.ok(resizeEvents > beforeMountResize, 'Initial off -> on mount under active browser hole must dispatch passive window resize');

  // Safety #6: Mobile fallback while browser hole is active must dispatch passive resize
  const beforeFallbackResize = resizeEvents;
  const mobFallback = env.mkEl('div', { 'data-testid': 'mobile-layout' });
  fx.root.appendChild(mobFallback);
  env.deliverMutations();
  assert.equal(ctl.getState().mounted, false);
  assert.ok(resizeEvents > beforeFallbackResize, 'Mobile fallback under active browser hole must dispatch passive window resize');
  mobFallback.remove();
  env.deliverMutations();
  assert.equal(ctl.getState().mounted, true);

  // Safety #6: Intermediate ancestor between host and body carrying data-has-browser-hole="true"
  fx.panelBody.removeAttribute('data-has-browser-hole');
  env.deliverMutations();
  assert.equal(ctl.getState().hasBrowserHole, false);

  fx.rightSlot.setAttribute('data-has-browser-hole', 'true');
  env.deliverMutations();
  assert.equal(ctl.getState().hasBrowserHole, true, 'Intermediate ancestor [data-has-browser-hole="true"] must be detected');
  assert.equal(fx.host.getAttribute('data-ag-vtabs-hole'), '1');
  fx.rightSlot.removeAttribute('data-has-browser-hole');
  env.deliverMutations();
  assert.equal(ctl.getState().hasBrowserHole, false);

  ctl.destroy();
});

// ── 8. Mobile/Drawer Fallback, Host DOM Contract Failure & Zero-Leak Teardown ──
test('8. Mobile/drawer fallback & recovery, violent DOM contract failure fail-closed safety & zero-leak teardown', () => {
  const vtabsMod = loadVerticalTabsModule();
  const cssText = readVerticalTabsCss();

  // Part A: Mobile / drawer fallback & recovery
  {
    const env = createRichMockDom({ lang: 'en' });
    const fx = buildRightSidePanelFixture(env, { topology: 'nested', hostWidth: 560 });

    const ctl = vtabsMod.createSidePanelVerticalTabsController({
      win: env.win,
      doc: env.doc,
      storage: env.storage,
      cssText,
      getLang: () => 'en',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
    });
    ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
    env.flushRaf();
    assert.equal(ctl.getState().mounted, true);

    const assertFallbackAndRecover = (label, enterFn, exitFn) => {
      enterFn();
      env.deliverMutations();
      assert.equal(ctl.getState().mounted, false, `[${label}] must immediately unbind vertical layout`);
      assert.deepEqual(env.findAnyVtabsAttrs(), [], `[${label}] must leave 0 data-ag-vtabs-* residue`);
      assert.equal(env.doc.querySelector('.ag-cs-vtabs-head'), null, `[${label}] must remove .ag-cs-vtabs-head`);
      assert.equal(fx.strip.hidden, false, `[${label}] native strip must remain visible`);
      assert.notEqual(fx.strip.style.display, 'none', `[${label}] native strip must never be hidden`);

      exitFn();
      env.deliverMutations();
      assert.equal(ctl.getState().mounted, true, `[${label}] removing fallback trigger must cleanly re-engage vertical mode`);
      assert.equal(fx.host.getAttribute('data-ag-vtabs-host'), '1');
      assert.equal(fx.strip.getAttribute('data-ag-vtabs-strip'), '1');
      assert.ok(fx.strip.querySelector('.ag-cs-vtabs-toggle'));
    };

    // ISSUE-2: Mount mobile-layout and aux-drawer-backdrop INSIDE #root / .agy-shell (authentic React tree, NOT direct body child!)
    const mobileEl = env.mkEl('div', { 'data-testid': 'mobile-layout' });
    assertFallbackAndRecover('mobile-layout-in-root', () => fx.root.appendChild(mobileEl), () => mobileEl.remove());

    const backdropEl = env.mkEl('div', { class: 'aux-drawer-backdrop' });
    assertFallbackAndRecover('aux-drawer-backdrop-in-shell', () => fx.sidebarSplit.appendChild(backdropEl), () => backdropEl.remove());

    assertFallbackAndRecover(
      'drawer-browser-hole',
      () => env.body.setAttribute('data-has-drawer-browser-hole', 'true'),
      () => env.body.removeAttribute('data-has-drawer-browser-hole')
    );

    // ISSUE-2 / Safety #2: Detaching & remounting [data-testid="aux-pane-split"] inside #root must leak 0 style/RO and fully recover
    fx.auxSplit.remove();
    env.deliverMutations();
    assert.equal(ctl.getState().mounted, false, 'Detaching aux-pane-split inside #root must immediately unbind');
    assert.equal(env.doc.getElementById(STYLE_ID), null, 'Detaching aux-pane-split must remove #ag-prism-side-panel-vtabs-css (0 leak)');
    assert.equal(env.activeROs.size, 0, 'Detaching aux-pane-split must disconnect ResizeObserver (0 leak)');
    assert.deepEqual(env.findAnyVtabsAttrs(), [], 'Detaching aux-pane-split must leave 0 data-ag-vtabs-* residue');

    // Remount a brand-new aux-pane-split inside workspaceRightCol -> automatic full recovery!
    const freshAux = env.mkEl('div', { 'data-testid': 'aux-pane-split', 'data-ag-cs-aux-dual': '1' });
    const freshRight = env.mkEl('div', { class: 'right-panel-slot' });
    const freshHost = env.mkEl(
      'div',
      { class: 'agy-inset-shell', 'data-side-panel-focus-scope': 'true' },
      { left: 880, top: 0, width: 560, height: 720, right: 1440, bottom: 720 }
    );
    const freshStrip = env.mkEl('div', { 'data-side-panel-strip': '' });
    const freshList = env.mkEl('div', { role: 'tablist' });
    const freshBody = env.mkEl('div', { 'data-side-panel-body': '' });
    freshList.appendChild(createNativeTab(env, { id: 're-1', label: '/btw Recovered Tab', active: true }, {}).tab);
    freshStrip.appendChild(freshList);
    freshHost.appendChild(freshStrip);
    freshHost.appendChild(freshBody);
    freshRight.appendChild(freshHost);
    freshAux.appendChild(env.mkEl('div', { class: 'main-workspace-slot' }));
    freshAux.appendChild(env.mkEl('div', { role: 'separator' }));
    freshAux.appendChild(freshRight);
    fx.workspaceRightCol.appendChild(freshAux);
    env.deliverMutations();

    assert.equal(ctl.getState().mounted, true, 'Remounting fresh aux-pane-split inside #root must auto-recover vertical tabs');
    assert.equal(freshHost.getAttribute('data-ag-vtabs-host'), '1');
    assert.equal(freshStrip.getAttribute('data-ag-vtabs-strip'), '1');
    assert.ok(env.doc.getElementById(STYLE_ID));
    assert.ok(freshStrip.querySelector('.ag-cs-vtabs-toggle'));

    ctl.destroy();
  }

  // Part B: Host DOM contract failures -> silent fail-closed fallback, 0 exceptions, 0 residue
  {
    // B1: Remove all tabs -> 0 tabs -> silent unbind
    const env1 = createRichMockDom({ lang: 'en' });
    const fx1 = buildRightSidePanelFixture(env1, { topology: 'nested' });
    const ctl1 = vtabsMod.createSidePanelVerticalTabsController({
      win: env1.win,
      doc: env1.doc,
      storage: env1.storage,
      cssText,
      getLang: () => 'en',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
    });
    ctl1.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
    env1.flushRaf();
    assert.equal(ctl1.getState().mounted, true);

    assert.doesNotThrow(() => {
      fx1.tabList.replaceChildren();
      env1.deliverMutations();
    });
    assert.equal(ctl1.getState().mounted, false, '0 tabs must fail-closed unbind');
    assert.deepEqual(env1.findAnyVtabsAttrs(), [], '0 tabs fallback must leave 0 data-ag-vtabs-* residue');

    // B2: Remove [data-side-panel-body] violently -> silent unbind, 0 exceptions
    fx1.mountTabs([{ id: 't1', label: 'Restored Tab', active: true }], fx1.tabList);
    env1.deliverMutations();
    assert.equal(ctl1.getState().mounted, true);

    assert.doesNotThrow(() => {
      fx1.panelBody.remove();
      env1.deliverMutations();
    });
    assert.equal(ctl1.getState().mounted, false, 'Missing [data-side-panel-body] must fail-closed unbind');
    assert.deepEqual(env1.findAnyVtabsAttrs(), []);

    // B3: Remove [data-side-panel-strip] violently -> silent unbind, 0 exceptions
    fx1.host.appendChild(fx1.panelBody);
    env1.deliverMutations();
    assert.equal(ctl1.getState().mounted, true);

    assert.doesNotThrow(() => {
      fx1.strip.remove();
      env1.deliverMutations();
    });
    assert.equal(ctl1.getState().mounted, false, 'Missing [data-side-panel-strip] must fail-closed unbind');
    assert.deepEqual(env1.findAnyVtabsAttrs(), []);
    ctl1.destroy();

    // B4: Broken container hierarchy (strip & body share body / aux-pane-split / main workspace ancestor, or > 3 ancestor hops)
    const brokenCases = ['shared-body', 'contains-conversation-view', 'contains-sidebar-split', 'too-deep-hierarchy'];
    for (const kind of brokenCases) {
      const envB = createRichMockDom({ lang: 'en' });
      const stripB = envB.mkEl('div', { 'data-side-panel-strip': '' });
      stripB.appendChild(createNativeTab(envB, { id: 'b1', label: 'Tab 1', active: true }, {}).tab);
      const bodyB = envB.mkEl('div', { 'data-side-panel-body': '' });

      if (kind === 'shared-body') {
        envB.body.appendChild(stripB);
        envB.body.appendChild(bodyB);
      } else if (kind === 'contains-conversation-view') {
        const badWrap = envB.mkEl('div');
        badWrap.appendChild(envB.mkEl('div', { 'data-testid': 'conversation-view' }));
        badWrap.appendChild(stripB);
        badWrap.appendChild(bodyB);
        envB.body.appendChild(badWrap);
      } else if (kind === 'contains-sidebar-split') {
        const badWrap = envB.mkEl('div');
        badWrap.appendChild(envB.mkEl('div', { 'data-testid': 'sidebar-split' }));
        badWrap.appendChild(stripB);
        badWrap.appendChild(bodyB);
        envB.body.appendChild(badWrap);
      } else {
        // 5 wrapper hops between strip and shared ancestor (> max 3 climb!)
        const outer = envB.mkEl('div');
        let cur = outer;
        for (let depth = 0; depth < 5; depth++) {
          const next = envB.mkEl('div');
          cur.appendChild(next);
          cur = next;
        }
        cur.appendChild(stripB);
        outer.appendChild(bodyB);
        envB.body.appendChild(outer);
      }

      const ctlB = vtabsMod.createSidePanelVerticalTabsController({
        win: envB.win,
        doc: envB.doc,
        storage: envB.storage,
        cssText,
        getLang: () => 'en',
        getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
      });
      assert.doesNotThrow(() => {
        ctlB.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
        envB.flushRaf();
      });
      assert.equal(ctlB.getState().mounted, false, `[${kind}] broken hierarchy must refuse to mount (fail-closed)`);
      assert.deepEqual(envB.findAnyVtabsAttrs(), [], `[${kind}] must leave 0 data-ag-vtabs-* attrs`);
      assert.equal(stripB.hidden, false, `[${kind}] native strip must remain untouched`);
      ctlB.destroy();
    }
  }

  // Part C: Zero-leak teardown via destroy(), SIDE_PANEL_VTABS_REMOVE_EXPRESSION & full REMOVE_EXPRESSION
  {
    const env = createRichMockDom({ lang: 'zh-CN' });
    const fx = buildRightSidePanelFixture(env, { topology: 'nested', hostWidth: 560 });

    const baseWinListeners = env.countWinListeners();
    const baseDocListeners = env.countDocListeners();

    const ctl = vtabsMod.createSidePanelVerticalTabsController({
      win: env.win,
      doc: env.doc,
      storage: env.storage,
      cssText,
      getLang: () => 'zh-CN',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'zh-CN' }),
    });
    ctl.sync({ sidePanelVerticalTabs: 'on', language: 'zh-CN' });
    env.flushRaf();

    assert.ok(env.activeMOs.size >= 1, 'Expected active MutationObserver while mounted');
    assert.ok(env.activeROs.size >= 1, 'Expected active ResizeObserver while mounted');
    assert.ok(env.doc.getElementById(STYLE_ID));
    assert.ok(fx.strip.querySelector('.ag-cs-vtabs-head'));

    // Zero document-level click or mousedown listeners even while active!
    assert.equal(env.countDocListeners(['click', 'mousedown']), 0, 'Must NEVER register document-level click or mousedown listeners');

    // Destroy twice to verify idempotency & zero leaks
    ctl.destroy();
    assert.doesNotThrow(() => ctl.destroy(), 'Second destroy() call must be idempotent');

    assert.equal(env.activeMOs.size, 0, 'destroy() must disconnect ALL MutationObservers');
    assert.equal(env.activeROs.size, 0, 'destroy() must disconnect ALL ResizeObservers');
    assert.equal(env.rafQueue.size, 0, 'destroy() must cancel ALL pending rAF callbacks');
    assert.equal(env.countWinListeners(), baseWinListeners, 'destroy() must remove ALL window event listeners (storage/resize/etc.)');
    assert.equal(env.countDocListeners(), baseDocListeners, 'destroy() must remove ALL document event listeners');
    assert.equal(env.doc.getElementById(STYLE_ID), null, 'destroy() must remove #ag-prism-side-panel-vtabs-css');
    assert.equal(env.doc.querySelector('.ag-cs-vtabs-head'), null, 'destroy() must remove .ag-cs-vtabs-head');
    assert.equal(env.doc.querySelector('.ag-cs-vtabs-toggle'), null, 'destroy() must remove .ag-cs-vtabs-toggle');
    assert.deepEqual(env.findAnyVtabsAttrs(), [], 'destroy() must leave 0 data-ag-vtabs-* attributes anywhere in DOM');
  }

  // Part D: End-to-end Channel 18 VM mount -> idempotent reuse -> SIDE_PANEL_VTABS_REMOVE_EXPRESSION -> full REMOVE_EXPRESSION
  {
    const env = createRichMockDom({ lang: 'zh-CN' });
    const fx = buildRightSidePanelFixture(env, { topology: 'nested', hostWidth: 560 });

    const sandbox = {
      window: null,
      globalThis: null,
      document: env.doc,
      navigator: env.win.navigator,
      location: env.win.location,
      localStorage: env.storage,
      getComputedStyle: env.win.getComputedStyle,
      matchMedia: () => ({ matches: false }),
      MutationObserver: env.win.MutationObserver,
      ResizeObserver: env.win.ResizeObserver,
      Event: env.win.Event,
      CustomEvent: env.win.CustomEvent,
      requestAnimationFrame: env.win.requestAnimationFrame,
      cancelAnimationFrame: env.win.cancelAnimationFrame,
      setTimeout: env.win.setTimeout,
      clearTimeout: env.win.clearTimeout,
      setInterval: () => 1,
      clearInterval: () => {},
      addEventListener: env.win.addEventListener,
      removeEventListener: env.win.removeEventListener,
      dispatchEvent: env.win.dispatchEvent,
      performance: env.win.performance,
      Math, Date, JSON, Map, Set, WeakMap, WeakSet, Array, Object, String, Number, Boolean, Promise, Uint8Array, Float32Array, Intl, RegExp,
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    sandbox.top = sandbox;

    // Boot Channel 1 with sidePanelVerticalTabs='on' + Channel 18
    const onCfg = { ...cdp.DEFAULT_CONFIG, sidePanelVerticalTabs: 'on' };
    const ch1Res = vm.runInNewContext(cdp.buildInjectExpression(onCfg), sandbox);
    assert.equal(ch1Res.status, 'ok');
    assert.equal(env.html.getAttribute('data-ag-cs-side-panel-vertical-tabs'), 'on');

    const ch18Expr = cdp.buildSidePanelVerticalTabsExpression(onCfg);
    const ch18Res1 = vm.runInNewContext(ch18Expr, sandbox);
    env.flushRaf();
    assert.equal(ch18Res1.ok, true);
    assert.ok(sandbox.window.__agPrismSidePanelVtabs, 'Channel 18 must register window.__agPrismSidePanelVtabs');
    assert.ok(env.doc.getElementById(STYLE_ID), 'Channel 18 must inject #ag-prism-side-panel-vtabs-css');
    assert.equal(fx.host.getAttribute('data-ag-vtabs-host'), '1');
    assert.equal(fx.strip.getAttribute('data-ag-vtabs-strip'), '1');

    // Second Channel 18 evaluation is idempotent (reused: true)
    const ch18Res2 = vm.runInNewContext(ch18Expr, sandbox);
    assert.equal(ch18Res2.ok, true);
    assert.equal(ch18Res2.reused, true, 'Re-evaluating Channel 18 with same hash must reuse cleanly');

    // SIDE_PANEL_VTABS_REMOVE_EXPRESSION cleans Channel 18 completely
    const remCh18 = vm.runInNewContext(cdp.SIDE_PANEL_VTABS_REMOVE_EXPRESSION, sandbox);
    assert.equal(remCh18.ok, true);
    assert.equal(sandbox.window.__agPrismSidePanelVtabs, undefined);
    assert.equal(sandbox.globalThis.__agPrismSidePanelVtabs, undefined);
    assert.equal(env.doc.getElementById(STYLE_ID), null);
    assert.equal(env.doc.querySelector('.ag-cs-vtabs-head'), null);
    assert.equal(env.doc.querySelector('.ag-cs-vtabs-toggle'), null);
    assert.deepEqual(env.findAnyVtabsAttrs(), []);

    // Re-mount Channel 18 and verify full cdp.REMOVE_EXPRESSION tears down BOTH Channel 1 and Channel 18 with 0 residue
    vm.runInNewContext(ch18Expr, sandbox);
    env.flushRaf();
    assert.equal(fx.host.getAttribute('data-ag-vtabs-host'), '1');

    vm.runInNewContext(cdp.REMOVE_EXPRESSION, sandbox);
    assert.equal(env.html.hasAttribute('data-ag-cs-side-panel-vertical-tabs'), false, 'REMOVE_EXPRESSION must strip data-ag-cs-side-panel-vertical-tabs');
    assert.equal(sandbox.window.__agPrismSidePanelVtabs, undefined, 'REMOVE_EXPRESSION must delete window.__agPrismSidePanelVtabs');
    assert.equal(env.doc.getElementById(STYLE_ID), null, 'REMOVE_EXPRESSION must remove #ag-prism-side-panel-vtabs-css');
    assert.equal(env.doc.querySelector('.ag-cs-vtabs-head'), null, 'REMOVE_EXPRESSION must remove .ag-cs-vtabs-head');
    assert.equal(env.doc.querySelector('.ag-cs-vtabs-toggle'), null, 'REMOVE_EXPRESSION must remove .ag-cs-vtabs-toggle');
    assert.deepEqual(env.findAnyVtabsAttrs(), [], 'REMOVE_EXPRESSION must leave 0 data-ag-vtabs-* attrs');
  }
});

// ── 9. Red-Team Regressions: Authentic sidebar-split, HTML5 button[role="tab"], Non-Close Buttons, TextNode/Meta/Icon & Tailwind .hidden ──
test('9. Red-team regressions: sidebar-split left rejection vs right mount, HTML5 button[role="tab"], non-close buttons, meta/icon/TextNode & Tailwind hidden', () => {
  const vtabsMod = loadVerticalTabsModule();
  const cssText = readVerticalTabsCss();
  const env = createRichMockDom({ lang: 'zh-CN' });
  const fx = buildRightSidePanelFixture(env, { topology: 'nested', hostWidth: 560, tabs: [] });

  // ISSUE-1: Add decoy strip+body inside left sidebar (div:first-child of sidebar-split) AND inside an <aside>
  const decoyWrap1 = env.mkEl('div', { class: 'left-decoy-host' });
  const decoyStrip1 = env.mkEl('div', { 'data-side-panel-strip': '' });
  decoyStrip1.appendChild(createNativeTab(env, { id: 'decoy-1', label: 'Left Sidebar Decoy', active: true }, {}).tab);
  const decoyBody1 = env.mkEl('div', { 'data-side-panel-body': '' });
  decoyWrap1.appendChild(decoyStrip1);
  decoyWrap1.appendChild(decoyBody1);
  fx.leftSidebar.appendChild(decoyWrap1);

  const aside = env.mkEl('aside');
  const decoyWrap2 = env.mkEl('div', { class: 'aside-decoy-host' });
  const decoyStrip2 = env.mkEl('div', { 'data-side-panel-strip': '' });
  decoyStrip2.appendChild(createNativeTab(env, { id: 'decoy-2', label: 'Aside Decoy', active: true }, {}).tab);
  const decoyBody2 = env.mkEl('div', { 'data-side-panel-body': '' });
  decoyWrap2.appendChild(decoyStrip2);
  decoyWrap2.appendChild(decoyBody2);
  aside.appendChild(decoyWrap2);
  fx.root.insertBefore(aside, fx.shellWrap);

  // Build diverse real-world Antigravity / Radix / HTML5 tab variants in the real Right Side Panel
  // Tab A (ISSUE-3 / Safety #1): HTML5 non-closable <div class="agy-aux-tab"><button role="tab"><svg/><span>Review Changes</span></button></div>
  const tabHtml5NonClose = env.mkEl('div', { class: 'agy-aux-tab' });
  const tabHtml5Btn = env.mkEl('button', { type: 'button', role: 'tab', 'aria-selected': 'true' });
  const tabHtml5Svg = env.doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const tabHtml5Span = env.mkEl('span', { text: 'Review Changes' });
  tabHtml5Btn.appendChild(tabHtml5Svg);
  tabHtml5Btn.appendChild(tabHtml5Span);
  tabHtml5NonClose.appendChild(tabHtml5Btn);

  // Tab B (ISSUE-3 / Safety #1): HTML5 closable <div class="agy-aux-tab"><button role="tab"><svg/><span>/btw Why leak?</span></button><button aria-label="Close Tab"><svg/></button></div>
  const tabHtml5Closable = env.mkEl('div', { class: 'agy-aux-tab' });
  const tabHtml5ClosableTrigger = env.mkEl('button', { type: 'button', role: 'tab', 'aria-selected': 'false' });
  tabHtml5ClosableTrigger.appendChild(env.doc.createElementNS('http://www.w3.org/2000/svg', 'svg'));
  const tabHtml5ClosableSpan = env.mkEl('span', { text: '/btw Why leak?' });
  tabHtml5ClosableTrigger.appendChild(tabHtml5ClosableSpan);
  const tabHtml5CloseBtn = env.mkEl('button', { type: 'button', 'aria-label': 'Close Tab' });
  tabHtml5CloseBtn.appendChild(env.doc.createElementNS('http://www.w3.org/2000/svg', 'svg'));
  tabHtml5Closable.appendChild(tabHtml5ClosableTrigger);
  tabHtml5Closable.appendChild(tabHtml5CloseBtn);

  // Tab C (Safety #1): Localized non-close action button (固定标签) + SVGAnimatedString className safety
  const tabPin = env.mkEl('div', { class: 'agy-aux-tab', role: 'tab', 'aria-selected': 'false' });
  tabPin.appendChild(env.doc.createElementNS('http://www.w3.org/2000/svg', 'svg'));
  const tabPinLabel = env.mkEl('span', { text: 'Pinned Spec' });
  const tabPinBtn = env.mkEl('button', { type: 'button', 'aria-label': '固定标签' });
  tabPinBtn.appendChild(env.doc.createElementNS('http://www.w3.org/2000/svg', 'svg'));
  const svgRoleBtn = env.doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgRoleBtn.setAttribute('role', 'button');
  svgRoleBtn.setAttribute('aria-label', '刷新');
  Object.defineProperty(svgRoleBtn, 'className', { value: { baseVal: 'icon-refresh' }, configurable: true });
  tabPin.appendChild(tabPinLabel);
  tabPin.appendChild(tabPinBtn);
  tabPin.appendChild(svgRoleBtn);

  // Tab D (ISSUE-7 / Safety #4): Direct TextNode tab (<svg/>Direct Title<button aria-label="Close">x</button>)
  const tabDirectText = env.mkEl('div', { class: 'agy-aux-tab', role: 'tab', 'aria-selected': 'false' });
  tabDirectText.appendChild(env.doc.createElementNS('http://www.w3.org/2000/svg', 'svg'));
  tabDirectText.appendChild(env.mkText('Direct Title'));
  const tabDirectClose = env.mkEl('button', { type: 'button', 'aria-label': 'Close', text: 'x' });
  tabDirectText.appendChild(tabDirectClose);

  // Tab E (ISSUE-7 / Safety #4): Multi-span /btw badge + wrapped <span data-host-icon><svg/></span>
  const tabBadgeWrapped = env.mkEl('div', { class: 'agy-aux-tab', role: 'tab', 'aria-selected': 'false' });
  const wrappedIcon = env.mkEl('span', { 'data-host-icon': 'btw', class: 'shrink-0 inline-flex' });
  wrappedIcon.appendChild(env.doc.createElementNS('http://www.w3.org/2000/svg', 'svg'));
  const badgeSpan = env.mkEl('span', { class: 'badge', text: '/btw' });
  const titleSpan = env.mkEl('span', { class: 'title', text: 'Long question about RO' });
  const badgeClose = env.mkEl('button', { type: 'button', 'aria-label': 'Close Tab' });
  badgeClose.appendChild(env.doc.createElementNS('http://www.w3.org/2000/svg', 'svg'));
  tabBadgeWrapped.appendChild(wrappedIcon);
  tabBadgeWrapped.appendChild(badgeSpan);
  tabBadgeWrapped.appendChild(titleSpan);
  tabBadgeWrapped.appendChild(badgeClose);

  fx.tabList.appendChild(tabHtml5NonClose);
  fx.tabList.appendChild(tabHtml5Closable);
  fx.tabList.appendChild(tabPin);
  fx.tabList.appendChild(tabDirectText);
  fx.tabList.appendChild(tabBadgeWrapped);

  // Safety #8: Dormant Tailwind class="hidden" mobile-layout & aux-drawer-backdrop MUST NOT disable vertical tabs
  const hiddenMobile = env.mkEl('div', { 'data-testid': 'mobile-layout', class: 'hidden' });
  const hiddenBackdrop = env.mkEl('div', { class: 'aux-drawer-backdrop hidden' });
  fx.root.appendChild(hiddenMobile);
  fx.sidebarSplit.appendChild(hiddenBackdrop);

  const ctl = vtabsMod.createSidePanelVerticalTabsController({
    win: env.win,
    doc: env.doc,
    storage: env.storage,
    cssText,
    getLang: () => 'zh-CN',
    getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'zh-CN' }),
  });

  assert.doesNotThrow(() => {
    ctl.sync({ sidePanelVerticalTabs: 'on', language: 'zh-CN' });
    env.flushRaf();
  });

  // ISSUE-1: Left sidebar & aside decoys MUST be rejected; genuine Right Side Panel inside sidebar-split mounts cleanly!
  assert.equal(decoyWrap1.hasAttribute('data-ag-vtabs-host'), false, 'Left sidebar decoy inside sidebar-split > div:first-child MUST be rejected');
  assert.equal(decoyStrip1.hasAttribute('data-ag-vtabs-strip'), false);
  assert.equal(decoyWrap2.hasAttribute('data-ag-vtabs-host'), false, 'Aside decoy MUST be rejected');
  assert.equal(decoyStrip2.hasAttribute('data-ag-vtabs-strip'), false);
  assert.equal(ctl.getState().mounted, true, 'Right Side Panel inside authentic [data-testid="sidebar-split"] MUST mount');
  assert.equal(ctl.getState().tabCount, 5);
  assert.equal(fx.host.getAttribute('data-ag-vtabs-host'), '1');
  assert.equal(fx.strip.getAttribute('data-ag-vtabs-strip'), '1');

  // ISSUE-3 / Safety #1 assertions
  assert.equal(tabHtml5Btn.hasAttribute('data-ag-vtabs-close'), false, 'HTML5 non-closable button[role="tab"] MUST NEVER be marked data-ag-vtabs-close');
  assert.equal(tabHtml5Span.getAttribute('data-ag-vtabs-label'), '1', 'HTML5 non-closable inner span must get data-ag-vtabs-label="1"');
  assert.equal(tabHtml5NonClose.getAttribute('title'), 'Review Changes');
  assert.equal(tabHtml5NonClose.hasAttribute('data-ag-vtabs-no-icon'), false);

  assert.equal(tabHtml5ClosableTrigger.hasAttribute('data-ag-vtabs-close'), false, 'HTML5 closable button[role="tab"] MUST NEVER be marked close');
  assert.equal(tabHtml5CloseBtn.getAttribute('data-ag-vtabs-close'), '1', 'HTML5 close button must get data-ag-vtabs-close="1"');
  assert.equal(tabHtml5ClosableSpan.getAttribute('data-ag-vtabs-label'), '1', 'HTML5 closable inner label span must get data-ag-vtabs-label="1"');
  assert.equal(tabHtml5Closable.getAttribute('title'), '/btw Why leak?');

  assert.equal(tabPinBtn.hasAttribute('data-ag-vtabs-close'), false, 'Localized non-close button (固定标签) MUST NEVER be marked close');
  assert.equal(svgRoleBtn.hasAttribute('data-ag-vtabs-close'), false, 'Localized SVG button (刷新) MUST NEVER be marked close');
  assert.equal(tabPinLabel.getAttribute('data-ag-vtabs-label'), '1');
  assert.equal(tabPin.getAttribute('title'), 'Pinned Spec');

  // ISSUE-7 / Safety #4 assertions
  assert.equal(tabDirectText.getAttribute('data-ag-vtabs-tab'), '1');
  assert.equal(tabDirectText.getAttribute('title'), 'Direct Title');
  assert.equal(tabDirectText.hasAttribute('data-ag-vtabs-no-icon'), false);
  assert.equal(tabDirectClose.getAttribute('data-ag-vtabs-close'), '1');

  assert.equal(wrappedIcon.getAttribute('data-ag-vtabs-icon'), '1', 'Wrapped <span data-host-icon><svg/></span> must get data-ag-vtabs-icon="1"');
  assert.equal(titleSpan.getAttribute('data-ag-vtabs-label'), '1', 'Primary title span must get data-ag-vtabs-label="1"');
  assert.equal(badgeSpan.getAttribute('data-ag-vtabs-meta'), '1', 'Secondary /btw badge span must get data-ag-vtabs-meta="1"');
  assert.equal(tabBadgeWrapped.hasAttribute('data-ag-vtabs-no-icon'), false);

  // Safety #8: Showing Tailwind hidden mobile-layout immediately triggers fallback; hiding restores vertical mode
  hiddenMobile.classList.remove('hidden');
  env.deliverMutations();
  assert.equal(ctl.getState().mounted, false, 'Removing Tailwind .hidden from mobile-layout must unbind');
  hiddenMobile.classList.add('hidden');
  env.deliverMutations();
  assert.equal(ctl.getState().mounted, true, 'Adding Tailwind .hidden back to mobile-layout must re-engage');

  ctl.destroy();
  assert.deepEqual(env.findAnyVtabsAttrs(), [], 'destroy() must strip data-ag-vtabs-icon, data-ag-vtabs-meta and all other attrs');
});

// ── 10. Red-Team Regressions: Multi-Hop Slots (hop=2/3), Live characterData Title, doc.hidden & resizing Flush ──
test('10. Red-team regressions: multi-hop host slots (strip-slot/strip-wrap/body-slot), live characterData /btw title & hidden/resizing deferred flush', () => {
  const vtabsMod = loadVerticalTabsModule();
  const cssText = readVerticalTabsCss();
  const env = createRichMockDom({ lang: 'en' });

  // Authentic sidebar-split -> aux-pane-split -> rightSlot -> host with hop=3 stripSlot>stripWrap>strip & hop=2 bodySlot>body
  const root = env.mkEl('div', { id: 'root' });
  const sidebarSplit = env.mkEl('div', { 'data-testid': 'sidebar-split', class: 'agy-shell' });
  sidebarSplit.appendChild(env.mkEl('div', { class: 'ag-replica-sb-wrap' }));
  sidebarSplit.appendChild(env.mkEl('div', { 'data-testid': 'sidebar-sash' }));
  const wsCol = env.mkEl('div');
  const auxSplit = env.mkEl('div', { 'data-testid': 'aux-pane-split' });
  auxSplit.appendChild(env.mkEl('div', { class: 'main-workspace-slot' }));
  auxSplit.appendChild(env.mkEl('div', { role: 'separator' }));
  const rightSlot = env.mkEl('div', { class: 'right-panel-slot' });
  const host = env.mkEl('div', { class: 'agy-inset-shell' }, { left: 880, top: 0, width: 560, height: 720, right: 1440, bottom: 720 });
  const stripSlot = env.mkEl('div', { class: 'strip-slot' });
  const stripWrap = env.mkEl('div', { class: 'strip-wrap' });
  const strip = env.mkEl('div', { 'data-side-panel-strip': '' });
  const tabList = env.mkEl('div', { role: 'tablist' });
  const bodySlot = env.mkEl('div', { class: 'body-slot' });
  const panelBody = env.mkEl('div', { 'data-side-panel-body': '' });

  // Dynamic /btw tab with explicit TextNode for characterData edit test
  const dynTab = env.mkEl('div', { class: 'agy-aux-tab', role: 'tab', 'aria-selected': 'true' });
  dynTab.appendChild(env.doc.createElementNS('http://www.w3.org/2000/svg', 'svg'));
  const dynSpan = env.mkEl('span', { class: 'agy-tab-title' });
  const dynText = env.mkText('/btw Loading...');
  dynSpan.appendChild(dynText);
  dynTab.appendChild(dynSpan);
  dynTab.appendChild(env.mkEl('button', { type: 'button', 'aria-label': 'Close Tab', text: 'x' }));
  tabList.appendChild(dynTab);

  strip.appendChild(tabList);
  stripWrap.appendChild(strip);
  stripSlot.appendChild(stripWrap);
  bodySlot.appendChild(panelBody);
  host.appendChild(stripSlot);
  host.appendChild(bodySlot);
  rightSlot.appendChild(host);
  auxSplit.appendChild(rightSlot);
  wsCol.appendChild(auxSplit);
  sidebarSplit.appendChild(wsCol);
  root.appendChild(sidebarSplit);
  env.body.appendChild(root);

  const ctl = vtabsMod.createSidePanelVerticalTabsController({
    win: env.win,
    doc: env.doc,
    storage: env.storage,
    cssText,
    getLang: () => 'en',
    getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
  });
  ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
  env.flushRaf();

  // ISSUE-4: Multi-hop slot & wrap markers stamped accurately
  assert.equal(ctl.getState().mounted, true);
  assert.equal(host.getAttribute('data-ag-vtabs-host'), '1');
  assert.equal(stripSlot.getAttribute('data-ag-vtabs-strip-slot'), '1', 'hop>=2 direct strip slot must carry data-ag-vtabs-strip-slot="1"');
  assert.equal(stripWrap.getAttribute('data-ag-vtabs-strip-wrap'), '1', 'hop=3 intermediate wrapper must carry data-ag-vtabs-strip-wrap="1"');
  assert.equal(bodySlot.getAttribute('data-ag-vtabs-body-slot'), '1', 'hop>=2 direct body slot must carry data-ag-vtabs-body-slot="1"');
  assert.equal(strip.getAttribute('data-ag-vtabs-strip'), '1');
  assert.equal(panelBody.getAttribute('data-ag-vtabs-body'), '1');

  // ISSUE-5: Live characterData mutation refreshes hover title tooltip immediately
  assert.equal(dynTab.getAttribute('title'), '/btw Loading...');
  dynText.nodeValue = '/btw Streamed summary of WebContentsView layout';
  env.deliverMutations();
  assert.equal(
    dynTab.getAttribute('title'),
    '/btw Streamed summary of WebContentsView layout',
    'characterData edit inside strip must immediately refresh hover title tooltip'
  );

  // Safety #5a: Mutations while doc.hidden === true are deferred and flushed on visibilitychange
  env.doc.hidden = true;
  const hiddenAddedTab = createNativeTab(env, { id: 'hid-1', label: 'Tab Added While Hidden' }, {}).tab;
  tabList.appendChild(hiddenAddedTab);
  env.deliverMutations();
  assert.equal(ctl.getState().tabCount, 1, 'Sync must remain paused while doc.hidden === true');

  env.doc.hidden = false;
  env.doc.dispatchEvent(new env.MockEvent('visibilitychange'));
  env.flushRaf();
  assert.equal(ctl.getState().tabCount, 2, 'visibilitychange to visible must flush deferred sync');
  assert.equal(hiddenAddedTab.getAttribute('data-ag-vtabs-tab'), '1');
  assert.equal(hiddenAddedTab.getAttribute('title'), 'Tab Added While Hidden');

  // Safety #5b: Mutations while html[data-ag-cs-resizing="1"] are deferred and flushed when resizing clears
  env.html.setAttribute('data-ag-cs-resizing', '1');
  env.deliverMutations();
  const resizeAddedTab = createNativeTab(env, { id: 'rsz-1', label: 'Tab Added During Sash Drag' }, {}).tab;
  tabList.appendChild(resizeAddedTab);
  env.deliverMutations();
  assert.equal(ctl.getState().tabCount, 2, 'Sync must defer DOM rescans while data-ag-cs-resizing="1"');

  env.html.removeAttribute('data-ag-cs-resizing');
  env.deliverMutations();
  assert.equal(ctl.getState().tabCount, 3, 'Clearing data-ag-cs-resizing must flush deferred sync immediately');
  assert.equal(resizeAddedTab.getAttribute('data-ag-vtabs-tab'), '1');
  assert.equal(resizeAddedTab.getAttribute('title'), 'Tab Added During Sash Drag');

  // Safety #5c (Round 2): data-ag-cs-resizing="1" -> mutation -> doc.hidden=true -> resizing clears while hidden -> visibilitychange flushes deferred sync
  env.html.setAttribute('data-ag-cs-resizing', '1');
  env.deliverMutations();
  const resizeHiddenTab = createNativeTab(env, { id: 'rsz-hid-1', label: 'Tab Added During Drag Then Hidden' }, {}).tab;
  tabList.appendChild(resizeHiddenTab);
  env.deliverMutations();
  assert.equal(ctl.getState().tabCount, 3, 'Mutation during active resizing must stay deferred');

  env.doc.hidden = true;
  env.html.removeAttribute('data-ag-cs-resizing');
  env.deliverMutations();
  assert.equal(ctl.getState().tabCount, 3, 'Clearing data-ag-cs-resizing while doc.hidden must remain deferred until visible');

  env.doc.hidden = false;
  env.doc.dispatchEvent(new env.MockEvent('visibilitychange'));
  env.flushRaf();
  assert.equal(ctl.getState().tabCount, 4, 'visibilitychange back to visible must flush pendingResizeSync cleared while hidden');
  assert.equal(resizeHiddenTab.getAttribute('data-ag-vtabs-tab'), '1');
  assert.equal(resizeHiddenTab.getAttribute('title'), 'Tab Added During Drag Then Hidden');

  ctl.destroy();
  assert.equal(env.countDocListeners(['visibilitychange']), 0, 'destroy() must remove visibilitychange listener');
  assert.deepEqual(env.findAnyVtabsAttrs(), [], 'destroy() must clean strip-slot, strip-wrap, body-slot and all other attrs');
});

// ── 11. Integration: inject.js Broadcaster & PrismDaemon Channel 18 Lifecycle, Race Guards, Config Persistence & Missing .css ──
test('11. Integration: inject.js broadcaster & PrismDaemon Channel 18 OFF->ON->OFF, hot-reload getter, race safety, config persistence & missing .css guard', async () => {
  // Part A: inject.js _createFastConfigRefreshBroadcaster
  {
    const injectMod = require(path.join(ROOT, 'inject.js'));
    let cfg = {
      ...cdp.DEFAULT_CONFIG,
      sidePanelVerticalTabs: 'off',
      omniModule: 'off',
      sidebarStudio: 'off',
      hostLocalization: 'auto',
      thoughtTranslate: 'off',
      periodicModelPicker: 'off',
      mascot: 'off',
    };
    let activeRemoveExpr = '__VTABS_RM_V1__';
    let builtExpr = '__VTABS_EXPR_ON__';
    let scriptSeq = 0;
    const activeVtScriptIds = new Set();
    const evals = [];
    let delayNextVtAdd = null;
    let delayNextEvalCode = null;
    let delayNextEvalGate = null;

    const assertNoLeakedInFlight = (ent, label) => {
      const inf = ent._rtEvalInFlight;
      if (!inf) return;
      if (inf instanceof Map || inf instanceof Set) {
        assert.equal(inf.size, 0, `${label}: _rtEvalInFlight must have 0 leaked entries`);
      } else if (typeof inf === 'object') {
        assert.equal(Object.keys(inf).length, 0, `${label}: _rtEvalInFlight must have 0 leaked keys`);
      }
    };

    const entry = {
      session: {
        closed: false,
        evaluate: async (code) => {
          if (delayNextEvalGate && code === delayNextEvalCode) {
            const g = delayNextEvalGate;
            delayNextEvalGate = null;
            delayNextEvalCode = null;
            await g.promise;
          }
          evals.push(code);
          return code === '__REF__' ? { refreshed: true } : { ok: true };
        },
        send: async (method, params) => {
          if (method === 'Page.addScriptToEvaluateOnNewDocument') {
            if (params.source === builtExpr && delayNextVtAdd) {
              const gate = delayNextVtAdd;
              delayNextVtAdd = null;
              await gate.promise;
            }
            const id = `inj-id-${++scriptSeq}`;
            if (params.source === builtExpr) activeVtScriptIds.add(id);
            return { identifier: id };
          }
          if (method === 'Page.removeScriptToEvaluateOnNewDocument') {
            activeVtScriptIds.delete(params.identifier);
            return {};
          }
          return {};
        },
      },
      scriptId: null,
      sidePanelVtabsScriptId: null,
      sidePanelVtabsMounted: false,
      pendingAckEpoch: 0,
    };

    const bc = injectMod._createFastConfigRefreshBroadcaster({
      attached: new Map([['w1', entry]]),
      readConfig: () => cfg,
      buildInjectExpression: () => '__MAIN__',
      buildConfigRefreshExpression: () => '__REF__',
      shouldEnableHostI18n: () => false,
      hostI18nRemoveExpression: '',
      getThoughtHooks: () => ({ shouldEnable: () => false, buildExpression: () => '', removeExpression: '' }),
      getInlineDiffHooks: () => ({ buildExpression: () => '', removeExpression: '' }),
      shouldEnablePeriodicPicker: () => false,
      periodicPickerRemoveExpression: '',
      shouldEnableMascot: () => false,
      mascotRemoveExpression: '',
      getRuntimeChannelCdp: () => ({
        CHANNEL_REGISTRY: [
          {
            id: 'sidePanelVtabs',
            tier: 'studio',
            fields: {
              scriptField: 'sidePanelVtabsScriptId',
              mountedField: 'sidePanelVtabsMounted',
            },
            shouldEnable: (c) => c.sidePanelVerticalTabs === 'on',
            build: (c) => (c.sidePanelVerticalTabs === 'on' ? builtExpr : ''),
            get teardown() { return activeRemoveExpr; },
          },
        ],
      }),
    });

    // 1) Initial OFF -> 0 Channel 18 evals or scripts
    await bc();
    assert.equal(evals.includes('__VTABS_EXPR_ON__'), false);
    assert.equal(entry.sidePanelVtabsScriptId, null);
    assert.equal(entry.sidePanelVtabsMounted, false);
    assert.equal(activeVtScriptIds.size, 0);

    // 2) OFF -> ON -> mounts & registers NewDocument script
    evals.length = 0;
    cfg = { ...cfg, sidePanelVerticalTabs: 'on' };
    await bc();
    assert.ok(evals.includes('__VTABS_EXPR_ON__'), 'Broadcaster must evaluate Channel 18 when turned on');
    assert.ok(entry.sidePanelVtabsScriptId);
    assert.equal(entry.sidePanelVtabsMounted, true);
    assert.equal(activeVtScriptIds.size, 1);

    // 3) Hot-reload updates remove expression getter before ON -> OFF -> MUST evaluate V2, not stale V1!
    evals.length = 0;
    activeRemoveExpr = '__VTABS_RM_V2__';
    cfg = { ...cfg, sidePanelVerticalTabs: 'off' };
    await bc();
    assert.ok(evals.includes('__VTABS_RM_V2__'), 'Callable sidePanelVtabsRemoveExpression getter must pick up hot-reloaded V2');
    assert.equal(evals.includes('__VTABS_RM_V1__'), false);
    assert.equal(entry.sidePanelVtabsScriptId, null);
    assert.equal(entry.sidePanelVtabsMounted, false);
    assert.equal(activeVtScriptIds.size, 0);

    // 4) Missing .css (expr === '' while enabled === true) cleans up previously mounted module & script ID
    cfg = { ...cfg, sidePanelVerticalTabs: 'on' };
    await bc();
    assert.equal(entry.sidePanelVtabsMounted, true);
    assert.equal(activeVtScriptIds.size, 1);

    evals.length = 0;
    builtExpr = '';
    await bc();
    assert.ok(evals.includes('__VTABS_RM_V2__'), 'Missing .css (empty expr) must clean up mounted Channel 18');
    assert.equal(entry.sidePanelVtabsScriptId, null);
    assert.equal(entry.sidePanelVtabsMounted, false);
    assert.equal(activeVtScriptIds.size, 0);

    // 5a) Rapid OFF -> ON -> OFF race with delayed Page.addScriptToEvaluateOnNewDocument -> 0 leaked script IDs & 0 leaked _rtEvalInFlight!
    builtExpr = '__VTABS_EXPR_ON__';
    cfg = { ...cfg, sidePanelVerticalTabs: 'off' };
    await bc();
    let releaseAdd;
    delayNextVtAdd = { promise: new Promise((r) => { releaseAdd = r; }) };
    cfg = { ...cfg, sidePanelVerticalTabs: 'on' };
    const pOn = bc();
    await new Promise((r) => setTimeout(r, 15));
    cfg = { ...cfg, sidePanelVerticalTabs: 'off' };
    const pOff = bc();
    releaseAdd();
    await Promise.all([pOn, pOff]);
    assert.equal(activeVtScriptIds.size, 0, 'Rapid OFF->ON->OFF race in inject.js must leave 0 leaked NewDocument script IDs');
    assert.equal(entry.sidePanelVtabsScriptId, null);
    assert.equal(entry.sidePanelVtabsMounted, false);
    assertNoLeakedInFlight(entry, 'OFF->ON->OFF addScript race');

    // 5b) Red-team #168 #1: Concurrent ON (delayed eval) -> OFF must NOT leak NewDocument script or _rtEvalInFlight!
    let releaseOnEval;
    delayNextEvalCode = '__VTABS_EXPR_ON__';
    delayNextEvalGate = { promise: new Promise((r) => { releaseOnEval = r; }) };
    cfg = { ...cfg, sidePanelVerticalTabs: 'on' };
    const pOnEval = bc();
    await new Promise((r) => setTimeout(r, 15));
    cfg = { ...cfg, sidePanelVerticalTabs: 'off' };
    const pOffDuringEval = bc();
    await pOffDuringEval;
    releaseOnEval();
    await pOnEval;
    assert.equal(activeVtScriptIds.size, 0, '#168 #1: Concurrent ON(delayed eval)->OFF must leave 0 leaked NewDocument script IDs');
    assert.equal(entry.sidePanelVtabsScriptId, null, '#168 #1: Concurrent ON(delayed eval)->OFF must clear sidePanelVtabsScriptId');
    assert.equal(entry.sidePanelVtabsMounted, false, '#168 #1: Concurrent ON(delayed eval)->OFF must keep sidePanelVtabsMounted=false');
    assertNoLeakedInFlight(entry, 'ON(delayed eval)->OFF');

    // 5c) Red-team #168 #1: Concurrent ON -> OFF (delayed removeExpr) -> ON must preserve final active ON mount with strictly 1 script ID!
    cfg = { ...cfg, sidePanelVerticalTabs: 'on' };
    await bc();
    assert.equal(entry.sidePanelVtabsMounted, true);
    assert.equal(activeVtScriptIds.size, 1);

    let releaseOffEval;
    delayNextEvalCode = '__VTABS_RM_V2__';
    delayNextEvalGate = { promise: new Promise((r) => { releaseOffEval = r; }) };
    cfg = { ...cfg, sidePanelVerticalTabs: 'off' };
    const pOffSlow = bc();
    await new Promise((r) => setTimeout(r, 15));
    cfg = { ...cfg, sidePanelVerticalTabs: 'on' };
    const pOnFinal = bc();
    await pOnFinal;
    releaseOffEval();
    await pOffSlow;
    assert.equal(entry.sidePanelVtabsMounted, true, '#168 #1: Concurrent ON->OFF->ON must preserve final mounted=true state');
    assert.equal(activeVtScriptIds.size, 1, '#168 #1: Concurrent ON->OFF->ON must leave strictly 1 active NewDocument script ID');
    assert.ok(activeVtScriptIds.has(entry.sidePanelVtabsScriptId), '#168 #1: entry.sidePanelVtabsScriptId must match the live NewDocument script');
    assertNoLeakedInFlight(entry, 'ON->OFF->ON');
  }

  // Part B: PrismDaemon (sidecars/daemon/main.mjs) in isolated temp plugin dir
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-vtabs-daemon-'));
  try {
    const pluginDir = path.join(tmpDir, 'plugin');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(pluginDir, 'package.json'));
    fs.copyFileSync(path.join(ROOT, 'config.example.json'), path.join(pluginDir, 'config.example.json'));
    fs.cpSync(path.join(ROOT, 'src'), path.join(pluginDir, 'src'), { recursive: true });
    for (const rel of cdp.SYNC_ROOT_FILES) {
      const src = path.join(ROOT, rel);
      if (fs.existsSync(src)) {
        fs.mkdirSync(path.dirname(path.join(pluginDir, rel)), { recursive: true });
        fs.copyFileSync(src, path.join(pluginDir, rel));
      }
    }
    for (const rel of ['vendor/pulse-dashboard/inline-fallback.js', 'vendor/effort-slider/slider-coexist.js', ...VTABS_JS_FILES, ...VTABS_CSS_FILES]) {
      const src = path.join(ROOT, rel);
      if (fs.existsSync(src)) {
        fs.mkdirSync(path.dirname(path.join(pluginDir, rel)), { recursive: true });
        fs.copyFileSync(src, path.join(pluginDir, rel));
      }
    }
    fs.writeFileSync(
      path.join(pluginDir, 'config.json'),
      JSON.stringify(
        {
          ...cdp.DEFAULT_CONFIG,
          sidePanelVerticalTabs: 'off',
          omniModule: 'off',
          sidebarStudio: 'off',
          thoughtTranslate: 'off',
          periodicModelPicker: 'off',
          mascot: 'off',
          homeLayout: 'off',
          telemetryModule: 'off',
          effortSliderModule: 'off',
          contextMenu: false,
          sidebarNavFold: 'off',
          projectPartitions: 'off',
          scrollBottomMotion: 'instant',
          sidebarRestyle: false,
          motionLevel: 'off',
          hostLocalization: 'auto',
          language: 'en',
        },
        null,
        2
      ) + '\n',
      'utf8'
    );

    const { PrismDaemon } = await import(pathToFileURL(path.join(ROOT, 'sidecars/daemon/main.mjs')).href);
    const daemon = new PrismDaemon({
      rootDir: pluginDir,
      bundleCachePath: false,
      silent: true,
      enableAutoUpdateTimer: false,
    });

    let vtSeq = 0;
    const activeVtIds = new Set();
    let delayAddGate = null;
    let mockProbeState = null;
    const vtEvalCalls = [];

    const entry = {
      wsUrl: 'ws://127.0.0.1:9999/vtabs',
      pageId: 'vtabs-page',
      url: 'https://127.0.0.1:42000/',
      title: 'Antigravity',
      mainFrameId: 'main-frame',
      contextFrames: new Map([[42, { frameId: 'main-frame', isDefault: true, type: 'default' }]]),
      sidebarHostVerified: true,
      scriptId: 'main-doc-1',
      sidePanelVtabsScriptId: null,
      sidePanelVtabsMounted: false,
      lastSidePanelVtabsSig: '',
      lastSidePanelVtabsScriptSig: '',
      inlineDiffSkipped: true,
      wallpaperSkipped: true,
      suggesterSkipped: true,
      healthyStreak: 0,
      lastVerifyAt: 0,
      lastVerifiedCodeHash: '',
      session: {
        closed: false,
        send: async (method, params) => {
          if (method === 'Page.addScriptToEvaluateOnNewDocument') {
            const isVt =
              typeof params?.source === 'string' &&
              params.source.includes('__agPrismSidePanelVtabsCss') &&
              !params.source.includes('__agCsUiMain');
            if (isVt && delayAddGate) {
              const g = delayAddGate;
              delayAddGate = null;
              await g.promise;
            }
            const id = isVt ? `vt-doc-${++vtSeq}` : `other-doc-${++vtSeq}`;
            if (isVt) activeVtIds.add(id);
            return { identifier: id };
          }
          if (method === 'Page.removeScriptToEvaluateOnNewDocument') {
            activeVtIds.delete(params?.identifier);
            return {};
          }
          if (method === 'Runtime.evaluate') {
            const expr = String(params?.expression || '');
            if (expr.includes('__agPrismSidePanelVtabsCss') && !expr.includes('__agCsUiMain')) vtEvalCalls.push(expr);
            return { result: { value: { ok: true, status: 'mounted' } } };
          }
          return {};
        },
        evaluate: async (expr) => {
          const s = String(expr || '');
          if (s.includes('hasSidePanelVtabs') && s.includes('needsSidePanelVtabsChannel') && mockProbeState) {
            return { ...mockProbeState };
          }
          if (s.includes('__agPrismSidePanelVtabsCss') && !s.includes('__agCsUiMain')) vtEvalCalls.push(s);
          if (s.includes('refreshConfig')) return { refreshed: true };
          return { ok: true, status: 'mounted' };
        },
        close() { this.closed = true; },
      },
    };
    daemon.sessions.set(entry.wsUrl, entry);

    // 1) OFF -> ON -> OFF via handleBindingCall + config.json disk persistence roundtrip
    await daemon.handleBindingCall(entry, {
      name: daemon.cdp.SETTING_BINDING,
      payload: JSON.stringify({ key: 'sidePanelVerticalTabs', value: 'on' }),
      executionContextId: 42,
    });
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(pluginDir, 'config.json'), 'utf8')).sidePanelVerticalTabs,
      'on',
      'PrismDaemon must persist sidePanelVerticalTabs="on" to config.json'
    );
    assert.ok(entry.sidePanelVtabsScriptId, 'PrismDaemon must register Channel 18 NewDocument script when enabled');
    assert.equal(entry.sidePanelVtabsMounted, true);
    assert.equal(activeVtIds.size, 1);

    await daemon.handleBindingCall(entry, {
      name: daemon.cdp.SETTING_BINDING,
      payload: JSON.stringify({ key: 'sidePanelVerticalTabs', value: 'off' }),
      executionContextId: 42,
    });
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(pluginDir, 'config.json'), 'utf8')).sidePanelVerticalTabs,
      'off',
      'PrismDaemon must persist sidePanelVerticalTabs="off" to config.json'
    );
    assert.equal(entry.sidePanelVtabsScriptId, null);
    assert.equal(entry.sidePanelVtabsMounted, false);
    assert.equal(activeVtIds.size, 0);

    // 2a) Concurrent ON setting + request-side-panel-vtabs -> _runEntryExclusive prevents double NewDocument registration
    await Promise.all([
      daemon.handleBindingCall(entry, {
        name: daemon.cdp.SETTING_BINDING,
        payload: JSON.stringify({ key: 'sidePanelVerticalTabs', value: 'on' }),
        executionContextId: 42,
      }),
      daemon.handleBindingCall(entry, {
        name: daemon.cdp.SETTING_BINDING,
        payload: JSON.stringify({ action: 'request-side-panel-vtabs' }),
        executionContextId: 42,
      }),
    ]);
    assert.equal(activeVtIds.size, 1, 'Concurrent ON + request-side-panel-vtabs must leave strictly 1 NewDocument script (0 leak)');
    assert.ok(activeVtIds.has(entry.sidePanelVtabsScriptId));

    // 2b) Mid-flight OFF during request-side-panel-vtabs addScriptToEvaluateOnNewDocument -> post-await re-check removes leaked ID!
    await daemon.handleBindingCall(entry, {
      name: daemon.cdp.SETTING_BINDING,
      payload: JSON.stringify({ key: 'sidePanelVerticalTabs', value: 'off' }),
      executionContextId: 42,
    });
    assert.equal(activeVtIds.size, 0);
    daemon.updateConfigSetting('sidePanelVerticalTabs', 'on');
    let releaseDaemonAdd;
    delayAddGate = { promise: new Promise((r) => { releaseDaemonAdd = r; }) };
    const pDeliver = daemon._deliverSidePanelVtabsChannelToEntry(entry, 42);
    await new Promise((r) => setTimeout(r, 15));
    daemon.updateConfigSetting('sidePanelVerticalTabs', 'off');
    releaseDaemonAdd();
    await pDeliver;
    assert.equal(activeVtIds.size, 0, 'Post-await enabled re-check must immediately remove leaked Channel 18 NewDocument script');
    assert.equal(entry.sidePanelVtabsScriptId, null);
    assert.equal(entry.sidePanelVtabsMounted, false);

    // 3) Missing vtabs CSS on disk while enabled -> cleans stale mounted state & ZERO infinite verifyAndHealEntry loop
    daemon.updateConfigSetting('sidePanelVerticalTabs', 'on');
    for (const cssRel of VTABS_CSS_FILES) {
      const p = path.join(pluginDir, cssRel);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    daemon.sidePanelVtabsExpr = '';
    daemon.codeHash = 'ch1-ok';
    entry.lastVerifiedCodeHash = 'ch1-ok';
    entry.sidePanelVtabsScriptId = 'stale-vt-missing-css';
    activeVtIds.add('stale-vt-missing-css');
    entry.sidePanelVtabsMounted = true;
    mockProbeState = {
      ready: true,
      isHostDom: true,
      href: 'https://127.0.0.1:42000/',
      title: 'Antigravity',
      scopeAttr: '',
      prismAttr: daemon.cdp.PLUGIN_VERSION,
      hasPrism: true,
      hasRepoBridge: true,
      hasThoughtBridge: true,
      hasUsageBridge: true,
      hasOmniBridge: false,
      hasOmniServerMeta: false,
      hasOmni: false,
      omniMode: 'off',
      hasSidebarBridge: false,
      hasSidebar: false,
      sidebarMode: 'off',
      hasHostI18n: false,
      hostI18nMode: '',
      hasMascot: false,
      mascotCodeHash: '',
      hasHomeStudio: false,
      homeStudioCodeHash: '',
      needsHomeStudioChannel: false,
      hasSidePanelVtabs: true,
      sidePanelVtabsCodeHash: 'old',
      needsSidePanelVtabsChannel: false,
      needsSettingsChannel: false,
      hasThought: false,
      hasThoughtSettingsUi: false,
      hasInlineDiff: false,
      hasWallpaper: false,
      hasWallpaperUi: false,
      hasSuggester: false,
      hasSuggesterUi: false,
      hasPeriodicPicker: false,
      periodicPickerCodeHash: '',
      codeHash: 'ch1-ok',
      hasLegacyCss: false,
      needsDashboardSync: false,
    };
    await daemon.verifyAndHealEntry(entry, true);
    assert.equal(entry.sidePanelVtabsScriptId, null, 'Missing .css must clean up stale sidePanelVtabsScriptId');
    assert.equal(entry.sidePanelVtabsMounted, false, 'Missing .css must clear sidePanelVtabsMounted');
    assert.equal(activeVtIds.size, 0);

    // Subsequent poll with probe.needsSidePanelVtabsChannel === true must NOT heal/loop forever
    vtEvalCalls.length = 0;
    mockProbeState.hasSidePanelVtabs = false;
    mockProbeState.sidePanelVtabsCodeHash = '';
    mockProbeState.needsSidePanelVtabsChannel = true;
    await daemon.verifyAndHealEntry(entry, true);
    assert.ok(entry.healthyStreak >= 1, 'Missing .css must NOT trigger repeated heal resets (0 infinite self-heal loop)');
    assert.equal(vtEvalCalls.length, 0, 'Missing .css must perform 0 Channel 18 evals when already clean');
    const secondVerify = await daemon.verifyAndHealEntry(entry, false);
    assert.equal(secondVerify.skipped, true, 'Missing .css must allow healthy backoff skip on subsequent verify');

    await daemon.stop(false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── 12. Integration: End-to-End Live Channel 1 + Channel 9 + Channel 18 Reset Defaults & Workbench /api/prism-inject.js ──
test('12. Integration: live Channel 1+9+18 Reset Defaults teardown & expanded recovery + workbench /api/prism-inject.js Channel 18 wiring', async () => {
  // Part A: End-to-end live Ch1 + Ch9 + Ch18 Reset Defaults
  {
    const env = createRichMockDom({
      lang: 'zh-CN',
      initialStorage: { 'ag-prism:settings-open': '1' },
    });
    env.html.removeAttribute('data-ag-cs-style');
    env.html.removeAttribute('data-ag-cs-side-panel-vertical-tabs');
    const fx = buildRightSidePanelFixture(env, { topology: 'nested', hostWidth: 560 });

    // Mount host Appearance dialog so Channel 9 settings-panel mounts live alongside Channel 1 & Channel 18
    const dialog = env.mkEl('div', { role: 'dialog' });
    const panel = env.mkEl('div', { class: 'p-6' });
    panel.appendChild(env.mkEl('h2', { text: '外观' }));
    panel.appendChild(env.mkEl('div', { class: 'space-y-2' }));
    dialog.appendChild(panel);
    env.body.appendChild(dialog);

    const sandbox = {
      window: null,
      globalThis: null,
      document: env.doc,
      navigator: env.win.navigator,
      location: env.win.location,
      localStorage: env.storage,
      getComputedStyle: env.win.getComputedStyle,
      matchMedia: () => ({ matches: false }),
      MutationObserver: env.win.MutationObserver,
      ResizeObserver: env.win.ResizeObserver,
      Event: env.win.Event,
      CustomEvent: env.win.CustomEvent,
      requestAnimationFrame: env.win.requestAnimationFrame,
      cancelAnimationFrame: env.win.cancelAnimationFrame,
      setTimeout: env.win.setTimeout,
      clearTimeout: env.win.clearTimeout,
      setInterval: () => 1,
      clearInterval: () => {},
      addEventListener: env.win.addEventListener,
      removeEventListener: env.win.removeEventListener,
      dispatchEvent: env.win.dispatchEvent,
      performance: env.win.performance,
      Math, Date, JSON, Map, Set, WeakMap, WeakSet, Array, Object, String, Number, Boolean, Promise, Uint8Array, Float32Array, Intl, RegExp,
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    sandbox.top = sandbox;

    const onCfg = { ...cdp.DEFAULT_CONFIG, sidePanelVerticalTabs: 'on', language: 'zh-CN' };
    vm.runInNewContext(cdp.buildInjectExpression(onCfg), sandbox);
    vm.runInNewContext(cdp.buildSettingsChannelExpression(), sandbox);
    const ch18Expr = cdp.buildSidePanelVerticalTabsExpression(onCfg);
    vm.runInNewContext(ch18Expr, sandbox);
    env.flushRaf();

    assert.equal(env.html.getAttribute('data-ag-cs-side-panel-vertical-tabs'), 'on');
    assert.equal(fx.host.getAttribute('data-ag-vtabs-host'), '1');

    // Drag sash to set a custom expanded width (180 -> 260px) before clicking Reset Defaults
    const liveSash = fx.strip.querySelector('.ag-cs-vtabs-sash');
    assert.ok(liveSash, 'Live Channel 18 must mount .ag-cs-vtabs-sash');
    liveSash.dispatchEvent(new env.MockEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: 520 }));
    liveSash.dispatchEvent(new env.MockEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 1, clientX: 440 }));
    env.flushRaf();
    liveSash.dispatchEvent(new env.MockEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, clientX: 440 }));
    env.flushRaf();
    assert.equal(env.storage.getItem(STORAGE_WIDTH_KEY), '260', 'Live sash drag must persist custom width 260px');
    assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '260px');

    // Collapse the live vertical rail via its top toggle button
    const toggleBtn = fx.strip.querySelector('.ag-cs-vtabs-toggle');
    assert.ok(toggleBtn);
    toggleBtn.click();
    env.flushRaf();
    assert.equal(fx.host.getAttribute('data-ag-vtabs-collapsed'), '1');
    assert.equal(env.storage.getItem(STORAGE_COLLAPSED_KEY), '1');

    // Click live Reset Defaults inside mounted Settings panel
    const sec = env.doc.getElementById(settingsPanel.SETTINGS_SEC_ID);
    assert.ok(sec, 'Settings section must mount via Channel 9');
    const resetBtn = sec.querySelector('button[data-ag-cs-cfg-action="reset"]');
    assert.ok(resetBtn, 'Reset Defaults button must exist');
    resetBtn.click();
    env.flushRaf();

    // Live collapsed rail torn down cleanly, storage cleared (both collapsed & width), settings-open preserved
    assert.equal(env.html.getAttribute('data-ag-cs-side-panel-vertical-tabs'), 'off');
    assert.equal(fx.host.hasAttribute('data-ag-vtabs-host'), false, 'Reset Defaults must tear down live vertical rail');
    assert.equal(env.doc.querySelector('.ag-cs-vtabs-head'), null);
    assert.deepEqual(env.findAnyVtabsAttrs(), []);
    assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '', 'Reset Defaults must clear inline --ag-vtabs-w');
    assert.equal(fx.strip.style.getPropertyValue('--ag-vtabs-top-inset'), '', 'Reset Defaults must clear inline --ag-vtabs-top-inset');
    assert.equal(env.storage.getItem(STORAGE_COLLAPSED_KEY), null, 'Reset Defaults must clear ag-prism:side-panel-vtabs-collapsed');
    assert.equal(env.storage.getItem(STORAGE_WIDTH_KEY), null, 'Reset Defaults must clear ag-prism:side-panel-vtabs-width');
    assert.equal(env.storage.getItem('ag-prism:settings-open'), '1', 'Reset Defaults must preserve ag-prism:settings-open');

    // Re-enabling sidePanelVerticalTabs must open EXPANDED at default 180px (not stale collapsed or 260px)
    sandbox.window.__agPrism.saveSettingsBatch({ sidePanelVerticalTabs: 'on' });
    vm.runInNewContext(ch18Expr, sandbox);
    env.flushRaf();
    assert.equal(env.html.getAttribute('data-ag-cs-side-panel-vertical-tabs'), 'on');
    assert.equal(fx.host.getAttribute('data-ag-vtabs-host'), '1');
    assert.equal(fx.host.hasAttribute('data-ag-vtabs-collapsed'), false, 'Re-enabling after Reset Defaults must open expanded');
    assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '180px', 'Re-enabling after Reset Defaults must reset live rail width to 180px');
    assert.equal(sandbox.window.__agPrismSidePanelVtabs.getState().collapsed, false);
    assert.equal(sandbox.window.__agPrismSidePanelVtabs.getState().expandedWidth, 180);

    vm.runInNewContext(cdp.REMOVE_EXPRESSION, sandbox);
  }

  // Part B: workbench/server.cjs /api/prism-inject.js Channel 18 wiring (off vs on)
  {
    const { createWorkbenchServer } = require(path.join(ROOT, 'workbench/server.cjs'));
    const server = createWorkbenchServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const { port } = server.address();
      const base = `http://127.0.0.1:${port}`;

      const resOff = await fetch(`${base}/api/prism-inject.js?sidePanelVerticalTabs=off`);
      assert.equal(resOff.status, 200);
      const bodyOff = await resOff.text();
      assert.equal(bodyOff.includes('__agPrismSidePanelVtabsCss'), false, 'workbench /api/prism-inject.js must omit Channel 18 when off');

      const resOn = await fetch(`${base}/api/prism-inject.js?sidePanelVerticalTabs=on`);
      assert.equal(resOn.status, 200);
      const bodyOn = await resOn.text();
      assert.ok(bodyOn.includes('__agPrismSidePanelVtabsCss'), 'workbench /api/prism-inject.js must append Channel 18 when sidePanelVerticalTabs=on');
      assert.doesNotThrow(() => new vm.Script(bodyOn), 'workbench combined Ch1+Ch6+Ch18 bundle must compile as valid JS');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }
});

// ── 13. Addendum Contract Sync: Ch1 Budget (< 390,000 B), 29 Attrs, 5 Owned Classes, 2 Inline CSS Vars & Full CSS Audit ──
test('13. Addendum contract sync: Ch1 budget (< 390,000 B), 29 attrs + 5 owned classes + --ag-vtabs-w/--ag-vtabs-top-inset cleanup & CSS static audit', async () => {
  // 1) Channel 1 hard budget (< 390,000 B) & untouched style.css
  const ch1AutoExpr = cdp.buildInjectExpression({ ...cdp.DEFAULT_CONFIG, language: 'auto' }, { noDiskCache: true });
  const ch1AutoBytes = Buffer.byteLength(ch1AutoExpr, 'utf8');
  assert.ok(ch1AutoBytes < 390000, `Channel 1 (auto) must stay < 390,000 B hard gate, got ${ch1AutoBytes} B`);
  const refreshBytes = Buffer.byteLength(
    cdp.buildConfigRefreshExpression({ palette: 'warm', lightPreset: 'alabaster', accentTone: 'cobalt' }),
    'utf8'
  );
  assert.ok(refreshBytes < 4096, `buildConfigRefreshExpression must stay < 4,096 B, got ${refreshBytes} B`);
  const jaSliceBytes = Buffer.byteLength(JSON.stringify(i18nLocales.getRuntimeUiSlice('ja')), 'utf8');
  assert.ok(jaSliceBytes < 4096, `getRuntimeUiSlice('ja') must stay < 4,096 B, got ${jaSliceBytes} B`);
  assert.equal(cdp.buildSidePanelVerticalTabsExpression({ ...cdp.DEFAULT_CONFIG, sidePanelVerticalTabs: 'off' }, { noDiskCache: true }), '');

  const mainStyleCss = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  assert.equal(mainStyleCss.includes('data-ag-vtabs-'), false, 'style.css must remain untouched (0 data-ag-vtabs- rules)');
  assert.equal(mainStyleCss.includes('ag-cs-vtabs-'), false, 'style.css must remain untouched (0 ag-cs-vtabs- rules)');

  // 2) All 29 attrs (incl. data-ag-vtabs-active & data-ag-vtabs-top-inset), 5 owned classes & 2 inline CSS vars synced across modular JS, cdp.js & CHANNEL_REGISTRY teardown
  assert.equal(ALL_29_VTABS_ATTRS.length, 29);
  const vtabsJsSrc = readAllVerticalTabsJs();
  for (const attr of ALL_29_VTABS_ATTRS) {
    assert.ok(vtabsJsSrc.includes(attr), `Modular vtabs JS must include attribute ${attr}`);
  }
  const ch18Reg = cdp.findChannel('sidePanelVtabs');
  assert.ok(ch18Reg && typeof ch18Reg.teardown === 'string', 'CHANNEL_REGISTRY.sidePanelVtabs.teardown must be defined');
  assert.doesNotThrow(() => new vm.Script(ch18Reg.teardown), 'CHANNEL_REGISTRY.sidePanelVtabs.teardown must compile as valid JS');

  const cleanupTargets = [
    ['SIDE_PANEL_VTABS_REMOVE_EXPRESSION', cdp.SIDE_PANEL_VTABS_REMOVE_EXPRESSION],
    ['REMOVE_EXPRESSION', cdp.REMOVE_EXPRESSION],
    ['CHANNEL_REGISTRY.sidePanelVtabs.teardown', ch18Reg.teardown],
  ];
  const ownedClasses = ['.ag-cs-vtabs-head', '.ag-cs-vtabs-toggle', '.ag-cs-vtabs-sash', '.ag-cs-vtabs-glide-bar', '.ag-cs-vtabs-ord'];

  for (const [label, expr] of cleanupTargets) {
    assert.ok(typeof expr === 'string' && expr.length > 0, `${label} must be non-empty`);
    for (const attr of ALL_29_VTABS_ATTRS) {
      assert.ok(expr.includes(attr), `${label} must clean attribute ${attr}`);
    }
    for (const cls of ownedClasses) {
      assert.ok(expr.includes(cls), `${label} must remove owned node selector ${cls}`);
    }
    assert.ok(expr.includes('--ag-vtabs-w'), `${label} must clear inline --ag-vtabs-w`);
    assert.ok(expr.includes('--ag-vtabs-top-inset'), `${label} must clear inline --ag-vtabs-top-inset`);
  }

  // 3) Addendum CSS static hygiene & completeness across BOTH modular CSS files (pure ASCII, 0 :has, 0 &, 0 paint on host/body/body-slot, 7x4 tones dark/light/mono, sash/ord/glide/caustic/ready)
  for (const rel of VTABS_CSS_FILES) {
    const cssBuf = fs.readFileSync(path.join(ROOT, rel));
    const cssPart = cssBuf.toString('utf8');
    assert.equal(cssBuf[0] === 0xef && cssBuf[1] === 0xbb && cssBuf[2] === 0xbf, false, `${rel} must have 0 BOM`);
    assert.equal(cssPart.includes('\r'), false, `${rel} must use pure LF`);
    assert.equal(/[^\x00-\x7f]/.test(cssPart), false, `${rel} must remain 100% pure ASCII`);
    assert.equal(/:has\(/.test(cssPart), false, `${rel} must contain 0 :has(`);
    assert.equal(/scrollbar-width\s*:\s*thin/i.test(cssPart), false, `${rel} must contain 0 scrollbar-width:thin`);
    assert.equal(/blur\(\s*(?:20|24)px\s*\)/i.test(cssPart), false, `${rel} must contain 0 blur(20|24px)`);
    assert.equal(checkBalancedBraces(cssPart), true, `${rel} braces must remain balanced`);
  }
  const css = readVerticalTabsCss();

  const rules = parseFlatCssRules(css);
  for (const rule of rules) {
    assert.equal(rule.prelude.includes('&'), false, `Flat CSS only (0 '&' nesting), found in: ${rule.prelude}`);
    const hasPaintProp = /(?:^|;|\s)(?:background(?:-color|-image)?|backdrop-filter)\s*:/i.test(rule.body);
    for (const sel of rule.selectors) {
      const subject = getRightmostCompoundSelector(sel);
      if (subject.includes('data-ag-vtabs-host') || subject.includes('data-ag-vtabs-body')) {
        assert.equal(hasPaintProp, false, `Host/body/body-slot must NEVER be painted: ${sel} { ${rule.body} }`);
      }
    }
  }

  for (const token of [
    '.ag-cs-vtabs-sash',
    '.ag-cs-vtabs-sash-line',
    '[data-ag-vtabs-dragging="1"]',
    '.ag-cs-vtabs-ord',
    '.ag-cs-vtabs-glide-bar',
    '[data-ag-vtabs-gliding="1"]',
    '@keyframes ag-vtabs-c-sw',
    '[data-ag-vtabs-caustic="1"]',
    '[data-ag-vtabs-ready="1"]',
    '[data-ag-cs-accent="mono"]',
    '[data-ag-cs-theme="light"]',
    '.theme-light',
  ]) {
    assert.ok(css.includes(token), `Modular vtabs CSS must include ${token}`);
  }

  // Verify refactored custom-property palette design (A-M1): all 56 exact Dark+Light hexes on [data-ag-vtabs-strip="1"] + single 28-rule mapping table + mono 42% desaturation
  const PALETTE_SPEC = [
    { cat: 'btw', prefix: 'b', dark: ['#8E84F5', '#A87CF7', '#C878E8', '#7C8EF8'], light: ['#7C3AED', '#6366F1', '#A21CAF', '#4F46E5'] },
    { cat: 'doc', prefix: 'd', dark: ['#4F8BFF', '#58C4F6', '#7AA2D4', '#3B9EE8'], light: ['#2563EB', '#0284C7', '#3B66A8', '#1D4ED8'] },
    { cat: 'diff', prefix: 'f', dark: ['#E2B354', '#F0935B', '#E5C07B', '#D98A4E'], light: ['#D97706', '#EA580C', '#B45309', '#C2410C'] },
    { cat: 'term', prefix: 't', dark: ['#4CC39A', '#34D399', '#56A87E', '#6EE7B7'], light: ['#059669', '#15803D', '#047857', '#0F766E'] },
    { cat: 'browser', prefix: 'w', dark: ['#5BC4BE', '#38BDF8', '#2DD4BF', '#67E8F9'], light: ['#0D9488', '#0284C7', '#0891B2', '#0E7490'] },
    { cat: 'plugin', prefix: 'p', dark: ['#EC7B8A', '#F472B6', '#E07D5B', '#FB7185'], light: ['#E11D48', '#DB2777', '#C25934', '#BE123C'] },
    { cat: 'other', prefix: 'o', dark: ['#8C99B0', '#94A3B8', '#7B8BA6', '#A5B4C8'], light: ['#475569', '#64748B', '#334155', '#526075'] },
  ];

  const darkPaletteRule = rules.find(
    (r) =>
      r.selectors.some(
        (s) =>
          s.includes('[data-ag-vtabs-strip="1"]') &&
          !s.includes('[data-ag-cs-theme="light"]') &&
          !s.includes('.theme-light')
      ) && r.body.includes('--_vb0')
  );
  assert.ok(darkPaletteRule, 'CSS must define the 28 Dark palette custom-property tokens on [data-ag-vtabs-strip="1"]');

  const lightPaletteRule = rules.find(
    (r) =>
      r.selectors.some((s) => s.includes('[data-ag-cs-theme="light"]') && s.includes('[data-ag-vtabs-strip="1"]')) &&
      r.selectors.some((s) => s.includes('.theme-light') && s.includes('[data-ag-vtabs-strip="1"]')) &&
      r.body.includes('--_vb0')
  );
  assert.ok(lightPaletteRule, 'CSS must override all 28 Light palette custom-property tokens on [data-ag-vtabs-strip="1"] for both [data-ag-cs-theme="light"] and .theme-light');

  for (const { cat, prefix, dark, light } of PALETTE_SPEC) {
    for (let tone = 0; tone < 4; tone++) {
      const varName = `--_v${prefix}${tone}`;
      const darkRe = new RegExp(`${varName}\\s*:\\s*${dark[tone]}\\b`, 'i');
      const lightRe = new RegExp(`${varName}\\s*:\\s*${light[tone]}\\b`, 'i');
      assert.ok(darkRe.test(darkPaletteRule.body), `Dark strip tokens missing ${varName}: ${dark[tone]}`);
      assert.ok(lightRe.test(lightPaletteRule.body), `Light strip tokens missing ${varName}: ${light[tone]}`);

      const mapRule = rules.find(
        (r) =>
          r.selectors.some(
            (s) =>
              s.includes(`[data-ag-vtabs-cat="${cat}"][data-ag-vtabs-tone="${tone}"]`) &&
              s.includes('[data-ag-vtabs-tab="1"]') &&
              s.includes('.ag-cs-vtabs-glide-bar')
          ) && new RegExp(`--ag-vtabs-cat-raw\\s*:\\s*var\\(${varName}\\)`).test(r.body)
      );
      assert.ok(
        mapRule,
        `CSS missing single (cat=${cat}, tone=${tone}) mapping rule binding both tab & glide-bar to var(${varName})`
      );
    }
  }

  const monoRule = rules.find(
    (r) =>
      r.selectors.some((s) => s.includes('[data-ag-cs-accent="mono"]')) &&
      /--ag-vtabs-cat-c\s*:\s*color-mix\(\s*in\s+srgb\s*,\s*var\(--ag-vtabs-cat-raw[^;]*\)\s+42%/i.test(r.body)
  );
  assert.ok(monoRule, 'CSS must define [data-ag-cs-accent="mono"] 42% color-mix desaturation on --ag-vtabs-cat-c');

  // Idle GPU hygiene (A-m1): .ag-cs-vtabs-glide-bar must NOT set unconditional will-change at rest; only under [data-ag-vtabs-gliding="1"]
  let hasScopedWillChange = false;
  for (const rule of rules) {
    const targetsGlideBar = rule.selectors.some((s) => getRightmostCompoundSelector(s).includes('.ag-cs-vtabs-glide-bar'));
    if (!targetsGlideBar) continue;
    const isGlidingScoped = rule.selectors.every((s) => s.includes('[data-ag-vtabs-gliding="1"]'));
    if (!isGlidingScoped) {
      assert.equal(
        /\bwill-change\s*:/i.test(rule.body),
        false,
        `Resting .ag-cs-vtabs-glide-bar must NOT set unconditional will-change: ${rule.prelude} { ${rule.body} }`
      );
    } else if (/will-change\s*:\s*transform\b/i.test(rule.body)) {
      hasScopedWillChange = true;
    }
  }
  assert.equal(hasScopedWillChange, true, 'CSS must scope will-change: transform strictly under [data-ag-vtabs-gliding="1"] .ag-cs-vtabs-glide-bar');

  // Trailing-slot, non-overlapping ready dot (3 states), .agy-hover-actions scrim removal, label hover mask & Obsidian Prism glass/rose-red/mono close button contracts
  // 1) Unified right-center trailing slot & zero-jitter hover cross-fade for .ag-cs-vtabs-ord
  const ordBaseRule = rules.find(
    (r) =>
      r.selectors.some(
        (s) =>
          getRightmostCompoundSelector(s) === '.ag-cs-vtabs-ord' &&
          !s.includes(':hover') &&
          !s.includes('[data-ag-vtabs-ready="1"]') &&
          !s.includes('[data-ag-cs-motion=')
      )
  );
  assert.ok(ordBaseRule, 'CSS must define base .ag-cs-vtabs-ord rule');
  assert.ok(/align-self\s*:\s*center\b/i.test(ordBaseRule.body), '.ag-cs-vtabs-ord must be vertically centered (align-self: center)');
  assert.ok(/min-height\s*:\s*18px\b/i.test(ordBaseRule.body), '.ag-cs-vtabs-ord must set min-height: 18px');
  assert.ok(/margin-top\s*:\s*0\b/i.test(ordBaseRule.body), '.ag-cs-vtabs-ord must set margin-top: 0');

  const ordHoverFadeRuleIdx = rules.findIndex(
    (r) =>
      r.selectors.some(
        (s) =>
          s.includes('[data-ag-vtabs-strip="1"]:not([data-ag-vtabs-collapsed="1"])') &&
          s.includes('[data-ag-vtabs-tab="1"]:is(:hover, :focus-visible)') &&
          getRightmostCompoundSelector(s) === '.ag-cs-vtabs-ord'
      )
  );
  const ordHoverFadeRule = ordHoverFadeRuleIdx >= 0 ? rules[ordHoverFadeRuleIdx] : null;
  assert.ok(ordHoverFadeRule, 'Expanded tab :is(:hover, :focus-visible) must cross-fade .ag-cs-vtabs-ord');
  assert.ok(/opacity\s*:\s*0\b/i.test(ordHoverFadeRule.body), 'Hover cross-fade on .ag-cs-vtabs-ord must set opacity: 0');
  assert.ok(/transform\s*:\s*scale\(\s*0\.84\s*\)/i.test(ordHoverFadeRule.body), 'Hover cross-fade on .ag-cs-vtabs-ord must set transform: scale(0.84)');
  assert.equal(/display\s*:\s*none\b/i.test(ordHoverFadeRule.body), false, 'Hover cross-fade on .ag-cs-vtabs-ord must NEVER use display: none (zero title shift)');
  // TS-3 / RS-3: keyboard-focus sibling cross-fade on close button without broad tab:focus-within or :has()
  assert.ok(
    ordHoverFadeRule.selectors.some((s) => s.includes('[data-ag-vtabs-tab="1"] .agy-hover-actions:focus-within ~ .ag-cs-vtabs-ord')),
    'TS-3/RS-3: .agy-hover-actions:focus-within ~ .ag-cs-vtabs-ord must cross-fade #n on keyboard focus'
  );
  assert.ok(
    ordHoverFadeRule.selectors.some((s) => s.includes('[data-ag-vtabs-tab="1"] > [data-ag-vtabs-close="1"]:focus-visible ~ .ag-cs-vtabs-ord')),
    'TS-3/RS-3: > [data-ag-vtabs-close="1"]:focus-visible ~ .ag-cs-vtabs-ord must cross-fade #n on direct-child close focus'
  );

  // 2) Non-overlapping ready dot across all 3 states: expanded multi-tab [dot #n], expanded singleton, collapsed 42px
  const readyOrdPillRule = rules.find(
    (r) =>
      r.selectors.some(
        (s) =>
          s.includes(':not([data-ag-vtabs-collapsed="1"])') &&
          s.includes('[data-ag-vtabs-ready="1"][data-ag-vtabs-ord]:not([data-ag-vtabs-caustic="1"])') &&
          getRightmostCompoundSelector(s) === '.ag-cs-vtabs-ord'
      ) && /\bgap\s*:\s*4px\b/i.test(r.body)
  );
  assert.ok(readyOrdPillRule, 'Expanded multi-tab ready .ag-cs-vtabs-ord pill must set gap: 4px');

  const readyOrdDotRuleIdx = rules.findIndex(
    (r) =>
      r.selectors.some(
        (s) =>
          s.includes(':not([data-ag-vtabs-collapsed="1"])') &&
          s.includes('[data-ag-vtabs-ready="1"][data-ag-vtabs-ord]:not([data-ag-vtabs-caustic="1"])') &&
          s.includes('.ag-cs-vtabs-ord::before')
      ) &&
      /\bwidth\s*:\s*5px\b/i.test(r.body) &&
      /\bheight\s*:\s*5px\b/i.test(r.body) &&
      /animation\s*:[^;]*ag-vtabs-ready-pulse/i.test(r.body)
  );
  assert.ok(readyOrdDotRuleIdx >= 0, 'Expanded multi-tab ready dot must render 5x5px pulsing .ag-cs-vtabs-ord::before');

  const readySingletonLabelRule = rules.find(
    (r) =>
      r.selectors.some(
        (s) =>
          s.includes(':not([data-ag-vtabs-collapsed="1"])') &&
          s.includes('[data-ag-vtabs-ready="1"]:not([data-ag-vtabs-ord])') &&
          s.includes('[data-ag-vtabs-label="1"]')
      ) && /padding-right\s*:\s*16px\b/i.test(r.body)
  );
  assert.ok(readySingletonLabelRule, 'Expanded singleton ready tab label must reserve padding-right: 16px');

  const readySingletonDotRuleIdx = rules.findIndex(
    (r) =>
      r.selectors.some(
        (s) =>
          s.includes(':not([data-ag-vtabs-collapsed="1"])') &&
          s.includes('[data-ag-vtabs-ready="1"]:not([data-ag-vtabs-ord]):not([data-ag-vtabs-caustic="1"])::before')
      ) &&
      /\bright\s*:\s*14px\b/i.test(r.body) &&
      /top\s*:\s*calc\(\s*50%\s*-\s*3px\s*\)/i.test(r.body)
  );
  assert.ok(readySingletonDotRuleIdx >= 0, 'Expanded singleton ready dot must sit concentrically at right: 14px; top: calc(50% - 3px)');

  const readySingletonHoverHideRule = rules.find(
    (r) =>
      r.selectors.some(
        (s) =>
          s.includes(':not([data-ag-vtabs-collapsed="1"])') &&
          s.includes('[data-ag-vtabs-ready="1"]:not([data-ag-vtabs-ord]):not([data-ag-vtabs-caustic="1"]):is(:hover, :focus-visible)::before')
      ) &&
      /opacity\s*:\s*0\b/i.test(r.body) &&
      /animation\s*:\s*none\b/i.test(r.body)
  );
  assert.ok(readySingletonHoverHideRule, 'Expanded singleton ready dot must fade out on :is(:hover, :focus-visible)');

  const collapsedReadyRuleIdx = rules.findIndex(
    (r) =>
      r.selectors.some(
        (s) =>
          s.includes('[data-ag-vtabs-collapsed="1"]') &&
          s.includes('[data-ag-vtabs-ready="1"]:not([data-ag-vtabs-caustic="1"])::before') &&
          !s.includes(':not([data-ag-vtabs-ord])')
      ) &&
      /content\s*:\s*""/i.test(r.body) &&
      /position\s*:\s*absolute\b/i.test(r.body) &&
      /\bright\s*:\s*4px\b/i.test(r.body) &&
      /\btop\s*:\s*4px\b/i.test(r.body) &&
      /animation\s*:[^;]*ag-vtabs-ready-pulse/i.test(r.body)
  );
  assert.ok(collapsedReadyRuleIdx >= 0, 'Collapsed 42px ready dot must explicitly set full corner dot props at right: 4px; top: 4px without :not([data-ag-vtabs-ord])');

  // 3) .agy-hover-actions scrim removal, z-index: 10, transform !important (RS-4), ZERO broad tab:focus-within, direct-child close parity & non-ordinal label hover mask
  const hoverActionsBaseRuleIdx = rules.findIndex(
    (r) =>
      r.selectors.some(
        (s) =>
          s.includes(':not([data-ag-vtabs-collapsed="1"])') &&
          getRightmostCompoundSelector(s) === '.agy-hover-actions' &&
          !s.includes(':hover') &&
          !s.includes(':focus-within')
      )
  );
  const hoverActionsBaseRule = hoverActionsBaseRuleIdx >= 0 ? rules[hoverActionsBaseRuleIdx] : null;
  assert.ok(hoverActionsBaseRule, 'CSS must define expanded .agy-hover-actions container rule');
  assert.ok(/\bz-index\s*:\s*10\s*!important/i.test(hoverActionsBaseRule.body), 'TS-3/RS-3: .agy-hover-actions must set z-index: 10 !important');
  assert.ok(/background\s*:\s*transparent\b/i.test(hoverActionsBaseRule.body), '.agy-hover-actions must strip native scrim via background: transparent');
  assert.ok(/background-color\s*:\s*transparent\b/i.test(hoverActionsBaseRule.body), '.agy-hover-actions must strip native scrim via background-color: transparent');
  assert.ok(/background-image\s*:\s*none\b/i.test(hoverActionsBaseRule.body), '.agy-hover-actions must strip native scrim via background-image: none');
  assert.ok(/opacity\s*:\s*0\b/i.test(hoverActionsBaseRule.body) && /pointer-events\s*:\s*none\b/i.test(hoverActionsBaseRule.body), '.agy-hover-actions must be hidden & non-interactive at rest');
  assert.ok(/transform\s*:\s*scale\(\s*0\.88\s*\)\s*!important/i.test(hoverActionsBaseRule.body), 'RS-4: .agy-hover-actions resting transform must carry !important');

  const hoverActionsRevealRuleIdx = rules.findIndex(
    (r) =>
      r.selectors.some((s) => s.includes('[data-ag-vtabs-tab="1"]:is(:hover, :focus-visible) .agy-hover-actions')) &&
      r.selectors.some((s) => s.includes('[data-ag-vtabs-tab="1"] .agy-hover-actions:focus-within')) &&
      /opacity\s*:\s*1\b/i.test(r.body) &&
      /pointer-events\s*:\s*auto\b/i.test(r.body)
  );
  const hoverActionsRevealRule = hoverActionsRevealRuleIdx >= 0 ? rules[hoverActionsRevealRuleIdx] : null;
  assert.ok(hoverActionsRevealRule, '.agy-hover-actions must reveal strictly on tab:is(:hover, :focus-visible) or .agy-hover-actions:focus-within');
  assert.ok(/transform\s*:\s*scale\(\s*1\s*\)\s*!important/i.test(hoverActionsRevealRule.body), 'RS-4: .agy-hover-actions revealed transform must carry !important');

  // Assert ZERO broad tab:focus-within anywhere in CSS (only .agy-hover-actions:focus-within is permitted!)
  for (const r of rules) {
    for (const s of r.selectors) {
      if (!s.includes(':focus-within')) continue;
      assert.equal(
        s.replace(/\.agy-hover-actions:focus-within/g, '').includes(':focus-within'),
        false,
        `Broad :focus-within forbidden (sticks after click!); only .agy-hover-actions:focus-within allowed, found: ${s}`
      );
    }
  }

  const directCloseBaseRule = rules.find(
    (r) =>
      r.selectors.some(
        (s) =>
          s.includes(':not([data-ag-vtabs-collapsed="1"])') &&
          s.includes('[data-ag-vtabs-tab="1"] > [data-ag-vtabs-close="1"]') &&
          !s.includes(':hover') &&
          !s.includes(':active') &&
          !s.includes(':focus-visible')
      ) &&
      /\bright\s*:\s*7px\b/i.test(r.body) &&
      /\btop\s*:\s*50%/i.test(r.body) &&
      /translateY\(\s*-50%\s*\)/i.test(r.body)
  );
  assert.ok(directCloseBaseRule, 'Direct-child > [data-ag-vtabs-close="1"] must align right-center (right: 7px; top: 50%; translateY(-50%))');

  const directCloseRevealRule = rules.find(
    (r) =>
      r.selectors.some((s) => s.includes('[data-ag-vtabs-tab="1"]:is(:hover, :focus-visible) > [data-ag-vtabs-close="1"]')) &&
      r.selectors.some((s) => s.includes('[data-ag-vtabs-tab="1"] > [data-ag-vtabs-close="1"]:focus-visible')) &&
      /opacity\s*:\s*1\b/i.test(r.body) &&
      /pointer-events\s*:\s*auto\b/i.test(r.body)
  );
  assert.ok(directCloseRevealRule, 'Direct-child > [data-ag-vtabs-close="1"] must reveal on tab:is(:hover, :focus-visible) or :focus-visible');

  const labelHoverMaskRule = rules.find(
    (r) =>
      r.selectors.some(
        (s) =>
          s.includes(':not([data-ag-vtabs-collapsed="1"])') &&
          s.includes('[data-ag-vtabs-tab="1"]:not([data-ag-vtabs-ord]):is(:hover, :focus-visible) [data-ag-vtabs-label="1"]')
      ) &&
      /-webkit-mask-image\s*:\s*linear-gradient\(/i.test(r.body) &&
      /(?:^|;|\s)mask-image\s*:\s*linear-gradient\(/i.test(r.body)
  );
  assert.ok(labelHoverMaskRule, 'Expanded non-ordinal hover label must apply -webkit-mask-image and mask-image soft fade');

  // 4) Obsidian Prism Glass / Light+Active Tint / Rose-Red / Mono / Unbreakable :focus-visible Close Micro-Button ([data-ag-vtabs-close="1"])
  const closeBaseRuleIdx = rules.findIndex(
    (r) =>
      r.selectors.some(
        (s) =>
          getRightmostCompoundSelector(s) === '[data-ag-vtabs-close="1"]' &&
          !s.includes(':hover') &&
          !s.includes(':active') &&
          !s.includes(':focus-visible') &&
          !s.includes('data-ag-vtabs-active') &&
          !s.includes('theme="light"') &&
          !s.includes('.theme-light') &&
          !s.includes('[data-ag-cs-motion=') &&
          !s.includes('>')
      )
  );
  const closeBaseRule = closeBaseRuleIdx >= 0 ? rules[closeBaseRuleIdx] : null;
  assert.ok(closeBaseRule, 'CSS must define base [data-ag-vtabs-close="1"] glass micro-button rule');
  assert.ok(/\bwidth\s*:\s*20px\b/i.test(closeBaseRule.body) && /\bheight\s*:\s*20px\b/i.test(closeBaseRule.body), 'Close button must be 20x20px');
  assert.ok(/\bborder\s*:/i.test(closeBaseRule.body) && /background-color\s*:/i.test(closeBaseRule.body) && /box-shadow\s*:/i.test(closeBaseRule.body), 'Close button must style glass border, background-color & box-shadow');

  const closeSvgRule = rules.find(
    (r) =>
      r.selectors.some((s) => s.includes('[data-ag-vtabs-close="1"] svg')) &&
      /\bwidth\s*:\s*12px\b/i.test(r.body) &&
      /\bheight\s*:\s*12px\b/i.test(r.body)
  );
  assert.ok(closeSvgRule, 'Close button nested svg must be sized 12x12px');

  const activeCloseRule = rules.find(
    (r) =>
      r.selectors.some(
        (s) =>
          !s.includes('theme="light"') &&
          !s.includes('.theme-light') &&
          s.includes('[data-ag-vtabs-active="1"]') &&
          getRightmostCompoundSelector(s) === '[data-ag-vtabs-close="1"]'
      ) &&
      /border-color\s*:[^;]*--ag-vtabs-cat-c/i.test(r.body) &&
      /background-color\s*:[^;]*--ag-vtabs-cat-c/i.test(r.body)
  );
  assert.ok(activeCloseRule, 'Active-tab close button must tint border-color & background-color with --ag-vtabs-cat-c');

  const lightCloseBaseIdx = rules.findIndex(
    (r) =>
      r.selectors.some((s) => s.includes('[data-ag-cs-theme="light"]') && !s.includes('data-ag-vtabs-active') && getRightmostCompoundSelector(s) === '[data-ag-vtabs-close="1"]') &&
      r.selectors.some((s) => s.includes('.theme-light') && !s.includes('data-ag-vtabs-active') && getRightmostCompoundSelector(s) === '[data-ag-vtabs-close="1"]') &&
      /#FFFFFF/i.test(r.body)
  );
  assert.ok(lightCloseBaseIdx >= 0, 'Light theme close button must define crystal white glass surface');

  // TS-2 / RS-2: Light + Active close button tint positioned AFTER Light resting and BEFORE Light :hover
  const lightActiveCloseIdx = rules.findIndex(
    (r) =>
      r.selectors.some((s) => s.includes('[data-ag-cs-theme="light"]') && s.includes('[data-ag-vtabs-active="1"]') && getRightmostCompoundSelector(s) === '[data-ag-vtabs-close="1"]') &&
      r.selectors.some((s) => s.includes('.theme-light') && s.includes('[data-ag-vtabs-active="1"]') && getRightmostCompoundSelector(s) === '[data-ag-vtabs-close="1"]') &&
      /border-color\s*:[^;]*--ag-vtabs-cat-c/i.test(r.body) &&
      /background-color\s*:[^;]*--ag-vtabs-cat-c[^;]*#FFFFFF/i.test(r.body)
  );
  assert.ok(lightActiveCloseIdx > lightCloseBaseIdx, 'TS-2/RS-2: Light+Active close tint must exist AFTER Light resting close rule');

  assert.equal(
    rules.some(
      (r) =>
        r.selectors.some((s) => (s.includes('[data-ag-cs-theme="light"]') || s.includes('.theme-light')) && s.includes('[data-ag-vtabs-close="1"]')) &&
        /opacity\s*:\s*0\.55\b/i.test(r.body)
    ),
    false,
    'Legacy Light theme opacity: 0.55 close dimming rule must be removed'
  );

  const darkCloseHoverIdx = rules.findIndex(
    (r) =>
      r.selectors.some(
        (s) =>
          !s.includes('theme="light"') &&
          !s.includes('.theme-light') &&
          !s.includes('accent="mono"') &&
          getRightmostCompoundSelector(s) === '[data-ag-vtabs-close="1"]:hover'
      ) &&
      /--destructive/i.test(r.body) &&
      /#F43F5E/i.test(r.body)
  );
  const lightCloseHoverIdx = rules.findIndex(
    (r) =>
      r.selectors.some((s) => s.includes('[data-ag-cs-theme="light"]') && !s.includes('accent="mono"') && getRightmostCompoundSelector(s) === '[data-ag-vtabs-close="1"]:hover') &&
      r.selectors.some((s) => s.includes('.theme-light') && !s.includes('accent="mono"') && getRightmostCompoundSelector(s) === '[data-ag-vtabs-close="1"]:hover') &&
      /#E11D48/i.test(r.body)
  );
  const monoCloseHoverIdx = rules.findIndex(
    (r) =>
      r.selectors.some((s) => s.includes('[data-ag-cs-accent="mono"]') && getRightmostCompoundSelector(s) === '[data-ag-vtabs-close="1"]:hover') &&
      r.selectors.some((s) => s.includes('[data-ag-cs-theme="light"][data-ag-cs-accent="mono"]') && getRightmostCompoundSelector(s) === '[data-ag-vtabs-close="1"]:hover') &&
      /var\(--foreground\)/i.test(r.body) &&
      /box-shadow\s*:\s*none\b/i.test(r.body)
  );
  assert.ok(darkCloseHoverIdx >= 0, 'Dark close button hover must apply restrained rose-red (#F43F5E)');
  assert.ok(lightCloseHoverIdx > lightActiveCloseIdx, 'Light close button hover must appear AFTER Light+Active close tint');
  assert.ok(monoCloseHoverIdx > lightCloseHoverIdx, 'Mono close button hover must appear AFTER Light rose-red hover so monochrome cascade wins in both Dark & Light');

  // TS-2 / RS-2: Unbreakable [data-ag-vtabs-close="1"]:focus-visible rules AFTER Mono :hover with opaque backing + focus ring
  const darkCloseFocusIdx = rules.findIndex(
    (r) =>
      r.selectors.some((s) => !s.includes('theme="light"') && !s.includes('.theme-light') && !s.includes('accent="mono"') && getRightmostCompoundSelector(s) === '[data-ag-vtabs-close="1"]:focus-visible') &&
      r.selectors.some((s) => !s.includes('theme="light"') && !s.includes('.theme-light') && s.includes('[data-ag-cs-accent="mono"]') && getRightmostCompoundSelector(s) === '[data-ag-vtabs-close="1"]:focus-visible') &&
      /outline\s*:\s*none\s*!important/i.test(r.body) &&
      /box-shadow\s*:\s*var\(--_fh2\)\s*!important/i.test(r.body) &&
      /opacity\s*:\s*1\s*!important/i.test(r.body) &&
      /background-color\s*:[^;]*94%/i.test(r.body)
  );
  const lightCloseFocusIdx = rules.findIndex(
    (r) =>
      r.selectors.some((s) => s.includes('[data-ag-cs-theme="light"]') && !s.includes('accent="mono"') && getRightmostCompoundSelector(s) === '[data-ag-vtabs-close="1"]:focus-visible') &&
      r.selectors.some((s) => s.includes('.theme-light') && !s.includes('accent="mono"') && getRightmostCompoundSelector(s) === '[data-ag-vtabs-close="1"]:focus-visible') &&
      r.selectors.some((s) => s.includes('[data-ag-cs-theme="light"][data-ag-cs-accent="mono"]') && getRightmostCompoundSelector(s) === '[data-ag-vtabs-close="1"]:focus-visible') &&
      r.selectors.some((s) => s.includes('[data-ag-cs-accent="mono"]') && s.includes('.theme-light') && getRightmostCompoundSelector(s) === '[data-ag-vtabs-close="1"]:focus-visible') &&
      /outline\s*:\s*none\s*!important/i.test(r.body) &&
      /box-shadow\s*:\s*var\(--_fh2\)\s*!important/i.test(r.body) &&
      /opacity\s*:\s*1\s*!important/i.test(r.body) &&
      /background-color\s*:[^;]*#FFFFFF\s+96%/i.test(r.body)
  );
  assert.ok(darkCloseFocusIdx > monoCloseHoverIdx, 'TS-2/RS-2: Dark/Mono close :focus-visible must appear AFTER Mono :hover with opaque backing & focus ring');
  assert.ok(lightCloseFocusIdx > monoCloseHoverIdx, 'TS-2/RS-2: Light/Light+Mono close :focus-visible must appear AFTER Mono :hover with opaque backing & focus ring');

  const closeActivePressRule = rules.find(
    (r) =>
      r.selectors.some((s) => getRightmostCompoundSelector(s) === '[data-ag-vtabs-close="1"]:active' && !s.includes('> [data-ag-vtabs-close="1"]:active')) &&
      /transform\s*:\s*scale\(\s*0\.92\s*\)/i.test(r.body)
  );
  const directCloseActivePressRule = rules.find(
    (r) =>
      r.selectors.some((s) => s.includes('> [data-ag-vtabs-close="1"]:active')) &&
      /transform\s*:\s*translateY\(\s*-50%\s*\)\s*scale\(\s*0\.92\s*\)/i.test(r.body)
  );
  assert.ok(closeActivePressRule, 'Close button :active must apply scale(0.92)');
  assert.ok(directCloseActivePressRule, 'Direct-child close button :active must apply translateY(-50%) scale(0.92)');

  // 5) TS-1 / RS-1: Real W3C Selectors Level 4 Specificity Dominance Audit for Motion Guards, Subtle & :focus-visible
  function cmpSpec(a, b) {
    return a[0] !== b[0] ? a[0] - b[0] : a[1] !== b[1] ? a[1] - b[1] : a[2] - b[2];
  }
  function calcSelectorSpecificity(sel) {
    let a = 0;
    let b = 0;
    let c = 0;
    const s = String(sel || '').trim();
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (/[\s>+~]/.test(ch)) { i += 1; continue; }
      if (ch === '*') { i += 1; continue; }
      if (ch === '#') {
        const m = /^#[a-zA-Z0-9_-]+/.exec(s.slice(i));
        a += 1;
        i += m ? m[0].length : 1;
        continue;
      }
      if (ch === '.') {
        const m = /^\.[a-zA-Z0-9_-]+/.exec(s.slice(i));
        b += 1;
        i += m ? m[0].length : 1;
        continue;
      }
      if (ch === '[') {
        let j = i + 1;
        let q = '';
        while (j < s.length) {
          if (q) { if (s[j] === '\\') j += 2; else if (s[j] === q) { q = ''; j += 1; } else j += 1; }
          else if (s[j] === '"' || s[j] === "'") { q = s[j]; j += 1; }
          else if (s[j] === ']') { j += 1; break; }
          else j += 1;
        }
        b += 1;
        i = j;
        continue;
      }
      if (ch === ':' && s[i + 1] === ':') {
        const m = /^::[a-zA-Z0-9_-]+/.exec(s.slice(i));
        c += 1;
        i += m ? m[0].length : 2;
        continue;
      }
      if (ch === ':') {
        const m = /^:([a-zA-Z0-9_-]+)/.exec(s.slice(i));
        const fnName = m ? m[1].toLowerCase() : '';
        i += m ? m[0].length : 1;
        if (s[i] === '(') {
          let depth = 1;
          let j = i + 1;
          let q = '';
          while (j < s.length && depth > 0) {
            if (q) { if (s[j] === '\\') j += 2; else if (s[j] === q) { q = ''; j += 1; } else j += 1; }
            else if (s[j] === '"' || s[j] === "'") { q = s[j]; j += 1; }
            else if (s[j] === '(') { depth += 1; j += 1; }
            else if (s[j] === ')') { depth -= 1; j += 1; }
            else j += 1;
          }
          const inner = s.slice(i + 1, j - 1);
          i = j;
          if (fnName === 'where') {
            // :where() contributes (0,0,0)
          } else if (fnName === 'is' || fnName === 'not') {
            let best = [0, 0, 0];
            for (const arg of splitTopLevelCommas(inner)) {
              const sp = calcSelectorSpecificity(arg);
              if (cmpSpec(sp, best) > 0) best = sp;
            }
            a += best[0];
            b += best[1];
            c += best[2];
          } else {
            b += 1;
          }
        } else {
          b += 1;
        }
        continue;
      }
      if (/[a-zA-Z_-]/.test(ch)) {
        const m = /^[a-zA-Z0-9_-]+/.exec(s.slice(i));
        c += 1;
        i += m ? m[0].length : 1;
        continue;
      }
      i += 1;
    }
    return [a, b, c];
  }
  function maxRuleSpec(rule, pred = () => true) {
    let best = [0, 0, 0];
    for (const s of rule.selectors) {
      if (!pred(s)) continue;
      const sp = calcSelectorSpecificity(s);
      if (cmpSpec(sp, best) > 0) best = sp;
    }
    return best;
  }
  function assertDominates(guardIdx, guardPred, baseIdx, basePred, label) {
    assert.ok(guardIdx > baseIdx, `${label}: guard rule (#${guardIdx}) must appear AFTER base rule (#${baseIdx})`);
    const gSpec = maxRuleSpec(rules[guardIdx], guardPred);
    const bSpec = maxRuleSpec(rules[baseIdx], basePred);
    assert.ok(
      cmpSpec(gSpec, bSpec) >= 0,
      `${label}: guard specificity (${gSpec.join(',')}) must be >= base specificity (${bSpec.join(',')})`
    );
  }

  // Subtle rule assertions & dominance over ord/hover-actions transforms (RS-3/RS-4)
  const subtleOrdRuleIdx = rules.findIndex(
    (r) =>
      r.selectors.some((s) => s.includes('[data-ag-cs-motion="subtle"]') && s.includes('.ag-cs-vtabs-ord') && s.includes('.agy-hover-actions')) &&
      /transform\s*:\s*none\s*!important/i.test(r.body)
  );
  assert.ok(subtleOrdRuleIdx >= 0, 'subtle motion guard must cover .ag-cs-vtabs-ord & .agy-hover-actions with transform: none !important');
  assertDominates(subtleOrdRuleIdx, () => true, ordHoverFadeRuleIdx, () => true, 'subtle transform:none vs ord hover/focus-within fade');
  assertDominates(subtleOrdRuleIdx, () => true, hoverActionsBaseRuleIdx, () => true, 'subtle transform:none vs .agy-hover-actions base');
  assertDominates(subtleOrdRuleIdx, () => true, hoverActionsRevealRuleIdx, () => true, 'subtle transform:none vs .agy-hover-actions reveal');

  // Subtle split ready-dot animation: none guard (keeping singleton transition intact in subtle)
  const subtleReadyAnimIdx = rules.findIndex(
    (r) =>
      r.selectors.some((s) => s.includes('[data-ag-cs-motion="subtle"]') && s.includes('[data-ag-vtabs-ready="1"]') && s.includes('::before') && !s.includes('.ag-cs-vtabs-ord::before')) &&
      r.selectors.some((s) => s.includes('[data-ag-cs-motion="subtle"]') && s.includes('.ag-cs-vtabs-ord::before')) &&
      /animation\s*:\s*none\s*!important/i.test(r.body) &&
      !/transition\s*:\s*none/i.test(r.body)
  );
  assert.ok(subtleReadyAnimIdx >= 0, 'TS-1/RS-1: subtle ready-dot guard must be split as animation: none !important (preserving subtle transition)');
  assertDominates(subtleReadyAnimIdx, (s) => !s.includes('.ag-cs-vtabs-ord::before'), readySingletonDotRuleIdx, () => true, 'subtle ready tab::before vs singleton dot');
  assertDominates(subtleReadyAnimIdx, (s) => !s.includes('.ag-cs-vtabs-ord::before'), collapsedReadyRuleIdx, () => true, 'subtle ready tab::before vs collapsed dot');
  assertDominates(subtleReadyAnimIdx, (s) => s.includes('.ag-cs-vtabs-ord::before'), readyOrdDotRuleIdx, () => true, 'subtle ready .ord::before vs multi-tab dot');

  // Unified off / perf-mode win-blur / dragging guard (BOTH transition: none !important AND animation: none !important)
  const offDragGuardIdx = rules.findIndex(
    (r) =>
      !r.media &&
      r.selectors.some((s) => s.includes('[data-ag-cs-motion="off"]') && s.includes('.ag-cs-vtabs-ord') && s.includes('.agy-hover-actions') && s.includes('[data-ag-vtabs-close="1"]')) &&
      r.selectors.some((s) => s.includes('[data-ag-vtabs-dragging="1"]') && s.includes('.ag-cs-vtabs-ord') && s.includes('.agy-hover-actions') && s.includes('[data-ag-vtabs-close="1"]')) &&
      r.selectors.some((s) => s.includes('[data-ag-cs-motion="off"]') && s.includes('.ag-cs-vtabs-ord::before')) &&
      r.selectors.some((s) => s.includes('[data-ag-vtabs-dragging="1"]') && s.includes('.ag-cs-vtabs-ord::before')) &&
      /transition\s*:\s*none\s*!important/i.test(r.body) &&
      /animation\s*:\s*none\s*!important/i.test(r.body)
  );
  assert.ok(offDragGuardIdx >= 0, 'TS-1/RS-1: off/dragging guard must set BOTH transition: none !important and animation: none !important on all interactive & ready-dot targets');

  // Perf-mode-scoped win-blur guard (may be unified inside offDragGuardIdx OR a dedicated rule; MUST require performance/eco perf-mode)
  const winBlurPerfGuardIdx = rules.findIndex(
    (r) =>
      !r.media &&
      r.selectors.some(
        (s) =>
          s.includes('[data-ag-cs-win-blur="1"]') &&
          (s.includes('[data-ag-cs-perf-mode="performance"]') || s.includes('[data-ag-cs-perf-mode="eco"]')) &&
          s.includes('.ag-cs-vtabs-ord') &&
          s.includes('.agy-hover-actions') &&
          s.includes('[data-ag-vtabs-close="1"]')
      ) &&
      r.selectors.some(
        (s) =>
          s.includes('[data-ag-cs-win-blur="1"]') &&
          (s.includes('[data-ag-cs-perf-mode="performance"]') || s.includes('[data-ag-cs-perf-mode="eco"]')) &&
          s.includes('.ag-cs-vtabs-ord::before')
      ) &&
      /transition\s*:\s*none\s*!important/i.test(r.body) &&
      /animation\s*:\s*none\s*!important/i.test(r.body)
  );
  assert.ok(winBlurPerfGuardIdx >= 0, 'AGENTS.md §二.3: perf-mode-scoped win-blur guard must set BOTH transition: none !important and animation: none !important');

  // @media (prefers-reduced-motion: reduce) guard with :not([data-ag-cs-ignore-rm="1"]) (BOTH transition: none !important AND animation: none !important)
  const reducedMotionGuardIdx = rules.findIndex(
    (r) =>
      r.media.includes('prefers-reduced-motion: reduce') &&
      r.selectors.every((s) => s.includes(':not([data-ag-cs-ignore-rm="1"])')) &&
      r.selectors.some((s) => s.includes('.ag-cs-vtabs-ord') && s.includes('.agy-hover-actions') && s.includes('[data-ag-vtabs-close="1"]')) &&
      r.selectors.some((s) => s.includes('[data-ag-vtabs-ready="1"]') && s.includes('::before') && !s.includes('.ag-cs-vtabs-ord::before')) &&
      r.selectors.some((s) => s.includes('.ag-cs-vtabs-ord::before')) &&
      /transition\s*:\s*none\s*!important/i.test(r.body) &&
      /animation\s*:\s*none\s*!important/i.test(r.body)
  );
  assert.ok(reducedMotionGuardIdx >= 0, 'TS-1/RS-1/Issue #101: @media (prefers-reduced-motion: reduce) guard must include :not([data-ag-cs-ignore-rm="1"]) and set BOTH transition: none !important and animation: none !important across all interactive & ready-dot targets');

  const tabBaseIdx = rules.findIndex(
    (r) => r.selectors.some((s) => getRightmostCompoundSelector(s) === '[data-ag-vtabs-tab="1"]' && !s.includes('[data-ag-vtabs-collapsed="1"]') && !s.includes('[data-ag-cs-motion=')) && /transition\s*:/i.test(r.body)
  );
  const tabAfterBaseIdx = rules.findIndex(
    (r) => r.selectors.some((s) => getRightmostCompoundSelector(s) === '[data-ag-vtabs-tab="1"]::after' && !s.includes('[data-ag-cs-motion=')) && /transition\s*:/i.test(r.body)
  );
  const subtleTabRuleIdx = rules.findIndex(
    (r) => r.selectors.some((s) => s.includes('[data-ag-cs-motion="subtle"]') && getRightmostCompoundSelector(s) === '[data-ag-vtabs-tab="1"]::after')
  );
  const subtleCloseRuleIdx = rules.findIndex(
    (r) => r.selectors.some((s) => s.includes('[data-ag-cs-motion="subtle"]') && getRightmostCompoundSelector(s) === '[data-ag-vtabs-close="1"]')
  );
  const ordBaseRuleIdx = rules.indexOf(ordBaseRule);

  // Verify W3C Selectors Level 4 dominance for off, perf-mode win-blur, dragging, AND prefers-reduced-motion(:not(ignore-rm)) against EVERY base & subtle rule!
  for (const [gName, gIdx, mode] of [
    ['off', offDragGuardIdx, 'off'],
    ['win-blur(perf)', winBlurPerfGuardIdx, 'blur'],
    ['dragging', offDragGuardIdx, 'drag'],
    ['prefers-reduced-motion', reducedMotionGuardIdx, 'rm'],
  ]) {
    const scopePred = (s) =>
      mode === 'drag'
        ? s.includes('[data-ag-vtabs-dragging="1"]')
        : mode === 'off'
          ? s.includes('[data-ag-cs-motion="off"]')
          : mode === 'blur'
            ? s.includes('[data-ag-cs-win-blur="1"]')
            : true;
    assertDominates(gIdx, (s) => scopePred(s) && s.includes('[data-ag-vtabs-tab="1"]') && !s.includes('::') && !s.includes('.agy-hover-actions'), tabBaseIdx, () => true, `${gName} vs tab base`);
    assertDominates(gIdx, (s) => scopePred(s) && s.includes('[data-ag-vtabs-tab="1"]') && !s.includes('::') && !s.includes('.agy-hover-actions'), subtleTabRuleIdx, (s) => !s.includes('::after'), `${gName} vs subtle tab`);
    assertDominates(gIdx, (s) => scopePred(s) && s.includes('[data-ag-vtabs-tab="1"]::after'), tabAfterBaseIdx, () => true, `${gName} vs tab::after base`);
    assertDominates(gIdx, (s) => scopePred(s) && s.includes('[data-ag-vtabs-tab="1"]::after'), subtleTabRuleIdx, (s) => s.includes('::after'), `${gName} vs subtle tab::after`);
    assertDominates(gIdx, (s) => scopePred(s) && s.includes('.ag-cs-vtabs-ord') && s.includes('.agy-hover-actions'), ordBaseRuleIdx, () => true, `${gName} vs .ord base`);
    assertDominates(gIdx, (s) => scopePred(s) && s.includes('.ag-cs-vtabs-ord') && s.includes('.agy-hover-actions'), hoverActionsBaseRuleIdx, () => true, `${gName} vs .agy-hover-actions base`);
    assertDominates(gIdx, (s) => scopePred(s) && s.includes('.ag-cs-vtabs-ord') && s.includes('.agy-hover-actions'), closeBaseRuleIdx, () => true, `${gName} vs close base`);
    assertDominates(gIdx, (s) => scopePred(s) && s.includes('.ag-cs-vtabs-ord') && s.includes('.agy-hover-actions'), subtleOrdRuleIdx, () => true, `${gName} vs subtle .ord/.agy-hover-actions`);
    assertDominates(gIdx, (s) => scopePred(s) && s.includes('.ag-cs-vtabs-ord') && s.includes('.agy-hover-actions'), subtleCloseRuleIdx, () => true, `${gName} vs subtle close`);
    assertDominates(gIdx, (s) => scopePred(s) && s.includes('[data-ag-vtabs-ready="1"]') && s.includes('::before') && !s.includes('.ag-cs-vtabs-ord::before'), readySingletonDotRuleIdx, () => true, `${gName} vs singleton ready dot`);
    assertDominates(gIdx, (s) => scopePred(s) && s.includes('[data-ag-vtabs-ready="1"]') && s.includes('::before') && !s.includes('.ag-cs-vtabs-ord::before'), collapsedReadyRuleIdx, () => true, `${gName} vs collapsed ready dot`);
    assertDominates(gIdx, (s) => scopePred(s) && s.includes('.ag-cs-vtabs-ord::before'), readyOrdDotRuleIdx, () => true, `${gName} vs multi-tab ready .ord::before`);
  }

  // Verify W3C Selectors Level 4 dominance for :focus-visible over Dark / Light / Mono :hover!
  assertDominates(darkCloseFocusIdx, (s) => !s.includes('accent="mono"'), darkCloseHoverIdx, () => true, 'Dark close :focus-visible vs Dark :hover');
  assertDominates(darkCloseFocusIdx, (s) => s.includes('accent="mono"'), monoCloseHoverIdx, (s) => !s.includes('theme="light"') && !s.includes('.theme-light'), 'Dark+Mono close :focus-visible vs Dark+Mono :hover');
  assertDominates(lightCloseFocusIdx, (s) => s.includes('[data-ag-cs-theme="light"]') && !s.includes('accent="mono"'), lightCloseHoverIdx, (s) => s.includes('[data-ag-cs-theme="light"]'), 'Light attr close :focus-visible vs Light attr :hover');
  assertDominates(lightCloseFocusIdx, (s) => s.includes('.theme-light') && !s.includes('accent="mono"'), lightCloseHoverIdx, (s) => s.includes('.theme-light'), 'Light body close :focus-visible vs Light body :hover');
  assertDominates(lightCloseFocusIdx, (s) => s.includes('[data-ag-cs-theme="light"][data-ag-cs-accent="mono"]'), monoCloseHoverIdx, (s) => s.includes('[data-ag-cs-theme="light"][data-ag-cs-accent="mono"]'), 'Light+Mono attr close :focus-visible vs Light+Mono attr :hover');
  assertDominates(lightCloseFocusIdx, (s) => s.includes('.theme-light') && s.includes('accent="mono"'), monoCloseHoverIdx, (s) => s.includes('.theme-light') && s.includes('accent="mono"'), 'Light+Mono body close :focus-visible vs Light+Mono body :hover');

  // Red-team #168 #2: Active & inactive [data-ag-vtabs-tab="1"]:focus-visible MUST dominate Dark / Light attr / body.theme-light active & active:hover box-shadow rules!
  const tabFocusRingIdxs = [];
  for (let ri = 0; ri < rules.length; ri++) {
    const r = rules[ri];
    if (
      !r.media &&
      /outline\s*:\s*none\s*!important/i.test(r.body) &&
      /box-shadow\s*:\s*var\(--_fh2\)\s*!important/i.test(r.body) &&
      r.selectors.some((s) => {
        const sub = getRightmostCompoundSelector(s);
        return sub.includes('[data-ag-vtabs-tab="1"]') && sub.includes(':focus-visible') && !sub.includes('::');
      })
    ) {
      tabFocusRingIdxs.push(ri);
    }
  }
  assert.ok(tabFocusRingIdxs.length >= 1, '#168 #2: Must define [data-ag-vtabs-tab="1"]:focus-visible rule with outline: none !important and box-shadow: var(--_fh2) !important');

  const isTabBoxShadowRule = (r) =>
    !r.media &&
    /box-shadow\s*:/i.test(r.body) &&
    !/var\(--_fh2\)/i.test(r.body) &&
    r.selectors.some((s) => {
      const sub = getRightmostCompoundSelector(s);
      return (
        sub.includes('[data-ag-vtabs-tab="1"]') &&
        !sub.includes('::') &&
        !sub.includes(':focus-visible') &&
        (sub.includes('[data-ag-vtabs-active="1"]') || sub.includes('[aria-selected="true"]'))
      );
    });
  const activeTabBoxShadowIdxs = [];
  for (let ri = 0; ri < rules.length; ri++) {
    if (isTabBoxShadowRule(rules[ri])) activeTabBoxShadowIdxs.push(ri);
  }
  assert.ok(activeTabBoxShadowIdxs.length >= 2, '#168 #2: Expected Dark + Light active-tab box-shadow rules to audit against :focus-visible');

  for (const baseIdx of activeTabBoxShadowIdxs) {
    for (const baseSel of rules[baseIdx].selectors) {
      const sub = getRightmostCompoundSelector(baseSel);
      if (!sub.includes('[data-ag-vtabs-tab="1"]') || sub.includes('::') || sub.includes(':focus-visible')) continue;
      const baseSpec = calcSelectorSpecificity(baseSel);
      const isLightAttr = baseSel.includes('[data-ag-cs-theme="light"]');
      const isBodyLight = baseSel.includes('.theme-light');
      const isHover = sub.includes(':hover');
      const matchesTheme = (fs) =>
        isLightAttr
          ? fs.includes('[data-ag-cs-theme="light"]') || (!fs.includes('.theme-light') && cmpSpec(calcSelectorSpecificity(fs), baseSpec) >= 0)
          : isBodyLight
            ? fs.includes('.theme-light') || (!fs.includes('[data-ag-cs-theme="light"]') && cmpSpec(calcSelectorSpecificity(fs), baseSpec) >= 0)
            : !fs.includes('[data-ag-cs-theme="light"]') && !fs.includes('.theme-light');
      const winner = tabFocusRingIdxs.some((fi) => {
        if (fi <= baseIdx) return false;
        return rules[fi].selectors.some((fs) => {
          const fSub = getRightmostCompoundSelector(fs);
          if (!fSub.includes('[data-ag-vtabs-tab="1"]') || !fSub.includes(':focus-visible') || fSub.includes('::')) return false;
          if (!matchesTheme(fs)) return false;
          const requiresHover = fSub.includes(':hover') && !/:is\([^)]*:focus-visible\s*,/.test(fSub);
          if (requiresHover && !isHover) return false;
          return cmpSpec(calcSelectorSpecificity(fs), baseSpec) >= 0;
        });
      });
      assert.equal(
        winner,
        true,
        `#168 #2: Active tab :focus-visible ring must dominate rule #${baseIdx} (${baseSpec.join(',')}) ${baseSel}`
      );
    }
  }

  // Live Desktop Fix Pass CSS assertions: [data-ag-vtabs-active="1"] on EVERY active-tab rule, collapsed .agy-hover-actions hidden, glide bar z-index: 8
  const ariaActiveRules = rules.filter((r) => r.selectors.some((s) => s.includes('[aria-selected="true"]')));
  assert.ok(ariaActiveRules.length >= 4, 'Expected active-tab CSS rules matching [aria-selected="true"]');
  for (const r of ariaActiveRules) {
    assert.ok(
      r.prelude.includes('[data-ag-vtabs-active="1"]'),
      `Every active-tab CSS rule must also match [data-ag-vtabs-active="1"]: ${r.prelude}`
    );
  }
  const collapsedHoverActionsRule = rules.find(
    (r) =>
      r.selectors.some((s) => s.includes('[data-ag-vtabs-collapsed="1"]') && s.includes('.agy-hover-actions')) &&
      /display\s*:\s*none\b/i.test(r.body)
  );
  assert.ok(collapsedHoverActionsRule, 'Collapsed mode must hide .agy-hover-actions with display: none');
  const glideBarZRule = rules.find(
    (r) =>
      r.selectors.some((s) => getRightmostCompoundSelector(s).includes('.ag-cs-vtabs-glide-bar')) &&
      /\bz-index\s*:\s*8\b/i.test(r.body)
  );
  assert.ok(glideBarZRule, '.ag-cs-vtabs-glide-bar must set z-index: 8');

  // LIVE-1 regression: all 6 trigger/icon/collapsed rules must match > button:is([role="tab"], [data-tab-id]) (0 bare > button[role="tab"] left!)
  assert.equal(
    />\s*button\[role="tab"\]/.test(css),
    false,
    'LIVE-1: CSS must not retain bare > button[role="tab"] selectors that miss authentic Zvd <button data-tab-id>'
  );
  const zvdTriggerMatches = css.match(/>\s*button:is\(\[role="tab"\],\s*\[data-tab-id\]\)/g) || [];
  assert.ok(
    zvdTriggerMatches.length >= 6,
    `LIVE-1: all 6 trigger/icon/collapsed rules must use > button:is([role="tab"], [data-tab-id]), found ${zvdTriggerMatches.length}`
  );
});

// ── 14. Addendum Enhancement 1: Draggable Sash Resizing, Clamping, Snap-Collapse, Dblclick, Narrow Lock, Storage Sync & Browser Hole Pointer Capture ──
test('14. Addendum Enhancement 1: draggable sash resizing, bounds/responsive clamping, snap-collapse, dblclick reset, narrow lock, storage sync & Browser Hole pointer capture', () => {
  const vtabsMod = loadVerticalTabsModule();
  const cssText = readVerticalTabsCss();

  assert.equal(vtabsMod.STORAGE_WIDTH_KEY, STORAGE_WIDTH_KEY);
  assert.equal(vtabsMod.MIN_EXPANDED_WIDTH_PX, 120);
  assert.equal(vtabsMod.MAX_EXPANDED_WIDTH_PX, 320);
  assert.equal(vtabsMod.SNAP_COLLAPSE_WIDTH_PX, 88);

  const env = createRichMockDom({ lang: 'en' });
  const fx = buildRightSidePanelFixture(env, { topology: 'nested', hostWidth: 700 });
  const initialBodyChildren = env.body.children.length;

  let resizeEvents = 0;
  env.win.addEventListener('resize', () => { resizeEvents += 1; });

  const makeCtl = () =>
    vtabsMod.createSidePanelVerticalTabsController({
      win: env.win,
      doc: env.doc,
      storage: env.storage,
      cssText,
      getLang: () => 'en',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
    });

  let ctl = makeCtl();
  ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
  env.flushRaf();

  // S-1 BLOCKER regression: Blink 'style' MutationRecords from --ag-vtabs-w MUST cause 0 self-inflicted rAF / scanAndSync feedback loops
  const settleMount = env.drainMutationsAndRaf(12);
  assert.equal(settleMount.saturated, false, 'Initial mount must not trigger an infinite style MO -> rAF feedback loop');
  assert.equal(settleMount.rafFrames, 0, 'Initial mount must settle with 0 extra self-inflicted rAF frames');

  // Sash owned + 5+1 no-translate attrs, role="separator", zero overlay over body; .ag-cs-vtabs-head still has ONLY .ag-cs-vtabs-toggle
  const headEl = fx.strip.querySelector('.ag-cs-vtabs-head');
  const toggleBtn = fx.strip.querySelector('.ag-cs-vtabs-toggle');
  const sashEl = fx.strip.querySelector('.ag-cs-vtabs-sash');
  const sashLineEl = sashEl?.querySelector('.ag-cs-vtabs-sash-line');
  assert.equal(headEl.children.length, 1, '.ag-cs-vtabs-head must contain ONLY the single toggle button');
  assert.equal(headEl.firstElementChild, toggleBtn);
  assertOwnedAndNoTranslate(sashEl, '.ag-cs-vtabs-sash');
  assertOwnedAndNoTranslate(sashLineEl, '.ag-cs-vtabs-sash-line');
  assert.equal(sashEl.getAttribute('role'), 'separator');
  assert.equal(sashEl.getAttribute('aria-orientation'), 'vertical');
  assert.equal(fx.panelBody.querySelectorAll('[data-ag-owned="1"]').length, 0, 'Must NEVER mount overlay over [data-side-panel-body]');

  assert.equal(ctl.getState().expandedWidth, 180);
  assert.equal(ctl.getState().effectiveWidth, 180);
  assert.equal(ctl.getState().dragging, false);
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '180px');
  assert.equal(fx.strip.style.getPropertyValue('--ag-vtabs-w'), '180px');

  // S-1 regression on width change & collapse/expand: 0 extra self-inflicted rAF loops
  ctl.setExpandedWidth(240);
  const settleWidth = env.drainMutationsAndRaf(12);
  assert.equal(settleWidth.saturated, false, 'setExpandedWidth must not trigger a style MO feedback loop');
  assert.equal(settleWidth.rafFrames, 0, 'setExpandedWidth must schedule 0 extra self-inflicted rAF frames');
  toggleBtn.click();
  env.flushRaf();
  const settleCollapse = env.drainMutationsAndRaf(12);
  assert.equal(settleCollapse.saturated, false, 'Collapse toggle must not trigger a style MO feedback loop');
  assert.equal(settleCollapse.rafFrames, 0, 'Collapse toggle must settle with 0 extra self-inflicted rAF frames');
  toggleBtn.click();
  env.flushRaf();
  ctl.setExpandedWidth(180);
  env.drainMutationsAndRaf(12);

  // Invalid / NaN / out-of-range persisted localStorage widths ('abc', '50', '999') must fall back cleanly to 180px
  for (const badVal of ['abc', '50', '999', 'NaN']) {
    const badEnv = createRichMockDom({ lang: 'en', initialStorage: { [STORAGE_WIDTH_KEY]: badVal } });
    const badFx = buildRightSidePanelFixture(badEnv, { topology: 'nested', hostWidth: 700 });
    const badCtl = vtabsMod.createSidePanelVerticalTabsController({
      win: badEnv.win,
      doc: badEnv.doc,
      storage: badEnv.storage,
      cssText,
      getLang: () => 'en',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
    });
    badCtl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
    badEnv.flushRaf();
    assert.equal(badCtl.getState().expandedWidth, 180, `Invalid stored width "${badVal}" must fall back to 180px`);
    assert.equal(badFx.host.style.getPropertyValue('--ag-vtabs-w'), '180px', `Invalid stored width "${badVal}" must render --ag-vtabs-w: 180px`);
    badCtl.destroy();
  }

  // Helper to simulate pointer drag on sash
  const dragSash = (startX, endX, pointerId = 1) => {
    const downEv = new env.MockEvent('pointerdown', { bubbles: true, cancelable: true, pointerId, button: 0, clientX: startX });
    sashEl.dispatchEvent(downEv);
    const moveEv = new env.MockEvent('pointermove', { bubbles: true, cancelable: true, pointerId, clientX: endX });
    sashEl.dispatchEvent(moveEv);
    env.flushRaf();
    const upEv = new env.MockEvent('pointerup', { bubbles: true, cancelable: true, pointerId, clientX: endX });
    sashEl.dispatchEvent(upEv);
    env.flushRaf();
  };

  // Drag left (+80px): 180 -> 260px, persists to localStorage (and 0 self-inflicted MO loop during drag)
  sashEl.dispatchEvent(new env.MockEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: 520 }));
  sashEl.dispatchEvent(new env.MockEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 1, clientX: 440 }));
  env.flushRaf();
  const settleDrag = env.drainMutationsAndRaf(12);
  assert.equal(settleDrag.saturated, false, 'Active sash drag must not trigger a style MO feedback loop');
  assert.equal(settleDrag.rafFrames, 0, 'Active sash drag must queue 0 extra self-inflicted scanAndSync rAF frames');
  sashEl.dispatchEvent(new env.MockEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, clientX: 440 }));
  env.flushRaf();
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '260px');
  assert.equal(fx.strip.style.getPropertyValue('--ag-vtabs-w'), '260px');
  assert.equal(env.storage.getItem(STORAGE_WIDTH_KEY), '260');
  assert.equal(ctl.getState().expandedWidth, 260);
  assert.equal(ctl.getState().effectiveWidth, 260);
  assert.equal(ctl.getState().dragging, false);

  // Active drag cap at Math.floor(hostWidth * 0.5): hostWidth=500 -> max 250px even when dragging further left
  env.triggerResize(fx.host, 500);
  dragSash(450, 100, 11);
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '250px', 'Active drag must cap width at floor(hostWidth * 0.5) = 250px');
  assert.equal(ctl.getState().effectiveWidth, 250);
  assert.equal(ctl.getState().expandedWidth, 250);
  assert.equal(env.storage.getItem(STORAGE_WIDTH_KEY), '250');
  env.triggerResize(fx.host, 700);

  // Drag past max (hostWidth=700 -> max=320): clamps to 320px
  dragSash(520, 200, 2);
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '320px');
  assert.equal(env.storage.getItem(STORAGE_WIDTH_KEY), '320');

  // Drag into 88..119 band (rawW=100): clamps to 120px
  dragSash(400, 620, 3); // 320 + (400 - 620) = 100 -> clamped to 120
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '120px');
  assert.equal(env.storage.getItem(STORAGE_WIDTH_KEY), '120');

  // Survives controller reload
  ctl.destroy();
  ctl = makeCtl();
  ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
  env.flushRaf();
  assert.equal(ctl.getState().expandedWidth, 120, 'Custom width must persist across controller reload');
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '120px');

  // setExpandedWidth(px) clamps & persists cleanly
  ctl.setExpandedWidth(999);
  assert.equal(ctl.getState().expandedWidth, 320);
  assert.equal(env.storage.getItem(STORAGE_WIDTH_KEY), '320');
  ctl.setExpandedWidth(50);
  assert.equal(ctl.getState().expandedWidth, 120);
  assert.equal(env.storage.getItem(STORAGE_WIDTH_KEY), '120');
  ctl.setExpandedWidth(280);
  assert.equal(ctl.getState().expandedWidth, 280);
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '280px');
  assert.equal(env.storage.getItem(STORAGE_WIDTH_KEY), '280');

  // Responsive narrowing (host still >= 420: 700 -> 480 -> effective max 240) clamps WITHOUT mutating localStorage; widening to 700 restores 280
  env.resetRectReads();
  env.triggerResize(fx.host, 480);
  assert.equal(env.totalRectReads, 0, 'Responsive width clamping inside RO must perform 0 sync rect reads');
  assert.equal(ctl.getState().effectiveWidth, 240);
  assert.equal(ctl.getState().expandedWidth, 280);
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '240px');
  assert.equal(env.storage.getItem(STORAGE_WIDTH_KEY), '280', 'Responsive narrowing must NOT overwrite persisted width');

  env.resetRectReads();
  env.triggerResize(fx.host, 700);
  assert.equal(env.totalRectReads, 0);
  assert.equal(ctl.getState().effectiveWidth, 280);
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '280px');

  // Re-query sash & toggle on reloaded controller
  const sash2 = fx.strip.querySelector('.ag-cs-vtabs-sash');
  const toggle2 = fx.strip.querySelector('.ag-cs-vtabs-toggle');
  const dragSash2 = (startX, endX, pointerId = 4) => {
    sash2.dispatchEvent(new env.MockEvent('pointerdown', { bubbles: true, cancelable: true, pointerId, button: 0, clientX: startX }));
    sash2.dispatchEvent(new env.MockEvent('pointermove', { bubbles: true, cancelable: true, pointerId, clientX: endX }));
    env.flushRaf();
    sash2.dispatchEvent(new env.MockEvent('pointerup', { bubbles: true, cancelable: true, pointerId, clientX: endX }));
    env.flushRaf();
  };

  // window 'blur' mid-drag must cancel cleanly: dragging=false, attrs cleared, 0 leaked win listeners, original width & storage restored
  const dragWinTypes = ['pointermove', 'pointerup', 'pointercancel', 'blur'];
  const winDragListenersBefore = env.countWinListeners(dragWinTypes);
  const preBlurW = ctl.getState().expandedWidth;
  const preBlurStored = env.storage.getItem(STORAGE_WIDTH_KEY);
  sash2.dispatchEvent(new env.MockEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 12, button: 0, clientX: 500 }));
  sash2.dispatchEvent(new env.MockEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 12, clientX: 560 }));
  env.flushRaf();
  assert.equal(ctl.getState().dragging, true);
  assert.equal(fx.host.getAttribute('data-ag-vtabs-dragging'), '1');
  env.win.dispatchEvent(new env.MockEvent('blur'));
  env.flushRaf();
  assert.equal(ctl.getState().dragging, false, 'window blur mid-drag must end dragging cleanly');
  assert.equal(fx.host.hasAttribute('data-ag-vtabs-dragging'), false, 'window blur mid-drag must clear data-ag-vtabs-dragging on host');
  assert.equal(fx.strip.hasAttribute('data-ag-vtabs-dragging'), false, 'window blur mid-drag must clear data-ag-vtabs-dragging on strip');
  assert.equal(env.countWinListeners(dragWinTypes), winDragListenersBefore, 'window blur mid-drag must leak 0 window pointer/blur listeners');
  assert.equal(ctl.getState().expandedWidth, preBlurW, 'window blur mid-drag must roll back expandedWidth');
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), `${preBlurW}px`, 'window blur mid-drag must restore inline --ag-vtabs-w');
  assert.equal(env.storage.getItem(STORAGE_WIDTH_KEY), preBlurStored, 'window blur mid-drag must leave localStorage untouched');

  // pointercancel mid-drag must roll back width & leave localStorage untouched, AND intermediate pointermove frames must NOT spam localStorage.setItem
  const origSetItem = env.storage.setItem.bind(env.storage);
  const storageWrites = [];
  env.storage.setItem = (k, v) => {
    storageWrites.push({ k, v });
    return origSetItem(k, v);
  };
  try {
    const preCancelW = ctl.getState().expandedWidth;
    sash2.dispatchEvent(new env.MockEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 13, button: 0, clientX: 500 }));
    for (const cx of [470, 440, 410]) {
      sash2.dispatchEvent(new env.MockEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 13, clientX: cx }));
      env.flushRaf();
    }
    assert.equal(storageWrites.length, 0, 'Intermediate pointermove drag frames must NOT write localStorage (0 spam)');
    sash2.dispatchEvent(new env.MockEvent('pointercancel', { bubbles: true, cancelable: true, pointerId: 13, clientX: 410 }));
    env.flushRaf();
    assert.equal(storageWrites.length, 0, 'pointercancel mid-drag must NOT write to localStorage');
    assert.equal(ctl.getState().dragging, false);
    assert.equal(ctl.getState().expandedWidth, preCancelW, 'pointercancel must roll back expandedWidth');
    assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), `${preCancelW}px`, 'pointercancel must roll back --ag-vtabs-w');
    assert.equal(env.storage.getItem(STORAGE_WIDTH_KEY), String(preCancelW), 'pointercancel must keep original localStorage width');

    // Committed multi-frame drag writes localStorage strictly ONCE on pointerup
    sash2.dispatchEvent(new env.MockEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 14, button: 0, clientX: 500 }));
    for (const cx of [520, 540, 560]) {
      sash2.dispatchEvent(new env.MockEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 14, clientX: cx }));
      env.flushRaf();
    }
    assert.equal(storageWrites.length, 0, 'Multi-frame drag must defer localStorage writes until pointerup');
    sash2.dispatchEvent(new env.MockEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 14, clientX: 560 }));
    env.flushRaf();
    assert.equal(storageWrites.filter((w) => w.k === STORAGE_WIDTH_KEY).length, 1, 'Committed drag must persist width exactly once on pointerup');
    assert.equal(ctl.getState().expandedWidth, 220);
  } finally {
    env.storage.setItem = origSetItem;
  }
  ctl.setExpandedWidth(280);

  // Snap-collapse (rawW = 280 + (400 - 610) = 70 < 88) -> collapses to 42px WITHOUT overwriting custom width 280
  dragSash2(400, 610, 4);
  assert.equal(ctl.getState().collapsed, true);
  assert.equal(ctl.getState().effectiveWidth, 42);
  assert.equal(fx.host.getAttribute('data-ag-vtabs-collapsed'), '1');
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '42px');
  assert.equal(env.storage.getItem(STORAGE_COLLAPSED_KEY), '1');
  assert.equal(env.storage.getItem(STORAGE_WIDTH_KEY), '280', 'Snap-collapse must preserve prior custom width in localStorage');

  // Clicking Expand restores custom width 280px
  toggle2.click();
  env.flushRaf();
  assert.equal(ctl.getState().collapsed, false);
  assert.equal(ctl.getState().effectiveWidth, 280);
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '280px');

  // Drag-expand from collapsed 42px past >= 88px seamlessly uncollapses & resizes
  toggle2.click();
  env.flushRaf();
  assert.equal(ctl.getState().collapsed, true);
  dragSash2(500, 340, 5); // 42 + (500 - 340) = 202 >= 88
  assert.equal(ctl.getState().collapsed, false, 'Dragging left past >= 88px from collapsed 42px must uncollapse');
  assert.equal(ctl.getState().expandedWidth, 202);
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '202px');
  assert.equal(env.storage.getItem(STORAGE_COLLAPSED_KEY), '0');
  assert.equal(env.storage.getItem(STORAGE_WIDTH_KEY), '202');

  // Double-click on sash resets width to 180px and uncollapses
  toggle2.click();
  env.flushRaf();
  assert.equal(ctl.getState().collapsed, true);
  sash2.dispatchEvent(new env.MockEvent('dblclick', { bubbles: true, cancelable: true }));
  env.flushRaf();
  assert.equal(ctl.getState().collapsed, false, 'dblclick on sash must uncollapse');
  assert.equal(ctl.getState().expandedWidth, 180, 'dblclick on sash must reset width to 180px');
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '180px');
  assert.equal(env.storage.getItem(STORAGE_WIDTH_KEY), '180');
  assert.equal(env.storage.getItem(STORAGE_COLLAPSED_KEY), '0');

  // Narrow lock (< 420px / autoCollapsed) ignores sash drag & dblclick
  ctl.setExpandedWidth(240);
  env.triggerResize(fx.host, 360);
  assert.equal(ctl.getState().autoCollapsed, true);
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '42px');
  dragSash2(500, 300, 6);
  sash2.dispatchEvent(new env.MockEvent('dblclick', { bubbles: true, cancelable: true }));
  env.flushRaf();
  assert.equal(ctl.getState().dragging, false);
  assert.equal(ctl.getState().autoCollapsed, true, 'Narrow lock must ignore sash drag & dblclick');
  assert.equal(env.storage.getItem(STORAGE_WIDTH_KEY), '240', 'Narrow lock must not mutate persisted width');
  env.triggerResize(fx.host, 700);
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '240px');

  // Cross-window storage event for ag-prism:side-panel-vtabs-width and null
  env.storage.setItem(STORAGE_WIDTH_KEY, '250');
  env.win.dispatchEvent(new env.MockEvent('storage', {
    key: STORAGE_WIDTH_KEY,
    oldValue: '240',
    newValue: '250',
    storageArea: env.storage,
  }));
  env.flushRaf();
  assert.equal(ctl.getState().expandedWidth, 250);
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '250px');

  env.storage.clear();
  env.win.dispatchEvent(new env.MockEvent('storage', { key: null, storageArea: env.storage }));
  env.flushRaf();
  assert.equal(ctl.getState().expandedWidth, 180, 'storage clear (key=null) must reset expandedWidth to 180');
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '180px');

  // Browser Hole ([data-has-browser-hole="true"]): setPointerCapture, 0 overlay, data-ag-vtabs-dragging="1", and strictly 1 passive resize on pointerup
  fx.panelBody.setAttribute('data-has-browser-hole', 'true');
  env.deliverMutations();
  assert.equal(ctl.getState().hasBrowserHole, true);

  sash2._captureHistory.length = 0;
  const beforeHoleDragResize = resizeEvents;
  sash2.dispatchEvent(new env.MockEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 7, button: 0, clientX: 500 }));
  assert.equal(sash2.hasPointerCapture(7), true, 'Browser hole drag must call setPointerCapture(pointerId)');
  assert.equal(fx.host.getAttribute('data-ag-vtabs-dragging'), '1');
  assert.equal(fx.strip.getAttribute('data-ag-vtabs-dragging'), '1');
  assert.equal(ctl.getState().dragging, true);
  assert.equal(fx.panelBody.querySelectorAll('[data-ag-owned="1"]').length, 0, '0 overlay allowed over browser-hole body during drag');
  assert.equal(env.body.children.length, initialBodyChildren, '0 full-screen overlay div allowed on document.body during drag');

  sash2.dispatchEvent(new env.MockEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 7, clientX: 430 }));
  env.flushRaf();
  assert.ok(resizeEvents > beforeHoleDragResize, 'Dragging under browser hole must dispatch passive window resize');
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '250px');

  // Queue an unflushed pointermove immediately followed by pointerup -> pointerup must dispatch STRICTLY 1 resize (not 2!)
  const beforePointerUpResize = resizeEvents;
  sash2.dispatchEvent(new env.MockEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 7, clientX: 410 }));
  sash2.dispatchEvent(new env.MockEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 7, clientX: 410 }));
  env.flushRaf();
  assert.equal(resizeEvents - beforePointerUpResize, 1, 'Browser hole pointerup must dispatch strictly 1 resize event (not 2)');
  assert.equal(sash2.hasPointerCapture(7), false, 'Ending drag must release pointer capture');
  assert.equal(fx.host.hasAttribute('data-ag-vtabs-dragging'), false);
  assert.equal(fx.strip.hasAttribute('data-ag-vtabs-dragging'), false);
  assert.equal(ctl.getState().dragging, false);

  ctl.destroy();
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '', 'destroy() must remove inline --ag-vtabs-w from host');
  assert.equal(fx.strip.style.getPropertyValue('--ag-vtabs-w'), '', 'destroy() must remove inline --ag-vtabs-w from strip');
  assert.equal(env.doc.querySelector('.ag-cs-vtabs-sash'), null, 'destroy() must remove .ag-cs-vtabs-sash');
});

// ── 15. Addendum Enhancement 2: Category Hue Family + Within-Category Ordinal Colors (Redux Tier 1 + DOM Tier 2) ──
test('15. Addendum Enhancement 2: read-only Redux sidePanelV2 (0 dispatch calls, 2-pane routing, Fiber cache, dup titles) + silent DOM fallback + multi-/btw ordinal chips', () => {
  const vtabsMod = loadVerticalTabsModule();
  const cssText = readVerticalTabsCss();

  // Part A: Tier 1 Read-Only Redux sidePanelV2 via __reactFiber$ (genuinely opaque IDs & labels + real 2-pane multiConvoLayout.rootNode + Fiber cache check)
  {
    const env = createRichMockDom({ lang: 'en' });
    const opaqueTabs = [
      { id: 'item-1', label: 'Alpha Thread', active: true },
      { id: 'item-2', label: 'Beta Thread' },
      { id: 'item-3', label: 'Gamma Thread' },
      { id: 'item-4', label: 'Item Delta' },
      { id: 'item-5', label: 'Item Epsilon' },
      { id: 'item-6', label: 'Item Zeta' },
      { id: 'item-7', label: 'Item Eta' },
      { id: 'item-8', label: 'Item Theta' },
    ];
    const fx = buildRightSidePanelFixture(env, { topology: 'nested', tabs: opaqueTabs, hostWidth: 600 });
    const byId = (id) => fx.tabEntries.find((e) => e.spec.id === id).tab;

    // Pre-assertion WITHOUT Redux: all 8 genuinely opaque tabs MUST classify as 'other' (proving Tier 2 DOM fallback cannot guess any of them!)
    const preCtl = vtabsMod.createSidePanelVerticalTabsController({
      win: env.win,
      doc: env.doc,
      storage: env.storage,
      cssText,
      getLang: () => 'en',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
    });
    preCtl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
    env.flushRaf();
    for (const spec of opaqueTabs) {
      assert.equal(
        byId(spec.id).getAttribute('data-ag-vtabs-cat'),
        'other',
        `Opaque tab ${spec.id} must classify strictly as "other" when Redux is absent`
      );
    }
    preCtl.destroy();

    // Now attach a real 2-pane multiConvoLayout with rootNode split tree behind a 30-node React Fiber chain with read spy
    let dispatchCalls = 0;
    let activePaneId = 'pane-1';
    const pane1Tabs = [
      { id: 'item-1', content: { type: 'sideQuestionView' } },
      { id: 'item-2', content: { type: 'sideQuestionView' } },
      { id: 'item-3', content: { type: 'sideQuestionView' } },
      { id: 'item-4', content: { type: 'artifactView' } },
      { id: 'item-5', content: { type: 'diffReviewView' } },
      { id: 'item-6', content: { type: 'terminalPtyView' } },
      { id: 'item-7', content: { type: 'customView', customPaneKey: 'browser' } },
      { id: 'item-8', content: { type: 'subagentView' } },
    ];
    const pane2Tabs = [
      { id: 'item-1', content: { type: 'terminalPtyView' } },
      { id: 'item-2', content: { type: 'artifactView' } },
      { id: 'item-3', content: { type: 'diffReviewView' } },
      { id: 'item-4', content: { type: 'sideQuestionView' } },
      { id: 'item-5', content: { type: 'sideQuestionView' } },
      { id: 'item-6', content: { type: 'subagentView' } },
      { id: 'item-7', content: { type: 'customView', customPaneKey: 'browser' } },
      { id: 'item-8', content: { type: 'artifactView' } },
    ];
    const mockStore = {
      getState: () => ({
        multiConvoLayout: {
          focusedPaneId: activePaneId,
          rootNode: {
            type: 'split',
            direction: 'horizontal',
            children: [
              { type: 'leaf', id: 'pane-1', cascadeId: 'cid-pane-1' },
              { type: 'leaf', id: 'pane-2', cascadeId: 'cid-pane-2' },
            ],
          },
        },
        sidePanelV2: {
          conversationPanes: {
            'cid-pane-1': { tabs: pane1Tabs, activeTabId: 'item-1' },
            'cid-pane-2': { tabs: pane2Tabs, activeTabId: 'item-1' },
          },
        },
      }),
      dispatch: () => { dispatchCalls += 1; },
    };

    let fiberChainReads = 0;
    let chainHead = { memoizedProps: { value: { store: mockStore } }, return: null };
    for (let k = 0; k < 30; k++) {
      const nextNode = chainHead;
      const wrapper = { return: null };
      Object.defineProperty(wrapper, 'memoizedProps', {
        enumerable: true,
        get() {
          fiberChainReads += 1;
          return { idx: k };
        },
      });
      wrapper.child = nextNode;
      chainHead = wrapper;
    }
    fx.root['__reactFiber$mock'] = chainHead;

    const ctl = vtabsMod.createSidePanelVerticalTabsController({
      win: env.win,
      doc: env.doc,
      storage: env.storage,
      cssText,
      getLang: () => 'en',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
    });
    ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
    env.flushRaf();

    assert.equal(dispatchCalls, 0, 'Redux lookup MUST be 100% read-only (0 dispatch calls)');
    assert.ok(fiberChainReads > 0, 'Initial mount must walk React Fiber chain to locate Redux store');

    // pane-1: 3 /btw tabs get cat="btw", tone="0","1","2", ord="1","2","3", owned .ag-cs-vtabs-ord (#1,#2,#3) without polluting title
    for (let i = 0; i < 3; i++) {
      const tab = byId(`item-${i + 1}`);
      assert.equal(tab.getAttribute('data-ag-vtabs-cat'), 'btw');
      assert.equal(tab.getAttribute('data-ag-vtabs-tone'), String(i));
      assert.equal(tab.getAttribute('data-ag-vtabs-ord'), String(i + 1));
      const ordEl = tab.querySelector('.ag-cs-vtabs-ord');
      assertOwnedAndNoTranslate(ordEl, `.ag-cs-vtabs-ord #${i + 1}`);
      assert.equal(ordEl.textContent, `#${i + 1}`);
      assert.equal(tab.getAttribute('title').includes(`#${i + 1}`), false, 'Ordinal chip must NOT pollute hover title tooltip');
    }

    // Singleton categories in pane-1 get exact cat + tone="0", NO data-ag-vtabs-ord, NO .ag-cs-vtabs-ord
    for (const [id, expectedCat] of [
      ['item-4', 'doc'],
      ['item-5', 'diff'],
      ['item-6', 'term'],
      ['item-7', 'browser'],
      ['item-8', 'plugin'],
    ]) {
      const tab = byId(id);
      assert.equal(tab.getAttribute('data-ag-vtabs-cat'), expectedCat, `Tab ${id} must classify as ${expectedCat} via 2-pane Redux`);
      assert.equal(tab.getAttribute('data-ag-vtabs-tone'), '0');
      assert.equal(tab.hasAttribute('data-ag-vtabs-ord'), false, `Singleton ${expectedCat} must NOT carry data-ag-vtabs-ord`);
      assert.equal(tab.querySelector('.ag-cs-vtabs-ord'), null, `Singleton ${expectedCat} must NOT render .ag-cs-vtabs-ord`);
    }

    // Switch focusedPaneId pane-1 -> pane-2 in 2-pane rootNode -> categories re-route to cid-pane-2 cleanly!
    activePaneId = 'pane-2';
    byId('item-1').setAttribute('aria-label', 'Pane 2 refresh');
    env.deliverMutations();
    assert.equal(byId('item-1').getAttribute('data-ag-vtabs-cat'), 'term', 'Switching focusedPaneId to pane-2 must re-route Redux lookup to cid-pane-2');
    assert.equal(byId('item-4').getAttribute('data-ag-vtabs-cat'), 'btw');
    assert.equal(byId('item-4').getAttribute('data-ag-vtabs-ord'), '1');
    assert.equal(byId('item-5').getAttribute('data-ag-vtabs-cat'), 'btw');
    assert.equal(byId('item-5').getAttribute('data-ag-vtabs-ord'), '2');
    assert.equal(byId('item-2').getAttribute('data-ag-vtabs-cat'), 'doc');
    assert.equal(byId('item-8').getAttribute('data-ag-vtabs-cat'), 'doc');

    // Switch back to pane-1 and assert Fiber lookup is CACHED (A-M2: 0 repeated Fiber walks across 5 syncs!)
    activePaneId = 'pane-1';
    byId('item-1').setAttribute('aria-label', 'Pane 1 restore');
    env.deliverMutations();
    const readsBefore5Syncs = fiberChainReads;
    for (let s = 0; s < 5; s++) {
      byId('item-1').setAttribute('aria-label', `Tick ${s}`);
      env.deliverMutations();
    }
    assert.equal(
      fiberChainReads - readsBefore5Syncs,
      0,
      `Cached Redux store must NOT re-walk React Fiber chain across 5 repeated syncs (got ${fiberChainReads - readsBefore5Syncs} reads)`
    );

    // Closing 2 of 3 /btw tabs drops catCount from 3 -> 1 -> removes ord attr & .ag-cs-vtabs-ord cleanly
    byId('item-2').remove();
    byId('item-3').remove();
    pane1Tabs.splice(1, 2);
    env.deliverMutations();
    const lastBtw = byId('item-1');
    assert.equal(lastBtw.getAttribute('data-ag-vtabs-cat'), 'btw');
    assert.equal(lastBtw.hasAttribute('data-ag-vtabs-ord'), false, 'Reducing /btw count to 1 must remove data-ag-vtabs-ord');
    assert.equal(lastBtw.querySelector('.ag-cs-vtabs-ord'), null, 'Reducing /btw count to 1 must remove .ag-cs-vtabs-ord');
    assert.equal(dispatchCalls, 0);

    ctl.destroy();
    assert.equal(env.doc.querySelector('.ag-cs-vtabs-ord'), null);
  }

  // Part A2: Duplicate-title Redux tabs (S-3c) — claimedReduxTabs classifies both distinctly & tracks second /btw completion
  {
    const env = createRichMockDom({ lang: 'en' });
    env.html.setAttribute('data-ag-cs-motion', 'ultra');
    const fx = buildRightSidePanelFixture(env, { topology: 'nested', tabs: [], hostWidth: 600 });
    const mkNoIdTab = (label, active = false) => {
      const t = env.mkEl('div', {
        class: 'agy-aux-tab',
        role: 'tab',
        'aria-selected': active ? 'true' : 'false',
        ...(active ? { 'data-active': 'true', 'data-state': 'active' } : {}),
      });
      t.appendChild(env.mkEl('span', { class: 'agy-tab-title', text: label }));
      fx.tabList.appendChild(t);
      return t;
    };
    const dupSum0 = mkNoIdTab('Shared Summary', true);
    const dupSum1 = mkNoIdTab('Shared Summary', false);
    const dupBtw0 = mkNoIdTab('Shared Thread', false);
    const dupBtw1 = mkNoIdTab('Shared Thread', false);

    // Include an extra 5th Redux entry so domCount !== reduxTabs.length, forcing title-based matching through claimedReduxTabs
    let sq2Running = true;
    const dupStore = {
      getState: () => ({
        multiConvoLayout: {
          focusedPaneId: 'pane-dup',
          rootNode: { type: 'leaf', id: 'pane-dup', cascadeId: 'cid-dup' },
        },
        sidePanelV2: {
          conversationPanes: {
            'cid-dup': {
              tabs: [
                { id: 'sum-doc', title: 'Shared Summary', content: { type: 'artifactView' } },
                { id: 'sum-diff', title: 'Shared Summary', content: { type: 'diffReviewView' } },
                { id: 'sq-1', title: 'Shared Thread', content: { type: 'sideQuestionView' }, isRunning: false },
                { id: 'sq-2', title: 'Shared Thread', content: { type: 'sideQuestionView' }, isRunning: sq2Running },
                { id: 'extra-hidden', title: 'Hidden Extra', content: { type: 'terminalPtyView' } },
              ],
            },
          },
        },
      }),
      dispatch() { throw new Error('Must never call dispatch'); },
    };
    fx.root['__reactFiber$dup'] = { memoizedProps: { value: { store: dupStore } }, return: null };

    const ctl = vtabsMod.createSidePanelVerticalTabsController({
      win: env.win,
      doc: env.doc,
      storage: env.storage,
      cssText,
      getLang: () => 'en',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
    });
    ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
    env.flushRaf();

    assert.equal(dupSum0.getAttribute('data-ag-vtabs-cat'), 'doc', 'First duplicate-title tab must claim sum-doc');
    assert.equal(dupSum1.getAttribute('data-ag-vtabs-cat'), 'diff', 'Second duplicate-title tab must claim sum-diff (not duplicate sum-doc)');
    assert.equal(dupBtw0.getAttribute('data-ag-vtabs-cat'), 'btw');
    assert.equal(dupBtw1.getAttribute('data-ag-vtabs-cat'), 'btw');
    assert.equal(dupBtw0.hasAttribute('data-ag-vtabs-caustic'), false);
    assert.equal(dupBtw1.hasAttribute('data-ag-vtabs-caustic'), false);

    // Complete ONLY sq-2 -> ONLY dupBtw1 receives caustic="1" & ready="1"
    sq2Running = false;
    dupBtw1.setAttribute('aria-label', 'done');
    env.deliverMutations();
    assert.equal(dupBtw1.getAttribute('data-ag-vtabs-caustic'), '1', 'Second duplicate-title /btw must receive caustic on sq-2 completion');
    assert.equal(dupBtw1.getAttribute('data-ag-vtabs-ready'), '1', 'Second duplicate-title /btw must receive ready="1" on sq-2 completion');
    assert.equal(dupBtw0.hasAttribute('data-ag-vtabs-caustic'), false, 'First duplicate-title /btw must NOT falsely receive caustic');
    assert.equal(dupBtw0.hasAttribute('data-ag-vtabs-ready'), false, 'First duplicate-title /btw must NOT falsely receive ready');
    ctl.destroy();
  }

  // Part B: Tier 2 Silent DOM Heuristic Fallback (absent, throwing, cyclic rootNode, hostile getters) + CamelCase FileChanges/GitChanges (ADD-6)
  for (const mode of ['absent-redux', 'throwing-redux', 'cyclic-rootnode', 'hostile-getters']) {
    const env = createRichMockDom({ lang: 'en' });
    const domTabs = [
      { id: 'd-btw-1', label: '/btw First question', active: true },
      { id: 'd-btw-2', label: '/btw Second question' },
      { id: 'd-btw-3', label: '/btw Third question' },
      { id: 'd-btw-4', label: '/btw Fourth question' },
      { id: 'd-doc-1', label: 'Artifact: architecture.md' },
      { id: 'd-diff-1', label: 'Diff: cdp.js (+40/-12)' },
      { id: 'd-diff-2', label: 'FileChanges' },
      { id: 'd-diff-3', label: 'GitChanges' },
      { id: 'd-term-1', label: 'Terminal: pwsh' },
      { id: 'd-browser-1', label: 'Browser: https://localhost:5173' },
      { id: 'd-plugin-1', label: 'Subagent: verifier-runtime' },
      { id: 'd-other-1', label: 'Scratchpad Workspace' },
    ];
    const fx = buildRightSidePanelFixture(env, { topology: 'nested', tabs: domTabs, hostWidth: 600 });

    if (mode === 'throwing-redux') {
      fx.root['__reactFiber$broken'] = {
        memoizedProps: {
          value: {
            store: {
              getState() { throw new Error('Host Redux schema changed'); },
              dispatch() { throw new Error('Must never call dispatch'); },
            },
          },
        },
        return: null,
      };
    } else if (mode === 'cyclic-rootnode') {
      const cyclicRoot = { type: 'split', children: [] };
      const leaf = { type: 'leaf', id: 'other-pane', cascadeId: 'cid-other', parent: cyclicRoot };
      cyclicRoot.children.push(leaf, cyclicRoot);
      fx.root['__reactFiber$cyclic'] = {
        memoizedProps: {
          value: {
            store: {
              getState: () => ({
                multiConvoLayout: { focusedPaneId: 'missing-pane', rootNode: cyclicRoot },
                sidePanelV2: { conversationPanes: {} },
              }),
              dispatch() { throw new Error('Must never call dispatch'); },
            },
          },
        },
        return: null,
      };
    } else if (mode === 'hostile-getters') {
      const hostileState = {};
      for (const prop of ['multiConvoLayout', 'sidePanelV2', 'sidePanel', 'sideQuestion', 'cascade']) {
        Object.defineProperty(hostileState, prop, {
          enumerable: true,
          get() { throw new Error(`HostileGetterBoom:${prop}`); },
        });
      }
      fx.root['__reactFiber$hostile'] = {
        memoizedProps: {
          value: {
            store: {
              getState: () => hostileState,
              dispatch() { throw new Error('Must never call dispatch'); },
            },
          },
        },
        return: null,
      };
    }

    const ctl = vtabsMod.createSidePanelVerticalTabsController({
      win: env.win,
      doc: env.doc,
      storage: env.storage,
      cssText,
      getLang: () => 'en',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
    });
    assert.doesNotThrow(() => {
      ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
      env.flushRaf();
    }, `[${mode}] DOM fallback must never throw`);

    const byId = (id) => fx.tabEntries.find((e) => e.spec.id === id).tab;
    for (let i = 0; i < 4; i++) {
      const tab = byId(`d-btw-${i + 1}`);
      assert.equal(tab.getAttribute('data-ag-vtabs-cat'), 'btw');
      assert.equal(tab.getAttribute('data-ag-vtabs-tone'), String(i), `[${mode}] 4 /btw tabs must cycle tone 0..3`);
      assert.equal(tab.getAttribute('data-ag-vtabs-ord'), String(i + 1));
      assert.equal(tab.querySelector('.ag-cs-vtabs-ord')?.textContent, `#${i + 1}`);
    }
    // CamelCase FileChanges & GitChanges must classify as diff (ADD-6)
    for (const [id, ord] of [['d-diff-1', '1'], ['d-diff-2', '2'], ['d-diff-3', '3']]) {
      const tab = byId(id);
      assert.equal(tab.getAttribute('data-ag-vtabs-cat'), 'diff', `[${mode}] ${id} must classify as diff`);
      assert.equal(tab.getAttribute('data-ag-vtabs-ord'), ord);
    }
    for (const [id, expectedCat] of [
      ['d-doc-1', 'doc'],
      ['d-term-1', 'term'],
      ['d-browser-1', 'browser'],
      ['d-plugin-1', 'plugin'],
      ['d-other-1', 'other'],
    ]) {
      const tab = byId(id);
      assert.equal(tab.getAttribute('data-ag-vtabs-cat'), expectedCat, `[${mode}] DOM fallback must classify ${id} as ${expectedCat}`);
      assert.equal(tab.hasAttribute('data-ag-vtabs-ord'), false);
      assert.equal(tab.querySelector('.ag-cs-vtabs-ord'), null);
    }

    ctl.destroy();
  }
});

// ── 16. Addendum Enhancement 3: Option B Motion (__agMotionEngine), /btw Completion Caustic Sweep & Zero-Leak Teardown ──
test('16. Addendum Enhancement 3: Option B glide+spring motion, tier degradation, /btw completion caustic+ready & zero-leak teardown', async () => {
  const vtabsMod = loadVerticalTabsModule();
  const cssText = readVerticalTabsCss();

  const env = createRichMockDom({ lang: 'en' });
  env.html.setAttribute('data-ag-cs-motion', 'ultra');
  const fx = buildRightSidePanelFixture(env, {
    topology: 'nested',
    hostWidth: 600,
    tabs: [
      { id: 'btw-fg', label: '/btw Foreground question', active: true },
      { id: 'btw-bg', label: '/btw Background question' },
      { id: 'doc-1', label: 'Artifact: notes.md' },
    ],
  });

  // Assign distinct non-zero layout rects for realistic FLIP glide geometry
  fx.tabList._rect = { left: 1256, top: 40, width: 180, height: 640, right: 1436, bottom: 680 };
  fx.tabEntries.forEach((entry, idx) => {
    entry.tab._rect = {
      left: 1260,
      top: 44 + idx * 36,
      width: 172,
      height: 32,
      right: 1432,
      bottom: 76 + idx * 36,
    };
  });

  // Mock Channel 1 __agMotionEngine with controllable glide completion
  const glideCalls = [];
  const springCalls = [];
  let pendingGlideFinish = null;
  let lastGlideCancelled = false;
  env.win.__agMotionEngine = {
    getMotionTier: () => env.html.getAttribute('data-ag-cs-motion') || 'ultra',
    glideIndicator(el, prevR, nextR, opts) {
      lastGlideCancelled = false;
      glideCalls.push({ el, prevR, nextR, opts });
      const finished = new Promise((resolve) => { pendingGlideFinish = resolve; });
      return {
        finished,
        cancel() {
          lastGlideCancelled = true;
          const fn = pendingGlideFinish;
          pendingGlideFinish = null;
          fn?.();
        },
      };
    },
    spring(el, keyframes, opts) {
      springCalls.push({ el, keyframes, opts });
      return { finished: Promise.resolve(), cancel() {} };
    },
  };

  const setActiveTab = (targetId) => {
    for (const e of fx.tabEntries) {
      const act = e.spec.id === targetId;
      e.tab.setAttribute('aria-selected', act ? 'true' : 'false');
      if (act) {
        e.tab.setAttribute('data-active', 'true');
        e.tab.setAttribute('data-state', 'active');
      } else {
        e.tab.removeAttribute('data-active');
        e.tab.removeAttribute('data-state');
      }
    }
  };

  const ctl = vtabsMod.createSidePanelVerticalTabsController({
    win: env.win,
    doc: env.doc,
    storage: env.storage,
    cssText,
    getLang: () => 'en',
    getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
  });
  ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
  env.flushRaf();

  const tabFg = fx.tabEntries[0].tab;
  const tabBg = fx.tabEntries[1].tab;
  const tabDoc = fx.tabEntries[2].tab;

  // Part A: Option B Active Tab Motion (ultra & standard glide + icon spring; subtle/off/win-blur/reduced-motion silence)
  const glideBar = fx.tabList.querySelector('.ag-cs-vtabs-glide-bar');
  assertOwnedAndNoTranslate(glideBar, '.ag-cs-vtabs-glide-bar');

  // Initial mount must NOT falsely glide, caustic, or mark ready
  assert.equal(glideCalls.length, 0, 'Initial mount must not trigger spurious glideIndicator');
  assert.equal(tabFg.hasAttribute('data-ag-vtabs-caustic'), false);
  assert.equal(tabBg.hasAttribute('data-ag-vtabs-caustic'), false);
  assert.equal(tabBg.hasAttribute('data-ag-vtabs-ready'), false);

  // Switch active tab in 'ultra': invokes glideIndicator on .ag-cs-vtabs-glide-bar + spring on active icon, stamps exact inline left (6px!) & gliding="1"
  setActiveTab('doc-1');
  env.deliverMutations();
  assert.equal(glideCalls.length, 1, 'Active tab switch in ultra must invoke glideIndicator');
  assert.equal(glideCalls[0].el, glideBar);
  assert.equal(glideBar.style.left, '6px', 'Glide bar inline style.left must align exactly with padded tab ::after (1260 + 2 - 1256 = 6px, NOT 2px)');
  assert.equal(fx.tabList.getAttribute('data-ag-vtabs-gliding'), '1', 'List must stamp data-ag-vtabs-gliding="1" during flight');
  assert.ok(springCalls.length >= 1, 'Active tab switch in ultra must pop active tab icon via spring()');
  assert.equal(tabDoc.querySelector('.agy-aux-tab-close').contains(springCalls[0].el), false, 'Icon spring must target tab icon, NOT close button');

  // Completing flight clears data-ag-vtabs-gliding cleanly
  pendingGlideFinish();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(fx.tabList.hasAttribute('data-ag-vtabs-gliding'), false, 'Finishing glide must clear data-ag-vtabs-gliding');

  // Mid-flight cancellation regressions (ADD-2, S-5, AGENTS.md §二.3):
  // - win-blur="1" in default balanced/quality mode MUST NOT cancel active glide (keeps dual-screen feedback alive)
  // - win-blur="1" in performance mode, motion="off", and collapse MUST immediately cancel glide & clear gliding="1"
  const toggleBtn = fx.strip.querySelector('.ag-cs-vtabs-toggle');
  setActiveTab('btw-fg');
  env.deliverMutations();
  assert.equal(fx.tabList.getAttribute('data-ag-vtabs-gliding'), '1');
  env.html.setAttribute('data-ag-cs-perf-mode', 'balanced');
  env.html.setAttribute('data-ag-cs-win-blur', '1');
  env.deliverMutations();
  assert.equal(lastGlideCancelled, false, 'AGENTS.md §二.3: win-blur="1" in default balanced mode must NOT cancel active glide');
  assert.equal(fx.tabList.getAttribute('data-ag-vtabs-gliding'), '1');

  env.html.setAttribute('data-ag-cs-perf-mode', 'performance');
  env.deliverMutations();
  assert.equal(lastGlideCancelled, true, 'Mid-flight win-blur="1" in performance mode must cancel active glide handle');
  assert.equal(fx.tabList.hasAttribute('data-ag-vtabs-gliding'), false, 'Mid-flight win-blur="1" in performance mode must immediately clear data-ag-vtabs-gliding');
  env.html.removeAttribute('data-ag-cs-win-blur');
  env.html.setAttribute('data-ag-cs-perf-mode', 'balanced');
  env.deliverMutations();

  setActiveTab('doc-1');
  env.deliverMutations();
  assert.equal(fx.tabList.getAttribute('data-ag-vtabs-gliding'), '1');
  env.html.setAttribute('data-ag-cs-motion', 'off');
  env.deliverMutations();
  assert.equal(lastGlideCancelled, true, 'Mid-flight motion="off" must cancel active glide handle');
  assert.equal(fx.tabList.hasAttribute('data-ag-vtabs-gliding'), false, 'Mid-flight motion="off" must immediately clear data-ag-vtabs-gliding');
  env.html.setAttribute('data-ag-cs-motion', 'ultra');
  env.deliverMutations();

  setActiveTab('btw-fg');
  env.deliverMutations();
  assert.equal(fx.tabList.getAttribute('data-ag-vtabs-gliding'), '1');
  toggleBtn.click();
  env.flushRaf();
  assert.equal(lastGlideCancelled, true, 'Mid-flight rail collapse must cancel active glide handle');
  assert.equal(fx.tabList.hasAttribute('data-ag-vtabs-gliding'), false, 'Mid-flight rail collapse must immediately clear data-ag-vtabs-gliding');
  toggleBtn.click();
  env.flushRaf();

  // Throwing & null glideIndicator (with WAAPI unavailable) must immediately clean up with 0 dangling timers (ADD-2, S-5)
  const savedEngine = env.win.__agMotionEngine;
  const savedAnimate = glideBar.animate;
  glideBar.animate = undefined;
  for (const badMode of ['throw', 'null']) {
    env.win.__agMotionEngine = {
      getMotionTier: () => 'ultra',
      glideIndicator() {
        if (badMode === 'throw') throw new Error('GlideEngineBoom');
        return null;
      },
      spring: savedEngine.spring,
    };
    const timersBeforeBad = env.activeTimers.size;
    assert.doesNotThrow(() => {
      setActiveTab(badMode === 'throw' ? 'doc-1' : 'btw-fg');
      env.deliverMutations();
    }, `glideIndicator (${badMode}) must never throw`);
    assert.equal(fx.tabList.hasAttribute('data-ag-vtabs-gliding'), false, `glideIndicator (${badMode}) must immediately clear data-ag-vtabs-gliding`);
    assert.equal(glideBar.style.opacity, '0', `glideIndicator (${badMode}) must immediately hide glide bar`);
    assert.equal(env.activeTimers.size, timersBeforeBad, `glideIndicator (${badMode}) must leave 0 dangling safety timers`);
  }
  glideBar.animate = savedAnimate;
  env.win.__agMotionEngine = savedEngine;

  // 'standard' also triggers Option B glide + spring
  const glidesBeforeStd = glideCalls.length;
  env.html.setAttribute('data-ag-cs-motion', 'standard');
  env.deliverMutations();
  setActiveTab('doc-1');
  env.deliverMutations();
  assert.equal(glideCalls.length, glidesBeforeStd + 1, 'Active tab switch in standard must invoke glideIndicator');
  pendingGlideFinish();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(fx.tabList.hasAttribute('data-ag-vtabs-gliding'), false);

  // Degrades in 'subtle' (0 glideIndicator, 0 spring)
  const glidesBeforeSubtle = glideCalls.length;
  const springsBeforeSubtle = springCalls.length;
  env.html.setAttribute('data-ag-cs-motion', 'subtle');
  env.deliverMutations();
  setActiveTab('btw-fg');
  env.deliverMutations();
  assert.equal(glideCalls.length, glidesBeforeSubtle, 'subtle tier must skip FLIP glideIndicator');
  assert.equal(springCalls.length, springsBeforeSubtle, 'subtle tier must skip icon spring');

  // Silences in 'off', perf-mode win-blur="1" (alive in balanced!), and prefers-reduced-motion: reduce (overridden by data-ag-cs-ignore-rm="1")
  env.html.setAttribute('data-ag-cs-motion', 'off');
  env.deliverMutations();
  setActiveTab('doc-1');
  env.deliverMutations();
  assert.equal(glideCalls.length, glidesBeforeSubtle, 'motion="off" must silence glideIndicator');

  env.html.setAttribute('data-ag-cs-motion', 'ultra');
  env.html.setAttribute('data-ag-cs-perf-mode', 'performance');
  env.html.setAttribute('data-ag-cs-win-blur', '1');
  env.deliverMutations();
  setActiveTab('btw-fg');
  env.deliverMutations();
  assert.equal(glideCalls.length, glidesBeforeSubtle, 'win-blur="1" in performance mode must silence glideIndicator');

  env.html.setAttribute('data-ag-cs-perf-mode', 'balanced');
  env.deliverMutations();
  setActiveTab('doc-1');
  env.deliverMutations();
  assert.equal(glideCalls.length, glidesBeforeSubtle + 1, 'AGENTS.md §二.3: win-blur="1" in balanced mode must keep glideIndicator alive');
  pendingGlideFinish?.();
  await new Promise((r) => setTimeout(r, 10));

  const glidesBeforeRm = glideCalls.length;
  env.html.removeAttribute('data-ag-cs-win-blur');
  // Mount REAL src/runtime/reduced-motion-guard.js (__agPrismReducedMotion) to verify Issue #101 & motion="off" precedence
  env.win.__agPrismReducedMotion = rmGuard.isReducedMotion;
  env.reducedMotion = true;
  env.deliverMutations();
  setActiveTab('btw-fg');
  env.deliverMutations();
  assert.equal(glideCalls.length, glidesBeforeRm, 'Real __agPrismReducedMotion must silence glideIndicator when prefers-reduced-motion=reduce & ignore-rm is off');

  // Issue #101: data-ag-cs-ignore-rm="1" overrides OS prefers-reduced-motion via real __agPrismReducedMotion
  env.html.setAttribute('data-ag-cs-ignore-rm', '1');
  env.deliverMutations();
  setActiveTab('doc-1');
  env.deliverMutations();
  assert.equal(glideCalls.length, glidesBeforeRm + 1, 'Issue #101: real __agPrismReducedMotion + data-ag-cs-ignore-rm="1" must restore glideIndicator');
  pendingGlideFinish?.();
  await new Promise((r) => setTimeout(r, 10));

  // Highest precedence: motion="off" MUST STILL disable glide even when data-ag-cs-ignore-rm="1" is set!
  const glidesBeforeOffOverride = glideCalls.length;
  env.html.setAttribute('data-ag-cs-motion', 'off');
  env.deliverMutations();
  setActiveTab('btw-fg');
  env.deliverMutations();
  assert.equal(glideCalls.length, glidesBeforeOffOverride, 'Issue #101: motion="off" must override data-ag-cs-ignore-rm="1" and silence glideIndicator');

  env.html.setAttribute('data-ag-cs-motion', 'ultra');
  env.html.removeAttribute('data-ag-cs-ignore-rm');
  env.reducedMotion = false;
  delete env.win.__agPrismReducedMotion;
  setActiveTab('doc-1');
  env.deliverMutations();
  pendingGlideFinish?.();
  await new Promise((r) => setTimeout(r, 10));
  setActiveTab('btw-fg');
  env.deliverMutations();
  pendingGlideFinish?.();
  await new Promise((r) => setTimeout(r, 10));

  // Part A2: REAL motion-engine.js integration (ADD-1) — solved durationMs (~608ms) MUST NOT be prematurely cut off at 420ms!
  {
    const realMotionEngine = require(path.join(ROOT, 'motion-engine.js'));
    const rEnv = createRichMockDom({ lang: 'en' });
    rEnv.html.setAttribute('data-ag-cs-motion', 'ultra');
    const rFx = buildRightSidePanelFixture(rEnv, {
      topology: 'nested',
      hostWidth: 600,
      tabs: [
        { id: 'rm-1', label: '/btw First', active: true },
        { id: 'rm-2', label: 'Artifact: spec.md' },
      ],
    });
    rFx.tabList._rect = { left: 1000, top: 40, width: 180, height: 640, right: 1180, bottom: 680 };
    rFx.tabEntries[0].tab._rect = { left: 1004, top: 44, width: 172, height: 32, right: 1176, bottom: 76 };
    rFx.tabEntries[1].tab._rect = { left: 1004, top: 80, width: 172, height: 32, right: 1176, bottom: 112 };
    rEnv.win.__agMotionEngine = realMotionEngine;

    const rCtl = vtabsMod.createSidePanelVerticalTabsController({
      win: rEnv.win,
      doc: rEnv.doc,
      storage: rEnv.storage,
      cssText,
      getLang: () => 'en',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
    });
    rCtl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
    rEnv.flushRaf();

    const rGlideBar = rFx.tabList.querySelector('.ag-cs-vtabs-glide-bar');
    let realAnimDuration = 0;
    let realAnimCancelled = false;
    let resolveRealAnim = null;
    rGlideBar.animate = (_kf, opts) => {
      realAnimDuration = Number(opts?.duration) || 0;
      const finished = new Promise((resolve) => { resolveRealAnim = resolve; });
      return {
        finished,
        cancel() {
          realAnimCancelled = true;
          resolveRealAnim?.();
        },
      };
    };

    rFx.tabEntries[0].tab.setAttribute('aria-selected', 'false');
    rFx.tabEntries[0].tab.removeAttribute('data-active');
    rFx.tabEntries[0].tab.removeAttribute('data-state');
    rFx.tabEntries[1].tab.setAttribute('aria-selected', 'true');
    rFx.tabEntries[1].tab.setAttribute('data-active', 'true');
    rFx.tabEntries[1].tab.setAttribute('data-state', 'active');
    rEnv.deliverMutations();

    assert.ok(realAnimDuration >= 500, `Real motion-engine.js glide durationMs should be ~608ms, got ${realAnimDuration}ms`);
    assert.equal(rGlideBar.style.left, '6px');
    assert.equal(rFx.tabList.getAttribute('data-ag-vtabs-gliding'), '1');

    // Wait 480ms (> old 420ms cutoff, < ~608ms real spring duration): must STILL be gliding and NOT cancelled!
    await new Promise((r) => setTimeout(r, 480));
    assert.equal(realAnimCancelled, false, 'Real motion-engine.js glide (~608ms) must NOT be prematurely cut off at 420ms');
    assert.equal(rFx.tabList.getAttribute('data-ag-vtabs-gliding'), '1', 'Gliding attribute must stay active through 480ms until real spring finishes');

    resolveRealAnim();
    await new Promise((r) => setTimeout(r, 15));
    assert.equal(rFx.tabList.hasAttribute('data-ag-vtabs-gliding'), false, 'Finishing real motion-engine.js glide must clear gliding="1"');
    rCtl.destroy();
  }

  // Part B: /btw Completion Caustic Sweep (running: true -> false) + Background Ready Highlight + 5 Edge Regressions
  // 1) Background /btw runs then completes -> gets BOTH caustic="1" AND ready="1"; activating clears ready="1"
  const bgSpinner = env.mkEl('span', { 'data-testid': 'status-loading-spinner' });
  tabBg.appendChild(bgSpinner);
  env.deliverMutations();
  assert.equal(tabBg.hasAttribute('data-ag-vtabs-caustic'), false, 'Running /btw must not trigger caustic prematurely');
  assert.equal(tabBg.hasAttribute('data-ag-vtabs-ready'), false, 'Running /btw must not mark ready prematurely');

  bgSpinner.remove();
  env.deliverMutations();
  assert.equal(tabBg.getAttribute('data-ag-vtabs-caustic'), '1', 'Background /btw running true->false must trigger data-ag-vtabs-caustic="1"');
  assert.equal(tabBg.getAttribute('data-ag-vtabs-ready'), '1', 'Background /btw completion must stamp data-ag-vtabs-ready="1"');

  // Activating background /btw clears data-ag-vtabs-ready immediately
  setActiveTab('btw-bg');
  env.deliverMutations();
  assert.equal(tabBg.hasAttribute('data-ag-vtabs-ready'), false, 'Activating ready background /btw must clear data-ag-vtabs-ready immediately');
  pendingGlideFinish?.();
  await new Promise((r) => setTimeout(r, 10));

  // 2) Foreground /btw runs (active cancel button in side-question-panel) then completes -> caustic="1", NO ready="1"
  setActiveTab('btw-fg');
  env.deliverMutations();
  pendingGlideFinish?.();
  await new Promise((r) => setTimeout(r, 10));

  const sqPanel = fx.panelBody.querySelector('[data-testid="side-question-panel"]');
  const cancelBtn = env.mkEl('button', { 'data-testid': 'input-cancel-button' });
  sqPanel.appendChild(cancelBtn);
  env.deliverMutations();
  assert.equal(tabFg.hasAttribute('data-ag-vtabs-caustic'), false);

  cancelBtn.remove();
  env.deliverMutations();
  assert.equal(tabFg.getAttribute('data-ag-vtabs-caustic'), '1', 'Foreground /btw running true->false must trigger data-ag-vtabs-caustic="1"');
  assert.equal(tabFg.hasAttribute('data-ag-vtabs-ready'), false, 'Foreground /btw completion must NEVER stamp data-ag-vtabs-ready');

  // Wait > 920ms -> data-ag-vtabs-caustic auto-removed cleanly!
  await new Promise((r) => setTimeout(r, 980));
  assert.equal(tabFg.hasAttribute('data-ag-vtabs-caustic'), false, 'data-ag-vtabs-caustic must auto-remove after 920ms');
  assert.equal(tabBg.hasAttribute('data-ag-vtabs-caustic'), false);

  // 3) Edge Regression (S-3a): Switching away from an active-only running /btw (input-cancel-button in boundBody) MUST NOT falsely fire caustic or ready!
  const activeOnlyCancel = env.mkEl('button', { 'data-testid': 'input-cancel-button' });
  sqPanel.appendChild(activeOnlyCancel);
  env.deliverMutations();
  activeOnlyCancel.remove(); // host unmounts side-question panel when switching to Doc tab
  setActiveTab('doc-1');
  env.deliverMutations();
  pendingGlideFinish?.();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(tabFg.hasAttribute('data-ag-vtabs-caustic'), false, 'Switching away from active-only running /btw must NOT falsely trigger caustic');
  assert.equal(tabFg.hasAttribute('data-ag-vtabs-ready'), false, 'Switching away from active-only running /btw must NOT falsely trigger ready');

  // 4) Edge Regression (ADD-4): Simultaneous live title update + spinner removal WITHOUT data-tab-id STILL fires caustic="1" + ready="1"
  const noIdStreamTab = env.mkEl('div', { class: 'agy-aux-tab', role: 'tab', 'aria-selected': 'false' });
  const noIdTitleSpan = env.mkEl('span', { class: 'agy-tab-title', text: '/btw Streaming...' });
  const noIdSpinner = env.mkEl('span', { 'data-testid': 'status-loading-spinner' });
  noIdStreamTab.appendChild(noIdTitleSpan);
  noIdStreamTab.appendChild(noIdSpinner);
  fx.tabList.appendChild(noIdStreamTab);
  env.deliverMutations();
  assert.equal(noIdStreamTab.hasAttribute('data-ag-vtabs-caustic'), false);

  noIdTitleSpan.textContent = '/btw Final resolved title';
  noIdSpinner.remove();
  env.deliverMutations();
  assert.equal(noIdStreamTab.getAttribute('data-ag-vtabs-caustic'), '1', 'Simultaneous title edit + spinner removal without data-tab-id must still fire caustic="1"');
  assert.equal(noIdStreamTab.getAttribute('data-ag-vtabs-ready'), '1', 'Simultaneous title edit + spinner removal without data-tab-id must still fire ready="1"');

  // 5) Edge Regression (S-3d): React-reused DOM node switching btw -> doc clears stale data-ag-vtabs-ready="1"
  noIdStreamTab.setAttribute('data-tab-id', 'recycled-doc-node');
  noIdTitleSpan.textContent = 'Artifact: recycled.md';
  env.deliverMutations();
  assert.equal(noIdStreamTab.getAttribute('data-ag-vtabs-cat'), 'doc');
  assert.equal(noIdStreamTab.hasAttribute('data-ag-vtabs-ready'), false, 'React-reused DOM node switching btw -> doc must clear stale data-ag-vtabs-ready="1"');
  noIdStreamTab.remove();
  env.deliverMutations();

  // 6) Edge Regression (ADD-4): Hidden spinners (hidden attr, Tailwind .hidden, display:none) MUST NOT trigger caustic or ready
  const hiddenSpin1 = env.mkEl('span', { 'data-testid': 'status-loading-spinner', hidden: true });
  const hiddenSpin2 = env.mkEl('span', { class: 'animate-spin hidden' });
  const hiddenSpin3 = env.mkEl('span', { 'data-testid': 'status-task-running' });
  hiddenSpin3.style.display = 'none';
  tabBg.appendChild(hiddenSpin1);
  tabBg.appendChild(hiddenSpin2);
  tabBg.appendChild(hiddenSpin3);
  env.deliverMutations();
  hiddenSpin1.remove();
  hiddenSpin2.remove();
  hiddenSpin3.remove();
  env.deliverMutations();
  assert.equal(tabBg.hasAttribute('data-ag-vtabs-caustic'), false, 'Hidden spinners must NOT falsely trigger caustic');
  assert.equal(tabBg.hasAttribute('data-ag-vtabs-ready'), false, 'Hidden spinners must NOT falsely trigger ready');

  // 7) Edge Regression (S-3b): Closing running /btw Tab 0 shifting idle /btw Tab 1 to index 0 (no data-tab-id) MUST NOT falsely trigger caustic/ready on Tab 1
  const shiftTab0 = env.mkEl('div', { class: 'agy-aux-tab', role: 'tab', 'aria-selected': 'false' });
  shiftTab0.appendChild(env.mkEl('span', { class: 'agy-tab-title', text: '/btw Identical label' }));
  shiftTab0.appendChild(env.mkEl('span', { 'data-testid': 'status-loading-spinner' }));
  const shiftTab1 = env.mkEl('div', { class: 'agy-aux-tab', role: 'tab', 'aria-selected': 'false' });
  shiftTab1.appendChild(env.mkEl('span', { class: 'agy-tab-title', text: '/btw Identical label' }));
  fx.tabList.appendChild(shiftTab0);
  fx.tabList.appendChild(shiftTab1);
  env.deliverMutations();
  shiftTab0.remove();
  env.deliverMutations();
  assert.equal(shiftTab1.hasAttribute('data-ag-vtabs-caustic'), false, 'Closing running /btw Tab 0 shifting idle Tab 1 to index 0 must NOT falsely fire caustic');
  assert.equal(shiftTab1.hasAttribute('data-ag-vtabs-ready'), false, 'Closing running /btw Tab 0 shifting idle Tab 1 to index 0 must NOT falsely fire ready');
  shiftTab1.remove();
  env.deliverMutations();

  // 8) Multi-pane conversation switch while a /btw is running MUST NOT falsely trigger caustic or ready
  const bgSpin2 = env.mkEl('span', { 'data-testid': 'status-loading-spinner' });
  tabBg.appendChild(bgSpin2);
  env.deliverMutations();

  // Wholesale pane switch replaces strip tab set with a different pane's non-running /btw
  fx.tabList.replaceChildren();
  const pane2Tab = createNativeTab(env, { id: 'pane2-btw-1', label: '/btw Pane 2 idle question', active: false }, {}).tab;
  const pane2Doc = createNativeTab(env, { id: 'pane2-doc-1', label: 'Artifact: pane2.md', active: true }, {}).tab;
  fx.tabList.appendChild(pane2Doc);
  fx.tabList.appendChild(pane2Tab);
  env.deliverMutations();
  assert.equal(pane2Tab.hasAttribute('data-ag-vtabs-caustic'), false, 'Pane switch must NEVER falsely trigger caustic');
  assert.equal(pane2Tab.hasAttribute('data-ag-vtabs-ready'), false, 'Pane switch must NEVER falsely trigger ready');

  // Part C: Zero-Leak Teardown while caustic, glide, ready, custom width & ord chips are all active
  const pane2Btw2 = createNativeTab(env, { id: 'pane2-btw-2', label: '/btw Pane 2 second thread', active: false }, {}).tab;
  fx.tabList.appendChild(pane2Btw2);
  env.deliverMutations();
  ctl.setExpandedWidth(240);
  const spin3 = env.mkEl('span', { 'data-testid': 'status-loading-spinner' });
  pane2Tab.appendChild(spin3);
  env.deliverMutations();
  spin3.remove();
  env.deliverMutations();
  assert.equal(pane2Tab.getAttribute('data-ag-vtabs-caustic'), '1');
  assert.equal(pane2Tab.getAttribute('data-ag-vtabs-ready'), '1');
  assert.ok(pane2Tab.querySelector('.ag-cs-vtabs-ord'));

  // Trigger an in-flight glide right before destroy
  pane2Doc._rect = { left: 1260, top: 44, width: 172, height: 32, right: 1432, bottom: 76 };
  pane2Btw2._rect = { left: 1260, top: 116, width: 172, height: 32, right: 1432, bottom: 148 };
  pane2Doc.setAttribute('aria-selected', 'false');
  pane2Doc.removeAttribute('data-active');
  pane2Btw2.setAttribute('aria-selected', 'true');
  pane2Btw2.setAttribute('data-active', 'true');
  env.deliverMutations();
  assert.equal(fx.tabList.getAttribute('data-ag-vtabs-gliding'), '1');

  ctl.destroy();
  assert.equal(lastGlideCancelled, true, 'destroy() must cancel in-flight glide animation handle');
  assert.equal(env.activeMOs.size, 0, 'destroy() must disconnect all MutationObservers');
  assert.equal(env.activeROs.size, 0, 'destroy() must disconnect all ResizeObservers');
  assert.equal(env.activeTimers.size, 0, 'destroy() must clear all caustic/glide timers');
  assert.equal(env.rafQueue.size, 0, 'destroy() must cancel all pending rAFs');
  for (const sel of ['.ag-cs-vtabs-head', '.ag-cs-vtabs-toggle', '.ag-cs-vtabs-sash', '.ag-cs-vtabs-glide-bar', '.ag-cs-vtabs-ord']) {
    assert.equal(env.doc.querySelector(sel), null, `destroy() must remove ${sel}`);
  }
  assert.deepEqual(env.findAnyVtabsAttrs(), [], 'destroy() must strip all 29 data-ag-vtabs-* attributes');
  assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '', 'destroy() must clear inline --ag-vtabs-w on host');
  assert.equal(fx.strip.style.getPropertyValue('--ag-vtabs-w'), '', 'destroy() must clear inline --ag-vtabs-w on strip');
  assert.equal(fx.strip.style.getPropertyValue('--ag-vtabs-top-inset'), '', 'destroy() must clear inline --ag-vtabs-top-inset on strip');

  // Verify SIDE_PANEL_VTABS_REMOVE_EXPRESSION scrubs ALL 29 attrs, all 5 owned classes & both inline CSS vars even without live controller
  const remEnv = createRichMockDom({ lang: 'en' });
  const rHost = remEnv.mkEl('div');
  const rStrip = remEnv.mkEl('div');
  rHost.style.setProperty('--ag-vtabs-w', '250px');
  rStrip.style.setProperty('--ag-vtabs-w', '250px');
  rStrip.style.setProperty('--ag-vtabs-top-inset', '40px');
  for (const attr of ALL_29_VTABS_ATTRS) rHost.setAttribute(attr, '1');
  rHost.setAttribute('title', 'Prism Stamped');
  rStrip.setAttribute('data-ag-vtabs-strip', '1');
  rStrip.setAttribute('data-ag-vtabs-top-inset', '1');
  for (const cls of ['ag-cs-vtabs-head', 'ag-cs-vtabs-toggle', 'ag-cs-vtabs-sash', 'ag-cs-vtabs-glide-bar', 'ag-cs-vtabs-ord']) {
    rStrip.appendChild(remEnv.mkEl('div', { class: cls }));
  }
  const styleNode = remEnv.mkEl('style', { id: STYLE_ID, text: '/* css */' });
  remEnv.head.appendChild(styleNode);
  rHost.appendChild(rStrip);
  remEnv.body.appendChild(rHost);

  const remSandbox = { window: null, globalThis: null, document: remEnv.doc };
  remSandbox.window = remSandbox;
  remSandbox.globalThis = remSandbox;
  vm.runInNewContext(cdp.SIDE_PANEL_VTABS_REMOVE_EXPRESSION, remSandbox);

  assert.equal(remEnv.doc.getElementById(STYLE_ID), null);
  for (const cls of ['.ag-cs-vtabs-head', '.ag-cs-vtabs-toggle', '.ag-cs-vtabs-sash', '.ag-cs-vtabs-glide-bar', '.ag-cs-vtabs-ord']) {
    assert.equal(remEnv.doc.querySelector(cls), null, `SIDE_PANEL_VTABS_REMOVE_EXPRESSION must remove ${cls}`);
  }
  assert.deepEqual(remEnv.findAnyVtabsAttrs(), [], 'SIDE_PANEL_VTABS_REMOVE_EXPRESSION must strip all 29 data-ag-vtabs-* attrs');
  assert.equal(rHost.getAttribute('title'), null, 'SIDE_PANEL_VTABS_REMOVE_EXPRESSION must strip Prism-owned title');
  assert.equal(rHost.style.getPropertyValue('--ag-vtabs-w'), '', 'SIDE_PANEL_VTABS_REMOVE_EXPRESSION must remove inline --ag-vtabs-w on host');
  assert.equal(rStrip.style.getPropertyValue('--ag-vtabs-w'), '', 'SIDE_PANEL_VTABS_REMOVE_EXPRESSION must remove inline --ag-vtabs-w on strip');
  assert.equal(rStrip.style.getPropertyValue('--ag-vtabs-top-inset'), '', 'SIDE_PANEL_VTABS_REMOVE_EXPRESSION must remove inline --ag-vtabs-top-inset on strip');
});

// ── 17. Live Desktop Bug #1a: Side-Panel /btw Never Triggers Main/Side Composer Caustic (conv-aura.js + stream-choreography.js) ──
test('17. Live Desktop Bug #1a: side-panel /btw never tricks isConvRunning() or triggers composer caustic while preserving isAwaitingDecision() & main composer caustic', () => {
  const env = createRichMockDom({ lang: 'en' });
  env.html.setAttribute('data-ag-cs-motion', 'ultra');

  // Build authentic layout with main conversation-view composer AND right side-panel /btw composer + extra side-panel composer
  const mainConvView = env.mkEl('div', { 'data-testid': 'conversation-view' });
  const mainInputBox = env.mkEl('div', { 'data-testid': 'agent-input-box' });
  const mainComposerCard = env.mkEl('div', { class: 'surface-composer-card' });
  mainInputBox.appendChild(mainComposerCard);
  mainConvView.appendChild(mainInputBox);
  env.body.appendChild(mainConvView);

  const sidePanelBody = env.mkEl('div', { 'data-side-panel-body': '' });
  const sideQuestionPanel = env.mkEl('div', { 'data-testid': 'side-question-panel' });
  const btwInputBox = env.mkEl('div', { 'data-testid': 'agent-input-box' });
  const btwComposerCard = env.mkEl('div', { class: 'surface-composer-card' });
  btwInputBox.appendChild(btwComposerCard);
  sideQuestionPanel.appendChild(btwInputBox);
  sidePanelBody.appendChild(sideQuestionPanel);

  // Additional non-side-question composer inside [data-side-panel-body]
  const sideExtraInputBox = env.mkEl('div', { 'data-testid': 'agent-input-box' });
  const sideExtraComposerCard = env.mkEl('div', { class: 'surface-composer-card' });
  sideExtraInputBox.appendChild(sideExtraComposerCard);
  sidePanelBody.appendChild(sideExtraInputBox);
  env.body.appendChild(sidePanelBody);

  let fakeNow = 10000;
  const sandbox = {
    window: null,
    globalThis: null,
    document: env.doc,
    performance: { now: () => fakeNow },
    requestAnimationFrame: env.win.requestAnimationFrame,
    cancelAnimationFrame: env.win.cancelAnimationFrame,
    setTimeout: env.win.setTimeout,
    clearTimeout: env.win.clearTimeout,
    Math, Date, Map, Set, WeakMap, WeakSet, Array, Object, String, Number, Boolean, RegExp,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const convAuraSrc = fs.readFileSync(path.join(ROOT, 'conv-aura.js'), 'utf8');
  const streamChoreoSrc = fs.readFileSync(path.join(ROOT, 'stream-choreography.js'), 'utf8');
  vm.runInNewContext(convAuraSrc, sandbox);
  vm.runInNewContext(streamChoreoSrc, sandbox);

  const convAura = sandbox.__agPrismConvAura;
  const streamApi = sandbox.__agPrismStreamChoreography;
  assert.ok(convAura && typeof convAura.isConvRunning === 'function' && typeof convAura.isAwaitingDecision === 'function');
  assert.ok(streamApi && typeof streamApi.createStreamChoreographyController === 'function');

  // 1) Running button inside [data-testid="side-question-panel"] (inside [data-side-panel-body]) MUST NOT make isConvRunning() true,
  //    while isAwaitingDecision() MUST STILL return true for [data-testid="side-question-panel"]!
  const btwCancelBtn = env.mkEl('button', { 'data-testid': 'input-cancel-button' });
  sideQuestionPanel.appendChild(btwCancelBtn);
  fakeNow += 300;
  assert.equal(convAura.isConvRunning(true), false, 'isConvRunning(doc) must ignore input-cancel-button inside side-question-panel');
  assert.equal(convAura.isConvRunning(true, mainConvView), false, 'isConvRunning(mainConvView) must ignore input-cancel-button inside side-question-panel');
  assert.equal(convAura.isAwaitingDecision(true), true, 'isAwaitingDecision(doc) must STILL detect [data-testid="side-question-panel"]');
  assert.equal(convAura.isAwaitingDecision(true, mainConvView), true, 'isAwaitingDecision(mainConvView) must STILL detect [data-testid="side-question-panel"]');
  btwCancelBtn.remove();

  // 2) Running button directly inside [data-side-panel-body] (outside side-question-panel) MUST also make isConvRunning() return false!
  const bodyCancelBtn = env.mkEl('button', { 'data-testid': 'input-cancel-button' });
  sideExtraInputBox.appendChild(bodyCancelBtn);
  fakeNow += 300;
  assert.equal(convAura.isConvRunning(true), false, 'isConvRunning(doc) must ignore input-cancel-button inside [data-side-panel-body]');
  assert.equal(convAura.isConvRunning(true, mainConvView), false, 'isConvRunning(mainConvView) must ignore input-cancel-button inside [data-side-panel-body]');
  bodyCancelBtn.remove();

  // 3) Running button inside main [data-testid="conversation-view"] MUST STILL make isConvRunning() return true!
  const mainCancelBtn = env.mkEl('button', { 'data-testid': 'input-cancel-button' });
  mainConvView.appendChild(mainCancelBtn);
  fakeNow += 300;
  assert.equal(convAura.isConvRunning(true), true, 'isConvRunning(doc) must return true for main conversation-view cancel button');
  assert.equal(convAura.isConvRunning(true, mainConvView), true, 'isConvRunning(mainConvView) must return true for main conversation-view cancel button');
  mainCancelBtn.remove();
  fakeNow += 300;
  assert.equal(convAura.isConvRunning(true), false);

  // 4) stream-choreography.js syncHeroCCaustics:
  const streamCtl = streamApi.createStreamChoreographyController({
    isDestroyed: () => false,
    isMotionUltra: () => true,
    isMotionStandardOrUltra: () => true,
    isConvRunning: () => convAura.isConvRunning(true),
    setAttrIfChanged: (el, k, v) => { if (el.getAttribute(k) !== v) el.setAttribute(k, v); },
    notifyMascot: () => {},
  });

  // Prime idle state
  streamCtl.syncHeroCCaustics([]);

  // 4a) Side-panel /btw runs for 7s and completes -> ZERO composer caustics on either main or side-panel composer!
  sideQuestionPanel.appendChild(btwCancelBtn);
  fakeNow += 300;
  streamCtl.syncHeroCCaustics([]);
  fakeNow += 7000;
  btwCancelBtn.remove();
  streamCtl.syncHeroCCaustics([]);
  assert.equal(mainComposerCard.hasAttribute('data-ag-cs-caustic'), false, '/btw completion must NEVER fire caustic on main composer');
  assert.equal(btwComposerCard.hasAttribute('data-ag-cs-caustic'), false, '/btw completion must NEVER fire caustic on /btw composer');
  assert.equal(sideExtraComposerCard.hasAttribute('data-ag-cs-caustic'), false, '/btw completion must NEVER fire caustic on side-panel composer');

  // 4b) Main conversation runs for 7s and completes while /btw composer is open -> ONLY main composer gets data-ag-cs-caustic="1"!
  mainConvView.appendChild(mainCancelBtn);
  fakeNow += 300;
  streamCtl.syncHeroCCaustics([]);
  fakeNow += 7000;
  mainCancelBtn.remove();
  streamCtl.syncHeroCCaustics([]);
  assert.equal(mainComposerCard.getAttribute('data-ag-cs-caustic'), '1', 'Main conversation >= 6s completion must fire data-ag-cs-caustic="1" on main composer');
  assert.equal(btwComposerCard.hasAttribute('data-ag-cs-caustic'), false, 'Main conversation completion must NEVER fire caustic on side-question-panel composer');
  assert.equal(sideExtraComposerCard.hasAttribute('data-ag-cs-caustic'), false, 'Main conversation completion must NEVER fire caustic on [data-side-panel-body] composer');

  streamCtl.clearTransientTimers();
  assert.equal(env.activeTimers.size, 0);

  // 5) Multi-pane (views.length > 1) L-M1 regression:
  //    Pane 1 has an excluded [data-side-panel-body] /btw running cancel button + composer BEFORE its main composer;
  //    Pane 2 ALSO has an excluded [data-side-panel-body] /btw composer EARLIER in DOM order than its true main composer!
  {
    const env2 = createRichMockDom({ lang: 'en' });
    env2.html.setAttribute('data-ag-cs-motion', 'ultra');

    const makePaneWithSidePanel = (id) => {
      const pane = env2.mkEl('div', { 'data-testid': 'conversation-view', 'data-pane-id': id });
      const spBody = env2.mkEl('div', { 'data-side-panel-body': '' });
      const sqPanel = env2.mkEl('div', { 'data-testid': 'side-question-panel' });
      const btwBox = env2.mkEl('div', { 'data-testid': 'agent-input-box' });
      const btwCard = env2.mkEl('div', { class: 'surface-composer-card' });
      btwBox.appendChild(btwCard);
      sqPanel.appendChild(btwBox);
      spBody.appendChild(sqPanel);
      pane.appendChild(spBody); // Intentionally placed EARLIER in DOM order than main composer!

      const mainBox = env2.mkEl('div', { 'data-testid': 'agent-input-box' });
      const mainCard = env2.mkEl('div', { class: 'surface-composer-card' });
      mainBox.appendChild(mainCard);
      pane.appendChild(mainBox);
      env2.body.appendChild(pane);
      return { pane, spBody, sqPanel, btwCard, mainCard };
    };

    const p1 = makePaneWithSidePanel('pane-1');
    const p2 = makePaneWithSidePanel('pane-2');

    let fakeNow2 = 20000;
    const sb2 = {
      window: null,
      globalThis: null,
      document: env2.doc,
      performance: { now: () => fakeNow2 },
      requestAnimationFrame: env2.win.requestAnimationFrame,
      cancelAnimationFrame: env2.win.cancelAnimationFrame,
      setTimeout: env2.win.setTimeout,
      clearTimeout: env2.win.clearTimeout,
      Math, Date, Map, Set, WeakMap, WeakSet, Array, Object, String, Number, Boolean, RegExp,
    };
    sb2.window = sb2;
    sb2.globalThis = sb2;
    vm.runInNewContext(convAuraSrc, sb2);
    vm.runInNewContext(streamChoreoSrc, sb2);

    const convAura2 = sb2.__agPrismConvAura;
    const streamCtl2 = sb2.__agPrismStreamChoreography.createStreamChoreographyController({
      isDestroyed: () => false,
      isMotionUltra: () => true,
      isMotionStandardOrUltra: () => true,
      isConvRunning: () => convAura2.isConvRunning(true),
      setAttrIfChanged: (el, k, v) => { if (el.getAttribute(k) !== v) el.setAttribute(k, v); },
      notifyMascot: () => {},
    });
    assert.equal(streamCtl2.findFormalConvViews().length, 2, 'Multi-pane L-M1 fixture must have strictly 2 formal conversation views');
    streamCtl2.syncHeroCCaustics([]);

    // 5a) Pane 1 /btw runs >= 6s inside [data-side-panel-body] -> MUST fire 0 data-ag-cs-caustic on Pane 1 main composer!
    const p1BtwCancel = env2.mkEl('button', { 'data-testid': 'input-cancel-button' });
    p1.sqPanel.appendChild(p1BtwCancel);
    fakeNow2 += 300;
    streamCtl2.syncHeroCCaustics([]);
    fakeNow2 += 7000;
    p1BtwCancel.remove();
    streamCtl2.syncHeroCCaustics([]);
    assert.equal(p1.mainCard.hasAttribute('data-ag-cs-caustic'), false, 'L-M1: 2-pane /btw completion must NEVER fire caustic on Pane 1 main composer');
    assert.equal(p1.btwCard.hasAttribute('data-ag-cs-caustic'), false, 'L-M1: 2-pane /btw completion must NEVER fire caustic on Pane 1 /btw composer');
    assert.equal(p2.mainCard.hasAttribute('data-ag-cs-caustic'), false);

    // 5b) Pane 2 main conversation runs >= 6s -> MUST fire caustic strictly on Pane 2 main composer (skipping earlier p2.btwCard!)
    const p2MainCancel = env2.mkEl('button', { 'data-testid': 'input-cancel-button' });
    p2.pane.appendChild(p2MainCancel);
    fakeNow2 += 300;
    streamCtl2.syncHeroCCaustics([]);
    fakeNow2 += 7000;
    p2MainCancel.remove();
    streamCtl2.syncHeroCCaustics([]);
    assert.equal(p2.mainCard.getAttribute('data-ag-cs-caustic'), '1', 'L-M1: Pane 2 main conversation >= 6s completion must fire caustic on Pane 2 main composer (skipping earlier /btw composer)');
    assert.equal(p2.btwCard.hasAttribute('data-ag-cs-caustic'), false, 'L-M1: Pane 2 main completion must NEVER fire caustic on Pane 2 /btw composer');
    assert.equal(p1.mainCard.hasAttribute('data-ag-cs-caustic'), false, 'L-M1: Pane 2 main completion must NOT fire caustic on Pane 1 main composer');

    streamCtl2.clearTransientTimers();
    assert.equal(env2.activeTimers.size, 0);
  }
});

// ── 18. Live Desktop Bugs #1b, #2 & #3: Authentic Zvd DOM Active State & Glide (Expanded+Collapsed) + Background /btw Completion via agentStateManager & Redux store.subscribe ──
test('18. Live Desktop Bugs #1b, #2 & #3: authentic Zvd DOM (no aria-selected) active state & glide in expanded+collapsed modes + live agentStateManager & ephemeralForkTrajectoriesApi background /btw completion', async () => {
  const vtabsMod = loadVerticalTabsModule();
  const cssText = readVerticalTabsCss();

  // Helper to construct authentic live Antigravity Zvd DOM (NO aria-selected, NO data-active, NO data-state; data-tab-id on CHILD <button>; .agy-hover-actions close wrapper; ZERO spinners in tab DOM!)
  function buildAuthenticZvdFixture(env, tabs, initialActiveId) {
    const fx = buildRightSidePanelFixture(env, { topology: 'nested', tabs: [], hostWidth: 640 });
    if (initialActiveId) fx.strip.setAttribute('data-active-tab-id', initialActiveId);
    const zvdTabs = new Map();
    fx.tabList._rect = { left: 1256, top: 40, width: 180, height: 640, right: 1436, bottom: 680 };

    tabs.forEach((spec, idx) => {
      const isAct = spec.tabId === initialActiveId;
      const tab = env.mkEl('div', {
        class: isAct
          ? 'agy-aux-tab bg-secondary text-foreground flex items-center'
          : 'agy-aux-tab bg-transparent text-secondary-foreground flex items-center',
      });
      // Child <button data-tab-id="..."> holds icon + label (NOT the outer div.agy-aux-tab!)
      const triggerBtn = env.mkEl('button', { type: 'button', 'data-tab-id': spec.tabId });
      const svg = env.doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'agy-tab-icon');
      triggerBtn.appendChild(svg);
      triggerBtn.appendChild(env.mkEl('span', { class: 'truncate', text: spec.label }));
      tab.appendChild(triggerBtn);

      const hoverActions = env.mkEl('div', { class: 'agy-hover-actions pointer-events-none absolute top-0 bottom-0 right-0 z-10' });
      const closeBtn = env.mkEl('button', { type: 'button', 'aria-label': `Close ${spec.label}` });
      const closeSvg = env.doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      closeBtn.appendChild(closeSvg);
      hoverActions.appendChild(closeBtn);
      tab.appendChild(hoverActions);

      tab._rect = {
        left: 1260,
        top: 44 + idx * 36,
        width: 172,
        height: 32,
        right: 1432,
        bottom: 76 + idx * 36,
      };
      fx.tabList.appendChild(tab);
      zvdTabs.set(spec.tabId, { tab, triggerBtn, svg, hoverActions, closeBtn, spec });
    });

    const switchZvdActive = (nextTabId, { omitStripAttr = false } = {}) => {
      if (omitStripAttr) fx.strip.removeAttribute('data-active-tab-id');
      else fx.strip.setAttribute('data-active-tab-id', nextTabId);
      for (const [id, entry] of zvdTabs.entries()) {
        const act = id === nextTabId;
        entry.tab.className = act
          ? 'agy-aux-tab bg-secondary text-foreground flex items-center'
          : 'agy-aux-tab bg-transparent text-secondary-foreground flex items-center';
      }
    };

    return { fx, zvdTabs, switchZvdActive };
  }

  // Part A + Part B: Authentic Zvd active state + Option B glide (expanded + collapsed 42px + bg-secondary fallback) + live agentStateManager background/foreground /btw completion
  {
    const env = createRichMockDom({ lang: 'en' });
    env.html.setAttribute('data-ag-cs-motion', 'ultra');
    const { fx, zvdTabs, switchZvdActive } = buildAuthenticZvdFixture(
      env,
      [
        { tabId: 'artifact__doc1', label: 'Artifact: design.md' },
        { tabId: 'side_question__uuid-1', label: '/btw Explain glide' },
        { tabId: 'side_question__uuid-2', label: '/btw Check cache' },
      ],
      'artifact__doc1'
    );
    const docEntry = zvdTabs.get('artifact__doc1');
    const btw1Entry = zvdTabs.get('side_question__uuid-1');
    const btw2Entry = zvdTabs.get('side_question__uuid-2');

    // Mock __agMotionEngine for Option B FLIP glide & icon spring verification
    const glideCalls = [];
    const springCalls = [];
    let pendingGlideFinish = null;
    env.win.__agMotionEngine = {
      getMotionTier: () => env.html.getAttribute('data-ag-cs-motion') || 'ultra',
      glideIndicator(el, prevR, nextR, opts) {
        glideCalls.push({ el, prevR, nextR, opts });
        const finished = new Promise((resolve) => { pendingGlideFinish = resolve; });
        return {
          finished,
          cancel() {
            const fn = pendingGlideFinish;
            pendingGlideFinish = null;
            fn?.();
          },
        };
      },
      spring(el, keyframes, opts) {
        springCalls.push({ el, keyframes, opts });
        return { finished: Promise.resolve(), cancel() {} };
      },
    };

    // Mock React Context agentStateManager (class ajb) with refcount spy & onDidChange emitter
    const subscribeCalls = [];
    const activeSubs = new Map();
    const providers = new Map();
    let totalOnDidChangeListeners = 0;

    function makeAgentProvider(sqId, initialStatus) {
      let status = initialStatus;
      const listeners = new Set();
      const prov = {
        getState: () => ({ status, executorLoopStatus: status }),
        onDidChange(cb) {
          listeners.add(cb);
          totalOnDidChangeListeners += 1;
          let disposed = false;
          return {
            dispose() {
              if (disposed) return;
              disposed = true;
              if (listeners.delete(cb)) totalOnDidChangeListeners -= 1;
            },
          };
        },
        _setStatus(nextStatus) {
          status = nextStatus;
          for (const cb of [...listeners]) cb({ status, executorLoopStatus: status });
        },
      };
      providers.set(sqId, prov);
      return prov;
    }

    const prov1 = makeAgentProvider('uuid-1', 2); // RUNNING initially
    makeAgentProvider('uuid-2', 1); // IDLE initially

    const mockAgentStateManager = {
      getAgentStates() {
        const out = {};
        for (const [k, p] of providers.entries()) out[k] = p.getState();
        return out;
      },
      peek(id) {
        return providers.get(id) || null;
      },
      subscribe(id) {
        subscribeCalls.push(id);
        activeSubs.set(id, (activeSubs.get(id) || 0) + 1);
        let unsubscribed = false;
        return {
          agentStateProvider: providers.get(id) || null,
          unsubscribe() {
            if (unsubscribed) return;
            unsubscribed = true;
            const cur = activeSubs.get(id) || 0;
            if (cur <= 1) activeSubs.delete(id);
            else activeSubs.set(id, cur - 1);
          },
        };
      },
    };

    fx.root['__reactFiber$zvd'] = {
      memoizedProps: { value: mockAgentStateManager },
      return: null,
    };

    // Start with side_question__uuid-1 active and running (status=2)
    switchZvdActive('side_question__uuid-1');

    const ctl = vtabsMod.createSidePanelVerticalTabsController({
      win: env.win,
      doc: env.doc,
      storage: env.storage,
      cssText,
      getLang: () => 'en',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
    });
    ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
    env.flushRaf();

    const glideBar = fx.tabList.querySelector('.ag-cs-vtabs-glide-bar');
    const toggleBtn = fx.strip.querySelector('.ag-cs-vtabs-toggle');

    // Bug #2 check: data-ag-vtabs-active="1" stamped strictly on active Zvd tab (NO aria-selected / data-active / data-state!)
    assert.equal(btw1Entry.tab.getAttribute('data-ag-vtabs-active'), '1', 'Active Zvd tab must receive data-ag-vtabs-active="1"');
    assert.equal(docEntry.tab.hasAttribute('data-ag-vtabs-active'), false);
    assert.equal(btw2Entry.tab.hasAttribute('data-ag-vtabs-active'), false);
    assert.equal(btw1Entry.tab.getAttribute('data-ag-vtabs-cat'), 'btw');
    assert.equal(btw2Entry.tab.getAttribute('data-ag-vtabs-cat'), 'btw');
    assert.equal(docEntry.tab.getAttribute('data-ag-vtabs-cat'), 'doc');

    // Bug #1b refcount check: subscribes to RUNNING uuid-1 (refcount=1), NEVER subscribes to IDLE uuid-2!
    assert.equal(activeSubs.get('uuid-1'), 1, 'Running /btw uuid-1 must acquire agentStateManager.subscribe refcount=1');
    assert.equal(subscribeCalls.includes('uuid-2'), false, 'Idle /btw uuid-2 must NEVER trigger agentStateManager.subscribe');
    assert.equal(btw1Entry.tab.hasAttribute('data-ag-vtabs-caustic'), false);
    assert.equal(btw1Entry.tab.hasAttribute('data-ag-vtabs-ready'), false);

    // Bug #2 & #3 check (Expanded mode): switching data-active-tab-id from uuid-1 -> artifact__doc1 updates active attr & fires FLIP glide + icon spring!
    switchZvdActive('artifact__doc1');
    env.deliverMutations();
    assert.equal(docEntry.tab.getAttribute('data-ag-vtabs-active'), '1');
    assert.equal(btw1Entry.tab.hasAttribute('data-ag-vtabs-active'), false);
    assert.equal(glideCalls.length, 1, 'Expanded Zvd active switch must invoke glideIndicator');
    assert.equal(glideCalls[0].el, glideBar);
    assert.equal(fx.tabList.getAttribute('data-ag-vtabs-gliding'), '1');
    assert.ok(springCalls.length >= 1, 'Expanded Zvd active switch must pop active tab icon via spring()');
    assert.equal(docEntry.hoverActions.contains(springCalls[0].el), false, 'Icon spring must target tab icon, NOT .agy-hover-actions close button');
    pendingGlideFinish?.();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(fx.tabList.hasAttribute('data-ag-vtabs-gliding'), false);

    // Bug #1b core check: uuid-1 is now in the BACKGROUND (doc1 is active, ZERO DOM mutations, ZERO tab spinners!)
    // Flip uuid-1 agentStateProvider status 2 -> 1 (IDLE) and emit onDidChange!
    prov1._setStatus(1);
    assert.ok(env.rafQueue.size > 0, 'agentStateManager onDidChange must schedule sync rAF with 0 DOM mutations');
    env.flushRaf();
    assert.equal(btw1Entry.tab.getAttribute('data-ag-vtabs-caustic'), '1', 'Background /btw status 2->1 via agentStateManager must stamp data-ag-vtabs-caustic="1"');
    assert.equal(btw1Entry.tab.getAttribute('data-ag-vtabs-ready'), '1', 'Background /btw status 2->1 via agentStateManager must stamp data-ag-vtabs-ready="1"');
    assert.equal(activeSubs.get('uuid-1') || 0, 0, 'Once status hits IDLE (1), unsubscribe() must immediately release refcount to 0');

    // Activating side_question__uuid-1 clears data-ag-vtabs-ready immediately
    switchZvdActive('side_question__uuid-1');
    env.deliverMutations();
    assert.equal(btw1Entry.tab.hasAttribute('data-ag-vtabs-ready'), false, 'Activating completed background /btw must clear data-ag-vtabs-ready immediately');
    pendingGlideFinish?.();
    await new Promise((r) => setTimeout(r, 10));

    // Wait > 920ms -> data-ag-vtabs-caustic auto-clears cleanly
    await new Promise((r) => setTimeout(r, 980));
    assert.equal(btw1Entry.tab.hasAttribute('data-ag-vtabs-caustic'), false, 'data-ag-vtabs-caustic must auto-clear after 920ms');

    // Foreground /btw status 2 -> 1 via agentStateManager fires ONLY caustic="1" (NO ready="1")
    prov1._setStatus(2);
    env.flushRaf();
    assert.equal(activeSubs.get('uuid-1'), 1);
    prov1._setStatus(1);
    env.flushRaf();
    assert.equal(btw1Entry.tab.getAttribute('data-ag-vtabs-caustic'), '1', 'Foreground /btw status 2->1 must fire data-ag-vtabs-caustic="1"');
    assert.equal(btw1Entry.tab.hasAttribute('data-ag-vtabs-ready'), false, 'Foreground /btw completion must NEVER stamp data-ag-vtabs-ready');
    assert.equal(activeSubs.get('uuid-1') || 0, 0);

    // Bug #2 & #3 check (Collapsed 42px mode): active attr & Option B FLIP glide + icon spring BOTH work in collapsed 42px mode!
    toggleBtn.click();
    env.flushRaf();
    assert.equal(fx.host.getAttribute('data-ag-vtabs-collapsed'), '1');
    assert.equal(btw1Entry.tab.getAttribute('data-ag-vtabs-active'), '1', 'Collapsed 42px mode must preserve data-ag-vtabs-active="1"');

    const glidesBeforeCollapsed = glideCalls.length;
    const springsBeforeCollapsed = springCalls.length;
    switchZvdActive('side_question__uuid-2');
    env.deliverMutations();
    assert.equal(btw2Entry.tab.getAttribute('data-ag-vtabs-active'), '1', 'Collapsed 42px Zvd switch must update data-ag-vtabs-active="1"');
    assert.equal(btw1Entry.tab.hasAttribute('data-ag-vtabs-active'), false);
    assert.equal(glideCalls.length, glidesBeforeCollapsed + 1, 'Collapsed 42px Zvd switch must fire Option B glideIndicator');
    assert.equal(fx.tabList.getAttribute('data-ag-vtabs-gliding'), '1');
    assert.ok(springCalls.length > springsBeforeCollapsed, 'Collapsed 42px Zvd switch must fire icon spring');
    pendingGlideFinish?.();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(fx.tabList.hasAttribute('data-ag-vtabs-gliding'), false);

    // Expand back and test pure Tailwind bg-secondary fallback when data-active-tab-id is completely absent!
    toggleBtn.click();
    env.flushRaf();
    switchZvdActive('artifact__doc1', { omitStripAttr: true });
    env.deliverMutations();
    assert.equal(docEntry.tab.getAttribute('data-ag-vtabs-active'), '1', 'Pure Tailwind bg-secondary fallback must detect active tab even without data-active-tab-id');
    assert.equal(btw1Entry.tab.hasAttribute('data-ag-vtabs-active'), false);
    assert.equal(btw2Entry.tab.hasAttribute('data-ag-vtabs-active'), false);
    pendingGlideFinish?.();
    await new Promise((r) => setTimeout(r, 10));

    // Re-enter running state right before destroy() -> verify 0 leaked subs, listeners, timers, or attrs!
    prov1._setStatus(2);
    env.flushRaf();
    assert.equal(activeSubs.get('uuid-1'), 1);
    assert.ok(totalOnDidChangeListeners >= 1);

    ctl.destroy();
    assert.equal(activeSubs.size, 0, 'destroy() must unsubscribe all active agentStateManager subscriptions');
    assert.equal(totalOnDidChangeListeners, 0, 'destroy() must dispose all provider.onDidChange listeners');
    assert.equal(env.activeTimers.size, 0, 'destroy() must clear all timers');
    assert.equal(env.activeMOs.size, 0, 'destroy() must disconnect all MutationObservers');
    assert.deepEqual(env.findAnyVtabsAttrs(), [], 'destroy() must strip all 29 data-ag-vtabs-* attrs');
  }

  // Part C: Background /btw completion via Redux ephemeralForkTrajectoriesApi.queries[sqId].data.status + store.subscribe (with ZERO unrelated-action wakeups!)
  {
    const env = createRichMockDom({ lang: 'en' });
    env.html.setAttribute('data-ag-cs-motion', 'ultra');
    const { fx, zvdTabs } = buildAuthenticZvdFixture(
      env,
      [
        { tabId: 'artifact__doc1', label: 'Artifact: design.md' },
        { tabId: 'side_question__ephem-1', label: '/btw Fork analysis' },
      ],
      'artifact__doc1'
    );
    const ephemEntry = zvdTabs.get('side_question__ephem-1');

    let dispatchCalls = 0;
    const reduxListeners = new Set();
    const layoutSlice = {
      focusedPaneId: 'pane-ephem',
      rootNode: { type: 'leaf', id: 'pane-ephem', cascadeId: 'cid-ephem' },
    };
    const sidePanelSlice = {
      conversationPanes: {
        'cid-ephem': {
          activeTabId: 'artifact__doc1',
          tabs: [
            { id: 'artifact__doc1', content: { type: 'artifactView' } },
            { id: 'side_question__ephem-1', content: { type: 'sideQuestionView', sideQuestionView: { cascadeId: 'ephem-1' } } },
          ],
        },
      },
    };
    let currentState = {
      multiConvoLayout: layoutSlice,
      sidePanelV2: sidePanelSlice,
      ephemeralForkTrajectoriesApi: {
        queries: {
          'ephem-1': { data: { status: 2 } },
        },
      },
      unrelatedHover: { x: 0 },
    };

    const emitRedux = () => {
      for (const fn of [...reduxListeners]) fn();
    };
    const mockStore = {
      getState: () => currentState,
      subscribe(fn) {
        reduxListeners.add(fn);
        return () => { reduxListeners.delete(fn); };
      },
      dispatch() { dispatchCalls += 1; },
    };
    fx.root['__reactFiber$ephem'] = { memoizedProps: { value: { store: mockStore } }, return: null };

    const ctl = vtabsMod.createSidePanelVerticalTabsController({
      win: env.win,
      doc: env.doc,
      storage: env.storage,
      cssText,
      getLang: () => 'en',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
    });
    ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
    env.flushRaf();

    assert.equal(reduxListeners.size, 1, 'Presence of /btw tabs must attach 1 lightweight Redux store.subscribe listener');
    assert.equal(ephemEntry.tab.hasAttribute('data-ag-vtabs-caustic'), false);
    assert.equal(ephemEntry.tab.hasAttribute('data-ag-vtabs-ready'), false);

    // Unrelated Redux actions (same references for relevant slices) MUST cause 0 scanAndSync rAF wakeups!
    for (let k = 1; k <= 5; k++) {
      currentState = { ...currentState, unrelatedHover: { x: k } };
      emitRedux();
    }
    assert.equal(env.rafQueue.size, 0, 'Unrelated Redux actions must schedule 0 scanAndSync rAF wakeups');

    // LDF-2 regression: 20 main-conversation trajectorySummaries ticks + 10 unchanged ephemeralForkTrajectoriesApi ticks MUST cause 0 scanAndSync rAF wakeups!
    for (let k = 1; k <= 20; k++) {
      currentState = {
        ...currentState,
        trajectorySummaries: {
          indexes: { active: { 'main-conv-99': true } },
          summaries: { 'main-conv-99': { status: 2, tick: k } },
        },
      };
      emitRedux();
    }
    assert.equal(env.rafQueue.size, 0, 'LDF-2: 20 main-conversation trajectorySummaries ticks must schedule 0 scanAndSync rAF wakeups');

    for (let k = 1; k <= 10; k++) {
      currentState = {
        ...currentState,
        ephemeralForkTrajectoriesApi: {
          queries: {
            'ephem-1': { data: { status: 2 } },
            'unrelated-fork-77': { data: { status: k % 2 ? 2 : 1, tick: k } },
          },
        },
      };
      emitRedux();
    }
    assert.equal(env.rafQueue.size, 0, 'LDF-2: 10 unchanged ephemeralForkTrajectoriesApi ticks for tracked sqId must schedule 0 scanAndSync rAF wakeups');

    // Flip ephemeralForkTrajectoriesApi status 2 -> 1 (IDLE) via store.subscribe with ZERO DOM mutations!
    currentState = {
      ...currentState,
      ephemeralForkTrajectoriesApi: {
        queries: {
          'ephem-1': { data: { status: 1 } },
        },
      },
    };
    emitRedux();
    assert.ok(env.rafQueue.size > 0, 'Relevant ephemeralForkTrajectoriesApi status flip must wake scanAndSync');
    env.flushRaf();
    assert.equal(ephemEntry.tab.getAttribute('data-ag-vtabs-caustic'), '1', 'Background /btw status 2->1 via ephemeralForkTrajectoriesApi must stamp caustic="1"');
    assert.equal(ephemEntry.tab.getAttribute('data-ag-vtabs-ready'), '1', 'Background /btw status 2->1 via ephemeralForkTrajectoriesApi must stamp ready="1"');

    // Removing the last /btw tab must immediately detach store.subscribe
    ephemEntry.tab.remove();
    env.deliverMutations();
    assert.equal(reduxListeners.size, 0, 'Removing all /btw tabs must immediately unsubscribe Redux listener');

    // Re-attach /btw tab then verify destroy() unsubscribes & cleans up with 0 leaks & 0 dispatch calls
    fx.tabList.appendChild(ephemEntry.tab);
    env.deliverMutations();
    assert.equal(reduxListeners.size, 1);

    ctl.destroy();
    assert.equal(reduxListeners.size, 0, 'destroy() must unsubscribe Redux listener');
    assert.equal(dispatchCalls, 0, 'Redux lookup & subscription must remain 100% read-only (0 dispatch calls)');
    assert.equal(env.activeTimers.size, 0);
    assert.equal(env.activeMOs.size, 0);
    assert.deepEqual(env.findAnyVtabsAttrs(), []);
  }

  // Part D (LDF-1a): Delayed agentMgr.peek(sqId) === null while running via boundBody input-cancel-button -> acquires subscribe(sqId) so host unmount does NOT drop background completion!
  {
    const env = createRichMockDom({ lang: 'en' });
    env.html.setAttribute('data-ag-cs-motion', 'ultra');
    const { fx, zvdTabs, switchZvdActive } = buildAuthenticZvdFixture(
      env,
      [
        { tabId: 'artifact__doc1', label: 'Artifact: design.md' },
        { tabId: 'side_question__delayed-1', label: '/btw Delayed peek' },
      ],
      'side_question__delayed-1'
    );
    const delayedEntry = zvdTabs.get('side_question__delayed-1');

    // Simulate real Antigravity: peek('delayed-1') initially returns null before subscribe; host SideQuestionView holds hostRefCount=1 while mounted and drops it on tab switch!
    let delayedStatus = 2;
    let hostRefCount = 1;
    let prismRefCount = 0;
    let provDestroyed = false;
    let delayedProv = null;
    const delayedListeners = new Set();
    const subscribeCalls = [];

    const ensureDelayedProv = () => {
      if (delayedProv) return delayedProv;
      delayedProv = {
        getState: () => ({ status: delayedStatus, executorLoopStatus: delayedStatus }),
        onDidChange(cb) {
          delayedListeners.add(cb);
          return { dispose() { delayedListeners.delete(cb); } };
        },
        _setStatus(nextSt) {
          if (provDestroyed) return;
          delayedStatus = nextSt;
          for (const cb of [...delayedListeners]) cb({ status: nextSt, executorLoopStatus: nextSt });
        },
      };
      return delayedProv;
    };

    const delayedAgentMgr = {
      getAgentStates: () => (delayedProv && !provDestroyed ? { 'delayed-1': delayedProv.getState() } : {}),
      peek: (id) => (id === 'delayed-1' && delayedProv && !provDestroyed ? delayedProv : null),
      subscribe(id) {
        subscribeCalls.push(id);
        if (id !== 'delayed-1') return { agentStateProvider: null, unsubscribe() {} };
        const prov = ensureDelayedProv();
        prismRefCount += 1;
        let released = false;
        return {
          agentStateProvider: prov,
          unsubscribe() {
            if (released) return;
            released = true;
            prismRefCount -= 1;
            if (hostRefCount + prismRefCount <= 0) {
              provDestroyed = true;
              delayedProv = null;
              delayedListeners.clear();
            }
          },
        };
      },
    };
    fx.root['__reactFiber$delayed'] = { memoizedProps: { value: delayedAgentMgr }, return: null };

    // Running is initially detectable ONLY via boundBody side-question-panel input-cancel-button while peek() returns null!
    const sqPanel = fx.panelBody.querySelector('[data-testid="side-question-panel"]');
    const cancelBtn = env.mkEl('button', { 'data-testid': 'input-cancel-button' });
    sqPanel.appendChild(cancelBtn);

    const ctl = vtabsMod.createSidePanelVerticalTabsController({
      win: env.win,
      doc: env.doc,
      storage: env.storage,
      cssText,
      getLang: () => 'en',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
    });
    ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
    env.flushRaf();

    assert.equal(subscribeCalls.includes('delayed-1'), true, 'LDF-1a: runningBtwSqIds with peek===null must acquire agentMgr.subscribe(sqId)');
    assert.equal(prismRefCount, 1);

    // User switches away to artifact__doc1: host unmounts SideQuestionView (cancelBtn removed + hostRefCount 1 -> 0)
    cancelBtn.remove();
    hostRefCount = 0;
    if (hostRefCount + prismRefCount <= 0) {
      provDestroyed = true;
      delayedProv = null;
      delayedListeners.clear();
    }
    switchZvdActive('artifact__doc1');
    env.deliverMutations();
    assert.equal(provDestroyed, false, 'LDF-1a: Prism refcount must keep agentStateProvider alive across host SideQuestionView unmount');
    assert.equal(delayedEntry.tab.hasAttribute('data-ag-vtabs-caustic'), false);
    assert.equal(delayedEntry.tab.hasAttribute('data-ag-vtabs-ready'), false);

    // Background /btw completes (status 2 -> 1) via onDidChange with ZERO DOM mutations!
    delayedProv._setStatus(1);
    env.flushRaf();
    assert.equal(delayedEntry.tab.getAttribute('data-ag-vtabs-caustic'), '1', 'LDF-1a: background completion after delayed peek must stamp caustic="1"');
    assert.equal(delayedEntry.tab.getAttribute('data-ag-vtabs-ready'), '1', 'LDF-1a: background completion after delayed peek must stamp ready="1"');
    assert.equal(prismRefCount, 0, 'LDF-1a: unsubscribe must release refcount immediately on IDLE');

    ctl.destroy();
    assert.equal(delayedListeners.size, 0);
    assert.equal(env.activeTimers.size, 0);
  }

  // Part E (LDF-1b): Quick IDLE -> RUNNING -> tab switch BEFORE rAF + synchronous onDidChange inside subscribe() (0 redundant extra rAF!)
  {
    const env = createRichMockDom({ lang: 'en' });
    env.html.setAttribute('data-ag-cs-motion', 'ultra');
    const { fx, zvdTabs, switchZvdActive } = buildAuthenticZvdFixture(
      env,
      [
        { tabId: 'artifact__doc1', label: 'Artifact: design.md' },
        { tabId: 'side_question__quick-1', label: '/btw Quick switch' },
      ],
      'side_question__quick-1'
    );
    const quickEntry = zvdTabs.get('side_question__quick-1');

    let qStatus = 1; // Starts IDLE
    let hostRef = 1;
    let prismRef = 0;
    let qDestroyed = false;
    const qListeners = new Set();
    const fireQuickChange = () => {
      for (const cb of [...qListeners]) cb({ status: qStatus, executorLoopStatus: qStatus });
    };
    const quickProv = {
      getState: () => ({ status: qStatus, executorLoopStatus: qStatus }),
      onDidChange(cb) {
        qListeners.add(cb);
        return { dispose() { qListeners.delete(cb); } };
      },
    };
    const quickAgentMgr = {
      getAgentStates: () => (qDestroyed ? {} : { 'quick-1': quickProv.getState() }),
      peek: (id) => (id === 'quick-1' && !qDestroyed ? quickProv : null),
      subscribe(id) {
        if (id !== 'quick-1') return { agentStateProvider: null, unsubscribe() {} };
        prismRef += 1;
        // Fire onDidChange synchronously inside subscribe() to verify syncingSubs suppresses redundant extra rAF!
        fireQuickChange();
        let released = false;
        return {
          agentStateProvider: quickProv,
          unsubscribe() {
            if (released) return;
            released = true;
            prismRef -= 1;
            if (hostRef + prismRef <= 0) {
              qDestroyed = true;
              qListeners.clear();
            }
          },
        };
      },
    };
    fx.root['__reactFiber$quick'] = { memoizedProps: { value: quickAgentMgr }, return: null };

    const ctl = vtabsMod.createSidePanelVerticalTabsController({
      win: env.win,
      doc: env.doc,
      storage: env.storage,
      cssText,
      getLang: () => 'en',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
    });
    ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
    env.flushRaf();
    assert.equal(prismRef, 0, 'Idle /btw must start with 0 subscribe refcount');
    assert.equal(env.rafQueue.size, 0);

    // 1) Provider transitions IDLE (1) -> RUNNING (2) and fires onDidChange (BEFORE any rAF runs!)
    qStatus = 2;
    fireQuickChange();
    assert.equal(prismRef, 1, 'LDF-1b: prov.onDidChange must synchronously acquire agentMgr.subscribe(sqId) on IDLE->RUNNING BEFORE rAF');

    // 2) User switches tab immediately BEFORE rAF flushes: host drops hostRef 1 -> 0
    hostRef = 0;
    if (hostRef + prismRef <= 0) {
      qDestroyed = true;
      qListeners.clear();
    }
    assert.equal(qDestroyed, false, 'LDF-1b: synchronous subscribe must preserve provider across instant pre-rAF tab switch');
    switchZvdActive('artifact__doc1');
    env.deliverMutations();
    assert.equal(env.rafQueue.size, 0, 'LDF-1b: syncingSubs must not leave a redundant extra rAF queued after sync');
    assert.equal(prismRef, 1);

    // 3) Background completion (2 -> 1) fires caustic="1" + ready="1" & releases refcount!
    qStatus = 1;
    fireQuickChange();
    env.flushRaf();
    assert.equal(quickEntry.tab.getAttribute('data-ag-vtabs-caustic'), '1', 'LDF-1b: quick-switch background /btw completion must stamp caustic="1"');
    assert.equal(quickEntry.tab.getAttribute('data-ag-vtabs-ready'), '1', 'LDF-1b: quick-switch background /btw completion must stamp ready="1"');
    assert.equal(prismRef, 0);

    // Verify synchronous onDidChange during subscribe() inside syncBtwLiveSubscriptions queues 0 extra rAF!
    const ctl2Env = createRichMockDom({ lang: 'en' });
    const fx2 = buildAuthenticZvdFixture(
      ctl2Env,
      [{ tabId: 'side_question__quick-1', label: '/btw Sync sub noise' }],
      'side_question__quick-1'
    ).fx;
    qStatus = 2;
    hostRef = 1;
    prismRef = 0;
    qDestroyed = false;
    qListeners.clear();
    fx2.root['__reactFiber$quick2'] = { memoizedProps: { value: quickAgentMgr }, return: null };
    const ctl2 = vtabsMod.createSidePanelVerticalTabsController({
      win: ctl2Env.win,
      doc: ctl2Env.doc,
      storage: ctl2Env.storage,
      cssText,
      getLang: () => 'en',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
    });
    ctl2.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
    assert.equal(ctl2Env.rafQueue.size, 0, 'LDF-1b: synchronous onDidChange during subscribe() in syncBtwLiveSubscriptions must queue 0 redundant rAF');
    ctl2.destroy();
    ctl.destroy();
    assert.equal(qListeners.size, 0);
    assert.equal(env.activeTimers.size, 0);
  }

  // Part F (LDF-3): Close button carrying [data-tab-id] preceding the real tab trigger button must be skipped by getTabId(tab, closeBtn)
  {
    const env = createRichMockDom({ lang: 'en' });
    env.html.setAttribute('data-ag-cs-motion', 'ultra');
    const fx = buildRightSidePanelFixture(env, { topology: 'nested', tabs: [], hostWidth: 640 });
    fx.strip.setAttribute('data-active-tab-id', 'artifact__doc-ldf3');
    fx.tabList._rect = { left: 1256, top: 40, width: 180, height: 640, right: 1436, bottom: 680 };

    const mkCloseFirstTab = (tabId, label, idx, active) => {
      const tab = env.mkEl('div', {
        class: active ? 'agy-aux-tab bg-secondary text-foreground' : 'agy-aux-tab bg-transparent text-secondary-foreground',
      });
      // Close button carrying a conflicting [data-tab-id] placed BEFORE the real tab trigger button!
      const closeBtn = env.mkEl('button', {
        type: 'button',
        'aria-label': `Close ${label}`,
        'data-tab-id': `close-decoy-${idx}`,
      });
      closeBtn.appendChild(env.doc.createElementNS('http://www.w3.org/2000/svg', 'svg'));
      tab.appendChild(closeBtn);

      const triggerBtn = env.mkEl('button', { type: 'button', 'data-tab-id': tabId });
      triggerBtn.appendChild(env.doc.createElementNS('http://www.w3.org/2000/svg', 'svg'));
      triggerBtn.appendChild(env.mkEl('span', { text: label }));
      tab.appendChild(triggerBtn);

      tab._rect = { left: 1260, top: 44 + idx * 36, width: 172, height: 32, right: 1432, bottom: 76 + idx * 36 };
      fx.tabList.appendChild(tab);
      return { tab, closeBtn, triggerBtn };
    };

    const tDoc = mkCloseFirstTab('artifact__doc-ldf3', 'Artifact: report.md', 0, true);
    const tBtw = mkCloseFirstTab('side_question__ldf3-1', '/btw Inspect close btn', 1, false);

    const glideCalls = [];
    env.win.__agMotionEngine = {
      getMotionTier: () => 'ultra',
      glideIndicator(el, prevR, nextR, opts) {
        glideCalls.push({ el, prevR, nextR, opts });
        return { finished: Promise.resolve(), cancel() {} };
      },
      spring: () => ({ finished: Promise.resolve(), cancel() {} }),
    };

    const ctl = vtabsMod.createSidePanelVerticalTabsController({
      win: env.win,
      doc: env.doc,
      storage: env.storage,
      cssText,
      getLang: () => 'en',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
    });
    ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
    env.flushRaf();

    assert.equal(tDoc.tab.getAttribute('data-ag-vtabs-active'), '1', 'LDF-3: getTabId must skip closeBtn[data-tab-id] and resolve true active tab');
    assert.equal(tBtw.tab.hasAttribute('data-ag-vtabs-active'), false);
    assert.equal(tBtw.tab.getAttribute('data-ag-vtabs-cat'), 'btw');

    fx.strip.setAttribute('data-active-tab-id', 'side_question__ldf3-1');
    tDoc.tab.className = 'agy-aux-tab bg-transparent text-secondary-foreground';
    tBtw.tab.className = 'agy-aux-tab bg-secondary text-foreground';
    env.deliverMutations();
    assert.equal(tBtw.tab.getAttribute('data-ag-vtabs-active'), '1', 'LDF-3: switching active tab must stamp data-ag-vtabs-active="1" on true tab');
    assert.equal(tDoc.tab.hasAttribute('data-ag-vtabs-active'), false);
    assert.equal(glideCalls.length, 1, 'LDF-3: Option B glide must fire when switching between tabs with closeBtn[data-tab-id]');

    ctl.destroy();
    assert.deepEqual(env.findAnyVtabsAttrs(), []);
  }
});

// ── 19. Beta.4 Anti-Clip (RC-1 / RC-2 / RC-3 / RC-4), Top-Right Cluster Clearance, Turkish `tr`/`kapat` & Real __agPrismDomBus ──
test('19. Beta.4 anti-clip (RC-1..RC-4): layout CSS guards, dual-target zero-reflow RO, viewport overflow & RO latch recovery, top-right cluster --ag-vtabs-top-inset, Turkish kapat & real dom-bus', async () => {
  const vtabsMod = loadVerticalTabsModule();
  const layoutCss = fs.readFileSync(path.join(ROOT, 'vendor/side-panel-vertical-tabs/vtabs-layout.css'), 'utf8');
  const fullCss = readVerticalTabsCss();
  const layoutRules = parseFlatCssRules(layoutCss);

  // Part A (RC-1 / RC-2 / RC-3 / RC-4): Static vtabs-layout.css anti-clip & clearance contracts
  const splitSizedGuard = layoutRules.find(
    (r) =>
      r.selectors.some(
        (s) =>
          s.includes('[data-testid="aux-pane-split"][data-ag-cs-aux-dual="1"]') &&
          s.includes(':not([data-split-overlaid="true"])') &&
          s.includes('[data-split-sized]')
      ) && /max-width\s*:\s*100%\s*!important/i.test(r.body)
  );
  assert.ok(splitSizedGuard, 'RC-1: vtabs-layout.css must clamp [data-split-sized] to max-width: 100% !important');

  const compactSidebarGuard = layoutRules.find(
    (r) =>
      r.selectors.some(
        (s) =>
          s.includes('[data-ag-cs-sidebar="on"][data-ag-cs-sidebar-collapsed="1"]') &&
          s.includes('[data-testid="sidebar-split"] > div:last-child')
      ) &&
      /min-width\s*:\s*min\(\s*609px\s*,\s*calc\(\s*100%\s*-\s*53px\s*\)\s*\)\s*!important/i.test(r.body) &&
      /max-width\s*:\s*calc\(\s*100%\s*-\s*53px\s*\)\s*!important/i.test(r.body)
  );
  assert.ok(compactSidebarGuard, 'RC-2: vtabs-layout.css must guard compact collapsed sidebar-split > div:last-child against right-edge viewport overflow');

  const hostBoundsRule = layoutRules.find(
    (r) =>
      r.selectors.some((s) => getRightmostCompoundSelector(s) === '[data-ag-vtabs-host="1"]') &&
      /max-width\s*:\s*100%\s*!important/i.test(r.body) &&
      /box-sizing\s*:\s*border-box\s*!important/i.test(r.body)
  );
  assert.ok(hostBoundsRule, 'RC-4: [data-ag-vtabs-host="1"] must set max-width: 100% !important and box-sizing: border-box !important');

  const bodyOverflowRule = layoutRules.find(
    (r) =>
      r.selectors.some((s) => getRightmostCompoundSelector(s) === '[data-ag-vtabs-body="1"]') &&
      /overflow\s*:\s*hidden\s*!important/i.test(r.body)
  );
  const bodySlotOverflowRule = layoutRules.find(
    (r) =>
      r.selectors.some((s) => getRightmostCompoundSelector(s) === '[data-ag-vtabs-body-slot="1"]') &&
      /overflow\s*:\s*hidden\s*!important/i.test(r.body)
  );
  assert.ok(bodyOverflowRule && bodySlotOverflowRule, 'RC-4: [data-ag-vtabs-body="1"] and [data-ag-vtabs-body-slot="1"] must set overflow: hidden !important');

  assert.ok(
    /min\(\s*var\(--ag-vtabs-w\s*,\s*180px\)\s*,\s*100%\s*\)/i.test(layoutCss),
    'RC-4: vtabs-layout.css must clamp strip width with min(var(--ag-vtabs-w, 180px), 100%)'
  );
  assert.ok(
    layoutCss.includes('--ag-vtabs-top-inset') && layoutCss.includes('[data-ag-vtabs-top-inset="1"]'),
    'RC-3: vtabs-layout.css must reserve --ag-vtabs-top-inset and style [data-ag-vtabs-top-inset="1"]'
  );

  // Part B (RC-4): Dual-target zero-reflow RO — clipBoxWidth=408 (< 420) auto-collapses even when hostBoxWidth=442 (>= 420)
  {
    const env = createRichMockDom({
      lang: 'en',
      initialStorage: { [STORAGE_COLLAPSED_KEY]: '0' },
    });
    const fx = buildRightSidePanelFixture(env, { topology: 'nested', hostWidth: 442 });

    // Wrap fx.host inside host's real auxLast > [data-split-sized] clipping hierarchy
    const auxLast = fx.rightSlot;
    auxLast._rect = { left: 880, top: 0, width: 442, height: 720, right: 1322, bottom: 720 };
    auxLast._clientWidth = 442;
    const splitSized = env.mkEl(
      'div',
      { 'data-split-sized': '' },
      { left: 880, top: 0, width: 442, height: 720, right: 1322, bottom: 720 }
    );
    auxLast.removeChild(fx.host);
    splitSized.appendChild(fx.host);
    auxLast.appendChild(splitSized);

    const ctl = vtabsMod.createSidePanelVerticalTabsController({
      win: env.win,
      doc: env.doc,
      storage: env.storage,
      cssText: fullCss,
      getLang: () => 'en',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
    });
    ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
    env.flushRaf();

    assert.equal(ctl.getState().collapsed, false);
    assert.equal(ctl.getState().autoCollapsed, false);

    // Clip ancestor narrows to 408px while inner [data-split-sized]/host stays 442px -> MUST auto-collapse with 0 sync rect reads!
    env.resetRectReads();
    env.triggerResize(fx.host, 442);
    env.triggerResize(auxLast, 408);
    assert.equal(env.totalRectReads, 0, 'RC-4: Dual-target RO callback must perform ZERO synchronous getBoundingClientRect() reads');
    assert.equal(ctl.getState().autoCollapsed, true, 'RC-4: clipBoxWidth=408 < 420 must trigger autoCollapsed even when hostBoxWidth=442');
    assert.equal(ctl.getState().collapsed, true);
    assert.equal(fx.host.getAttribute('data-ag-vtabs-auto-collapsed'), '1');
    assert.equal(fx.host.getAttribute('data-ag-vtabs-collapsed'), '1');
    assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '42px');

    // Clip ancestor widens back to 430px (>= 420) -> restores expanded state with 0 sync rect reads!
    env.resetRectReads();
    env.triggerResize(auxLast, 430);
    assert.equal(env.totalRectReads, 0, 'RC-4: Widening clip ancestor RO callback must perform ZERO sync rect reads');
    assert.equal(ctl.getState().autoCollapsed, false, 'RC-4: clipBoxWidth=430 >= 420 must clear autoCollapsed');
    assert.equal(ctl.getState().collapsed, false);
    assert.equal(fx.host.hasAttribute('data-ag-vtabs-auto-collapsed'), false);
    assert.equal(fx.host.hasAttribute('data-ag-vtabs-collapsed'), false);

    const winResizeBeforeDestroy = env.countWinListeners(['resize']);
    assert.ok(winResizeBeforeDestroy >= 1, 'RC-4: Controller must attach passive window resize fallback listener');

    // Red-team #167 #4a: Real window 'resize' viewport overflow (rect.right > win.innerWidth) triggers auto-collapse
    env.win.innerWidth = 1000;
    fx.host._rect = { left: 620, top: 0, width: 442, height: 720, right: 1062, bottom: 720 };
    auxLast._rect = { left: 620, top: 0, width: 442, height: 720, right: 1062, bottom: 720 };
    env.win.dispatchEvent(new env.MockEvent('resize'));
    env.flushRaf();
    assert.equal(ctl.getState().autoCollapsed, true, 'RC-4: window resize overflow (visible 380 < 420) must auto-collapse');
    assert.equal(ctl.getState().collapsed, true);
    assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '42px');

    // Red-team #168 #5: Fully pushed past right edge (rect.left >= win.innerWidth) must clamp to >= 1px (stay autoCollapsed, NEVER 0 unclamped!)
    fx.host._rect = { left: 1010, top: 0, width: 442, height: 720, right: 1452, bottom: 720 };
    auxLast._rect = { left: 1010, top: 0, width: 442, height: 720, right: 1452, bottom: 720 };
    env.win.dispatchEvent(new env.MockEvent('resize'));
    env.flushRaf();
    assert.equal(ctl.getState().autoCollapsed, true, '#168 #5: rect.left >= win.innerWidth must keep autoCollapsed=true (not treat 0 as unclamped)');
    assert.equal(ctl.getState().collapsed, true);
    assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '42px');

    // Red-team #167 #2: Widening via inner split sash (RO ONLY, NO window 'resize' event) clears stale viewportVisibleWidth latch via rAF!
    env.win.innerWidth = 1500;
    fx.host._rect = { left: 880, top: 0, width: 600, height: 720, right: 1480, bottom: 720 };
    auxLast._rect = { left: 880, top: 0, width: 600, height: 720, right: 1480, bottom: 720 };
    env.triggerResize(fx.host, 600);
    env.triggerResize(auxLast, 600);
    env.flushRaf();
    assert.equal(ctl.getState().autoCollapsed, false, '#167 #2: RO widening without window resize must clear stale viewportVisibleWidth latch');
    assert.equal(ctl.getState().collapsed, false);
    assert.equal(fx.host.hasAttribute('data-ag-vtabs-auto-collapsed'), false);

    ctl.destroy();
    assert.equal(env.countWinListeners(['resize']), 0, 'RC-4: destroy() must remove passive window resize listener');
    assert.equal(env.activeROs.size, 0, 'RC-4: destroy() must disconnect all ResizeObservers (both host & clipTarget)');
  }

  // Part C (RC-3): Top-right floating cluster clearance (--ag-vtabs-top-inset & data-ag-vtabs-top-inset) present vs absent
  {
    const env = createRichMockDom({ lang: 'en' });
    const fx = buildRightSidePanelFixture(env, { topology: 'flat', hostWidth: 600 });

    const ctl = vtabsMod.createSidePanelVerticalTabsController({
      win: env.win,
      doc: env.doc,
      storage: env.storage,
      cssText: fullCss,
      getLang: () => 'en',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'en' }),
    });
    ctl.sync({ sidePanelVerticalTabs: 'on', language: 'en' });
    env.flushRaf();

    // 1) Absent floating cluster -> no top inset
    assert.equal(fx.strip.hasAttribute('data-ag-vtabs-top-inset'), false, 'RC-3: absent top-right cluster must NOT stamp data-ag-vtabs-top-inset');
    assert.equal(fx.strip.style.getPropertyValue('--ag-vtabs-top-inset'), '', 'RC-3: absent top-right cluster must keep --ag-vtabs-top-inset empty');

    // 2) Authentic host top-right floating cluster (.agy-inset-shell > div.absolute.right-0.z-50) mounted -> stamps top-inset with 0 MO loop!
    const floatCluster = env.mkEl(
      'div',
      { class: 'absolute right-0 top-0 z-50 flex items-center' },
      { left: 1414, top: 30, width: 68, height: 40, right: 1482, bottom: 70 }
    );
    floatCluster.appendChild(env.mkEl('button', { type: 'button', 'data-testid': 'toggle-maximize-pane' }));
    floatCluster.appendChild(env.mkEl('button', { type: 'button', 'data-testid': 'toggle-aux-sidebar' }));
    fx.host.appendChild(floatCluster);
    const drain1 = env.drainMutationsAndRaf(30);
    assert.equal(drain1.saturated, false, 'RC-3: stamping --ag-vtabs-top-inset must NOT trigger infinite MO style loop');
    assert.equal(fx.strip.getAttribute('data-ag-vtabs-top-inset'), '1', 'RC-3: visible top-right cluster must stamp data-ag-vtabs-top-inset="1"');
    assert.ok(
      fx.strip.style.getPropertyValue('--ag-vtabs-top-inset').includes('40px'),
      `RC-3: visible top-right cluster must set --ag-vtabs-top-inset (got "${fx.strip.style.getPropertyValue('--ag-vtabs-top-inset')}")`
    );

    // 3) Removing floating cluster clears both attr and inline CSS var cleanly
    floatCluster.remove();
    const drain2 = env.drainMutationsAndRaf(30);
    assert.equal(drain2.saturated, false, 'RC-3: clearing --ag-vtabs-top-inset must NOT trigger infinite MO loop');
    assert.equal(fx.strip.hasAttribute('data-ag-vtabs-top-inset'), false, 'RC-3: removing cluster must remove data-ag-vtabs-top-inset');
    assert.equal(fx.strip.style.getPropertyValue('--ag-vtabs-top-inset'), '', 'RC-3: removing cluster must clear inline --ag-vtabs-top-inset');

    // Re-add cluster before destroy() to confirm zero-leak cleanup
    fx.host.appendChild(floatCluster);
    env.drainMutationsAndRaf(20);
    assert.equal(fx.strip.getAttribute('data-ag-vtabs-top-inset'), '1');
    ctl.destroy();
    assert.equal(fx.strip.hasAttribute('data-ag-vtabs-top-inset'), false, 'RC-3: destroy() must remove data-ag-vtabs-top-inset');
    assert.equal(fx.strip.style.getPropertyValue('--ag-vtabs-top-inset'), '', 'RC-3: destroy() must clear inline --ag-vtabs-top-inset');
  }

  // Part D (Beta.4 & Red-team #167 #1/#3/#5): Turkish `kapat`/`turkce`/`türkçe` + REAL src/runtime/dom-bus.js subscribe/observeSize & streaming self-mutation suppression
  {
    const env = createRichMockDom({ lang: 'tr' });
    env.win.innerWidth = 1600;
    const fx = buildRightSidePanelFixture(env, {
      topology: 'nested',
      hostWidth: 600,
      tabs: [
        { id: 'tr-btw-1', label: '/btw Türkçe yan sohbet', closeLabel: 'Sekmeyi kapat', active: true },
        { id: 'tr-doc-1', label: 'Artifact: plan.md', closeLabel: 'Sekmeyi kapat' },
      ],
    });
    if (typeof vtabsMod.normalizeLang === 'function') {
      assert.equal(vtabsMod.normalizeLang('turkce'), 'tr', '#167 #5: normalizeLang("turkce") must resolve to tr');
      assert.equal(vtabsMod.normalizeLang('türkçe'), 'tr', '#167 #5: normalizeLang("türkçe") must resolve to tr');
    }

    const realBus = domBusMod.createInstance(env.doc, env.win);
    env.win.__agPrismDomBus = realBus;
    env.win.__agPrismI18nExtBeta4 = i18nExtBeta4;

    const ctl = vtabsMod.createSidePanelVerticalTabsController({
      win: env.win,
      doc: env.doc,
      storage: env.storage,
      cssText: fullCss,
      getLang: () => 'tr',
      getConfig: () => ({ sidePanelVerticalTabs: 'on', language: 'tr' }),
    });
    ctl.sync({ sidePanelVerticalTabs: 'on', language: 'tr' });
    env.flushRaf();

    assert.equal(fx.tabEntries[0].closeBtn.getAttribute('data-ag-vtabs-close'), '1', 'Turkish aria-label="Sekmeyi kapat" must be classified as close button');
    const toggleBtn = fx.strip.querySelector('.ag-cs-vtabs-toggle');
    assert.equal(toggleBtn.getAttribute('aria-label'), i18nExtBeta4.getStrings('tr').sidePanelVtabsCollapse);

    // Real dom-bus must hold BOTH MO subscriber AND size observer
    const busDebug = realBus.getDebugState();
    assert.ok(busDebug.subscriberCount >= 1, '#167 #3: real dom-bus must have >= 1 active MO subscriber');
    assert.ok(busDebug.sizeObservedCount >= 1, '#167 #3: real dom-bus must have >= 1 active observeSize target');

    // Real dom-bus observeSize delivers { width, height } (NOT raw ResizeObserverEntry) -> drives auto-collapse & restore cleanly!
    env.resetRectReads();
    env.triggerResize(fx.host, 390);
    assert.equal(env.totalRectReads, 0, '#167 #3: real dom-bus observeSize callback must stay zero-reflow');
    assert.equal(ctl.getState().autoCollapsed, true, '#167 #3: real dom-bus observeSize width=390 must trigger autoCollapsed');
    env.triggerResize(fx.host, 560);
    assert.equal(ctl.getState().autoCollapsed, false, '#167 #3: real dom-bus observeSize width=560 must restore expanded');

    // Red-team #167 #1 / #168 #4: During streaming (isStreaming() === true), self-mutations via setExpandedWidth & toggleCollapsed
    // MUST drain synchronously (priority: 'normal') with ZERO delayed 180ms low-priority timer leakage into scanAndSync()!
    realBus.setStreaming(true);
    env.html.setAttribute('data-ag-cs-stream-active', '1');
    env.deliverMutations();
    env.flushRaf();

    let spuriousStreamRafs = 0;
    const origRaf = env.win.requestAnimationFrame;
    env.win.requestAnimationFrame = (cb) => {
      spuriousStreamRafs += 1;
      return origRaf(cb);
    };
    try {
      ctl.setExpandedWidth(240);
      assert.equal(fx.host.style.getPropertyValue('--ag-vtabs-w'), '240px');
      toggleBtn.click();
      assert.equal(ctl.getState().collapsed, true);
      // Wait past dom-bus LOW_STREAM_THROTTLE_MS (180ms) to verify zero delayed self-mutation delivery!
      await new Promise((r) => setTimeout(r, 230));
      assert.equal(spuriousStreamRafs, 0, '#167 #1: self-mutations during streaming must drain synchronously with 0 delayed scanAndSync rAFs');
      assert.equal(env.rafQueue.size, 0, '#167 #1: no spurious rAF may be queued after streaming setExpandedWidth/toggleCollapsed');
    } finally {
      env.win.requestAnimationFrame = origRaf;
      realBus.setStreaming(false);
      env.html.removeAttribute('data-ag-cs-stream-active');
    }

    ctl.destroy();
    const afterDestroyBus = realBus.getDebugState();
    assert.equal(afterDestroyBus.subscriberCount, 0, '#167 #3: destroy() must remove all real dom-bus MO subscribers');
    assert.equal(afterDestroyBus.sizeObservedCount, 0, '#167 #3: destroy() must remove all real dom-bus size observers');
    realBus.dispose(env.doc, env.win);
    assert.deepEqual(env.findAnyVtabsAttrs(), []);
  }
});
