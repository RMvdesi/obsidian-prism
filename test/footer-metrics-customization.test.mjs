import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const i18nExt = require(path.join(ROOT, 'src', 'runtime', 'i18n-ext-beta4.js'));
const settingsExt = require(path.join(ROOT, 'src', 'runtime', 'settings-ext-beta4.js'));
const inlineMod = require(path.join(ROOT, 'vendor', 'pulse-dashboard', 'inline-fallback.js'));

function mkMockDom() {
  const mk = (tag) => {
    const attrs = new Map();
    const listeners = new Map();
    const el = {
      nodeType: 1,
      tagName: String(tag).toUpperCase(),
      children: [],
      parentNode: null,
      parentElement: null,
      shadowRoot: null,
      isConnected: true,
      hidden: false,
      textContent: '',
      style: { setProperty(k, v) { this[k] = String(v); }, removeProperty(k) { delete this[k]; } },
      get id() { return attrs.get('id') || ''; },
      set id(v) { if (v) attrs.set('id', String(v)); else attrs.delete('id'); },
      get className() { return attrs.get('class') || ''; },
      set className(v) { attrs.set('class', String(v || '')); },
      get nextSibling() {
        const p = el.parentElement;
        if (!p) return null;
        const i = p.children.indexOf(el);
        return i >= 0 ? (p.children[i + 1] || null) : null;
      },
      setAttribute(k, v) { if (k === 'hidden') el.hidden = true; attrs.set(k, String(v)); },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      hasAttribute(k) { return attrs.has(k); },
      removeAttribute(k) { if (k === 'hidden') el.hidden = false; attrs.delete(k); },
      appendChild(c) {
        if (c.parentElement) c.parentElement.removeChild(c);
        c.parentNode = el; c.parentElement = el.tagName === '#SHADOW-ROOT' ? null : el;
        el.children.push(c); return c;
      },
      insertBefore(c, ref) {
        if (!ref) return el.appendChild(c);
        const i = el.children.indexOf(ref);
        if (i < 0) return el.appendChild(c);
        if (c.parentElement) c.parentElement.removeChild(c);
        c.parentNode = el; c.parentElement = el.tagName === '#SHADOW-ROOT' ? null : el;
        el.children.splice(i, 0, c); return c;
      },
      removeChild(c) {
        const i = el.children.indexOf(c);
        if (i >= 0) { el.children.splice(i, 1); c.parentNode = c.parentElement = null; }
        return c;
      },
      remove() { if (el.parentElement) el.parentElement.removeChild(el); },
      attachShadow({ mode }) { const sr = mk('#shadow-root'); sr.mode = mode; sr.host = el; el.shadowRoot = sr; return sr; },
      addEventListener(t, fn) { (listeners.get(t) || listeners.set(t, new Set()).get(t)).add(fn); },
      removeEventListener(t, fn) { listeners.get(t)?.delete(fn); },
      dispatchEvent(ev) { for (const fn of [...(listeners.get(ev.type) || [])]) fn({ stopPropagation() {}, preventDefault() {}, target: el, ...ev }); return true; },
      matches(sel) {
        return String(sel).split(',').some((raw) => {
          let r = raw.trim();
          if (!r || r.includes(' ') || r.includes('>')) return false;
          const tm = r.match(/^[a-zA-Z0-9-]+/);
          if (tm) { if (el.tagName !== tm[0].toUpperCase()) return false; r = r.slice(tm[0].length); }
          for (const m of r.matchAll(/#([a-zA-Z0-9_-]+)/g)) if (el.getAttribute('id') !== m[1]) return false;
          for (const m of r.matchAll(/\.([a-zA-Z0-9_-]+)/g)) if (!(el.getAttribute('class') || '').split(/\s+/).includes(m[1])) return false;
          for (const m of r.matchAll(/\[([a-zA-Z0-9_-]+)(?:=["']?([^"'\]\s]+)["']?)?\]/g)) {
            if (!el.hasAttribute(m[1])) return false;
            if (m[2] !== undefined && el.getAttribute(m[1]) !== m[2]) return false;
          }
          return true;
        });
      },
      closest(sel) { let c = el; while (c && c.tagName !== '#SHADOW-ROOT') { if (c.matches(sel)) return c; c = c.parentElement; } return null; },
      contains(o) { let c = o; while (c) { if (c === el) return true; c = c.parentNode; } return false; },
      getBoundingClientRect() { return { left: 0, top: 0, width: 720, height: 32, right: 720, bottom: 32 }; },
      querySelectorAll(sel) {
        const out = [];
        const walk = (n) => { for (const c of n.children) { if (c.matches(sel)) out.push(c); walk(c); } };
        walk(el);
        return out;
      },
      querySelector(sel) { return el.querySelectorAll(sel)[0] || null; },
      getElementById(id) { return el.querySelector(`#${id}`); },
    };
    return el;
  };
  const html = mk('html'), head = mk('head'), body = mk('body');
  html.appendChild(head); html.appendChild(body);
  const doc = {
    documentElement: html, head, body, hidden: false,
    createElement: mk,
    getElementById: (id) => html.getElementById(id),
    querySelector: (s) => html.querySelector(s),
    querySelectorAll: (s) => html.querySelectorAll(s),
    addEventListener() {}, removeEventListener() {},
  };
  const win = { document: doc, location: { href: 'http://localhost/c/aaaaaaaa-1111-4222-8333-444444444444', pathname: '/c/aaaaaaaa-1111-4222-8333-444444444444', hash: '' }, addEventListener() {}, removeEventListener() {} };
  doc.defaultView = win;
  return { doc, win, html, head, body, mk };
}

test('inline-fallback telemetryMetrics toggles tokens/cache/speed/context and fixes Token CSS specificity', async () => {
  const env = mkMockDom();
  const cv = env.mk('div');
  cv.setAttribute('data-testid', 'conversation-view');
  cv.setAttribute('data-cascade-id', 'aaaaaaaa-1111-4222-8333-444444444444');
  const footer = env.mk('div');
  footer.className = 'agy-composer-footer';
  cv.appendChild(footer);
  env.body.appendChild(cv);

  const ctrl = inlineMod.createTelemetryController({ window: env.win, document: env.doc });
  try {
    env.win.__agPrismMetricsCall = (raw) => {
      const req = JSON.parse(raw);
      env.win.__agPrismMetricsResolve(req.id, {
        connection: 'ok',
        speed: { model: 'Claude Sonnet', tps: 65.4, latestTps: 65.4, ttftSeconds: 0.42, rounds: 3, cacheHitRate: 0.94, totalTokens: 48200, context: { model: 'Claude Sonnet', usedTokens: 48200, maxTokens: 200000, usedFraction: 0.241, sampledAt: Date.now() } },
        groups: [{ id: 'claude', name: 'Claude', windows: { '5h': { remaining: 0.85, resetAt: Date.now() + 3600000 }, weekly: { remaining: 0.62, resetAt: Date.now() + 86400000 } } }],
      });
    };

    // Enable tokens only (no cache), plus speed
    ctrl.sync({ telemetryModule: 'on', telemetryMetrics: 'tokens,speed,context', language: 'zh-CN' });
    await ctrl.refresh();
    const bar = ctrl.getPrimaryBar();
    assert.ok(bar && bar.shadowRoot);
    const sr = bar.shadowRoot;
    const styleText = sr.querySelector('style').textContent;
    assert.match(styleText, /:host\(:not\(\.icons-only\):not\(\[data-show-tok="1"\]\)\)\s+\.chip\[data-card="cache"\]>:is\(\.cache-total,\.dim\)/, 'Token CSS rule must not unconditionally override data-show-tok="1"');
    assert.equal(bar.getAttribute('data-show-tok'), '1');
    assert.equal(bar.getAttribute('data-hide-cache'), '1');
    assert.equal(bar.getAttribute('data-show-speed'), '1');
    assert.equal(sr.querySelector('[data-card="cache"]').hidden, false, 'cache chip hosts .cache-total when tokens is enabled');
    assert.equal(sr.querySelector('[data-card="speed"]').hidden, false);
    assert.equal(sr.querySelector('[data-card="five"]').hidden, true);
    assert.equal(sr.querySelector('[data-card="week"]').hidden, true);

    // Disable tokens & cache -> cache chip hidden
    ctrl.sync({ telemetryModule: 'on', telemetryMetrics: 'five,context', language: 'zh-CN' });
    assert.equal(bar.getAttribute('data-show-tok'), null);
    assert.equal(bar.getAttribute('data-hide-cache'), '1');
    assert.equal(sr.querySelector('[data-card="cache"]').hidden, true);
    assert.equal(sr.querySelector('[data-card="five"]').hidden, false);
    assert.equal(sr.querySelector('[data-card="week"]').hidden, true);
  } finally {
    ctrl.destroy();
  }
});

test('Footer metrics attached pill-chip sub-panel toggles metrics, hides when telemetryModule=off, and has 9-locale copy', () => {
  const env = mkMockDom();
  const sec = env.mk('div');
  sec.setAttribute('data-body-built', '1');
  const telRow = env.mk('div');
  telRow.setAttribute('data-ag-cs-row', 'telemetryModule');
  const card = env.mk('div');
  card.className = 'divide-y';
  card.appendChild(telRow);
  sec.appendChild(card);
  env.body.appendChild(sec);

  const cfg = { telemetryModule: 'on', telemetryQuotaMode: 'compact', telemetryMetrics: '' };
  const syncNow = () => settingsExt.sync(sec, {
    doc: env.doc, win: env.win, lang: 'en', ui: {},
    effVal: (k) => cfg[k],
    saveSettingsBatch: (p) => Object.assign(cfg, p),
    saveSetting: (k, v) => { cfg[k] = v; },
    runGuardedMut: (fn) => fn(),
  });
  syncNow();

  const row = sec.querySelector('[data-ag-cs-row="telemetryQuotaMode"]');
  assert.ok(row);
  assert.equal(row.querySelector('[role="group"]'), null, 'pill-chip container must not use role="group"');
  const chips = row.querySelectorAll('button[data-ag-cs-ext-metric]');
  assert.equal(chips.length, 7);

  // Toggle tokens on
  row.querySelector('button[data-ag-cs-ext-metric="tokens"]').dispatchEvent({ type: 'click' });
  assert.equal(cfg.telemetryMetrics, 'auto,cache,tokens,context');

  // Turning telemetryModule off hides the attached sub-panel
  cfg.telemetryModule = 'off';
  syncNow();
  assert.equal(row.hidden, true);

  // Verify 9-locale completeness & 0 CJK leaks in non-CJK locales
  const cjkRe = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/;
  for (const key of ['setTelemetryMetricsTitle', 'setTelemetryMetricsDesc', 'optMetricAuto', 'optMetricFive', 'optMetricWeek', 'optMetricSpeed', 'optMetricCache', 'optMetricTokens', 'optMetricContext']) {
    assert.equal(i18nExt.TABLE[key].length, 9, `missing locale entry for ${key}`);
    for (let i = 2; i < 9; i++) {
      if (i === 3 || i === 4) continue; // ja, ko
      assert.equal(cjkRe.test(i18nExt.TABLE[key][i]), false, `CJK leak in ${key} locale idx ${i}`);
    }
  }
});
