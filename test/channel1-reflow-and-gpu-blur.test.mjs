import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('upstream-client skips checkVisibility() on single trigger and filters sidebar/hover-card mutations in memoryOnly mode', () => {
  const upSrc = fs.readFileSync(path.join(ROOT, 'vendor/effort-slider/upstream-client.js'), 'utf8');
  let moCb = null;
  let queries = 0;
  let trigCheckVis = 0;
  const singleTrig = {
    nodeType: 1, isConnected: true, hidden: false, style: {},
    matches: () => true, closest: () => null, getAttribute: () => null, hasAttribute: () => false,
    checkVisibility() { trigCheckVis++; return true; },
  };
  const fakeDoc = {
    body: { nodeType: 1, querySelector: () => { queries++; return null; }, querySelectorAll: () => [], appendChild() {} },
    head: { appendChild() {} },
    documentElement: { getAttribute: () => null },
    getElementById: () => null,
    createElement: () => ({ id: '', textContent: '', style: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} } }),
    querySelector: () => { queries++; return null; },
    querySelectorAll: (sel) => (String(sel).includes('model-selector-trigger') ? [singleTrig] : []),
    addEventListener() {}, removeEventListener() {},
  };
  const sb = {
    window: null, document: fakeDoc, __agCodexEffortSliderDisableAutoBoot: true,
    MutationObserver: class { constructor(cb) { moCb = cb; } observe() {} disconnect() {} },
    Set, Map, WeakMap, Array, Object, Math, Number, String, Boolean, Date, Promise, RegExp, JSON,
  };
  sb.window = sb; sb.globalThis = sb;
  vm.runInNewContext(upSrc, sb);

  assert.equal(sb.AntigravityCodexEffortSlider.findAntigravityTrigger(fakeDoc), singleTrig);
  assert.equal(trigCheckVis, 0, 'Single-trigger findAntigravityTrigger must skip synchronous checkVisibility() reflow');

  const obs = sb.AntigravityCodexEffortSlider.installEffortMemoryGuard({ document: fakeDoc, window: sb, MutationObserver: sb.MutationObserver });
  const baseQ = queries;
  const hoverCard = { nodeType: 1, closest: (s) => (s.includes('data-hover-card-popup') ? {} : null) };
  const asideRow = { nodeType: 1, closest: (s) => (s.includes('aside') ? {} : null) };
  moCb([{ type: 'childList', target: hoverCard }, { type: 'childList', target: asideRow }]);
  assert.equal(queries, baseQ, 'installEffortMemoryGuard must skip hover-card and aside mutations with 0 scan() queries');
  obs.stop();
});

test('conv-aura, crystal-prism-core, and sidebar-client enforce ForcedReflow and heavy GPU blur guards', () => {
  const convAuraSrc = fs.readFileSync(path.join(ROOT, 'conv-aura.js'), 'utf8');
  assert.ok(
    convAuraSrc.includes('mountBrandHorizonGlow(glowCanvas, { width: 0, height: 0 })'),
    'conv-aura.js must pass zero initial dimensions to mountBrandHorizonGlow'
  );

  const sbClient = fs.readFileSync(path.join(ROOT, 'vendor/sidebar-studio/sidebar-client.js'), 'utf8');
  assert.equal(sbClient.includes('feGaussianBlur'), false, 'sidebar-client.js must not ship 11-filter feGaussianBlur brand SVG');
  assert.equal(sbClient.includes('blur(96px)'), false, 'sidebar-client.js must not use blur(96px) aura orbs');

  const crystalCore = require(path.join(ROOT, 'crystal-prism-core.js'));
  let rectCalls = 0;
  const mockCv = {
    width: 240, height: 28,
    getBoundingClientRect() { rectCalls++; return { left: 100, top: 200, width: 240, height: 28 }; },
    getContext: (t) => (t === '2d' ? { save() {}, restore() {}, clearRect() {}, beginPath() {}, roundRect() {}, clip() {}, fillRect() {}, stroke() {}, moveTo() {}, lineTo() {}, arc() {}, setTransform() {}, createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) } : null),
    addEventListener() {}, removeEventListener() {},
  };
  const bar = crystalCore.mountCrystalPrismBar(mockCv, { force2D: true, getState: () => ({ isDark: true }) });
  const baseRectCalls = rectCalls;
  for (let i = 0; i < 20; i++) bar.setPointerClient(120 + i * 2, 210);
  assert.equal(rectCalls, baseRectCalls, 'mountCrystalPrismBar.setPointerClient must reuse cached rect across rapid pointer moves');
  bar.dispose();
});

test('DOM perf fixes: suggester-client stops 180Hz self-retrigger MO loop and skips redundant offsetHeight reflow', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'vendor/prompt-suggester/suggester-client.js'), 'utf8');
  let moCb = null;
  let rafCount = 0;
  let offsetHeightReads = 0;
  let overlayAppends = 0;
  const matchSimple = (node, part, attrsMap) => {
    const t = part.trim();
    if (!t) return false;
    const m = /^([a-z0-9_-]*)\[([^\]=]+)(?:="([^"]*)")?\]$/i.exec(t);
    if (m) {
      if (m[1] && node.tagName.toLowerCase() !== m[1].toLowerCase()) return false;
      return m[3] === undefined ? attrsMap.has(m[2]) : attrsMap.get(m[2]) === m[3];
    }
    if (t.startsWith('#')) return node.id === t.slice(1);
    return t.startsWith('.') ? node.classList.contains(t.slice(1)) : node.tagName.toLowerCase() === t.toLowerCase();
  };
  const makeEl = (tag, attrs = {}) => {
    const map = new Map(Object.entries(attrs).map(([k, v]) => [k, String(v)]));
    const children = [];
    const el = {
      nodeType: 1, tagName: tag.toUpperCase(), id: attrs.id || '', className: attrs.class || '',
      isConnected: true, hidden: false, parentElement: null, parentNode: null, children, childNodes: children,
      style: { setProperty() {}, removeProperty() {} },
      classList: { contains: (c) => String(el.className).split(/\s+/).includes(c) },
      get firstChild() { return children[0] || null; },
      get firstElementChild() { return children[0] || null; },
      get nextSibling() {
        if (!el.parentElement) return null;
        const i = el.parentElement.children.indexOf(el);
        return i >= 0 ? el.parentElement.children[i + 1] || null : null;
      },
      get offsetHeight() { offsetHeightReads++; return 22; },
      setAttribute(k, v) { map.set(k, String(v)); if (k === 'id') el.id = String(v); },
      getAttribute(k) { return map.has(k) ? map.get(k) : null; },
      hasAttribute(k) { return map.has(k); },
      removeAttribute(k) { map.delete(k); },
      appendChild(c) {
        c.parentElement = c.parentNode = el;
        children.push(c);
        if (el.getAttribute('data-testid') === 'prism-ghost-overlay') overlayAppends++;
        return c;
      },
      removeChild(c) { const i = children.indexOf(c); if (i >= 0) children.splice(i, 1); c.parentElement = c.parentNode = null; return c; },
      remove() { if (el.parentElement) el.parentElement.removeChild(el); },
      contains(o) { let p = o; while (p) { if (p === el) return true; p = p.parentElement; } return false; },
      addEventListener() {}, removeEventListener() {},
      matches(s) {
        return String(s).split(',').some((sel) => {
          const segs = sel.trim().split(/\s+/).filter(Boolean);
          if (!segs.length) return false;
          if (!matchSimple(el, segs[segs.length - 1], map)) return false;
          let cur = el.parentElement;
          for (let i = segs.length - 2; i >= 0; i--) {
            let found = false;
            while (cur) {
              if (cur.matches?.(segs[i])) { found = true; cur = cur.parentElement; break; }
              cur = cur.parentElement;
            }
            if (!found) return false;
          }
          return true;
        });
      },
      closest(s) { let p = el; while (p) { if (p.matches?.(s)) return p; p = p.parentElement; } return null; },
      querySelectorAll(s) {
        const out = [];
        const walk = (n) => { for (const c of n.children || []) { if (c.matches?.(s)) out.push(c); walk(c); } };
        walk(el);
        return out;
      },
      querySelector(s) { return el.querySelectorAll(s)[0] || null; },
    };
    return el;
  };
  const html = makeEl('html', { 'data-ag-cs-lang': 'en' });
  const head = makeEl('head');
  const body = makeEl('body');
  const conv = makeEl('div', { 'data-testid': 'conversation-view', 'data-cascade-id': 'cid-loop' });
  const assistantTurn = makeEl('div', { 'data-testid': 'agent-response' });
  assistantTurn.childNodes.push({ nodeType: 3, nodeValue: 'Done refactoring.', parentElement: assistantTurn, nextSibling: null });
  const inputBox = makeEl('div', { 'data-testid': 'agent-input-box' });
  const host = makeEl('div', { 'data-ag-cs-caret-host': '1' });
  const editor = makeEl('div', { contenteditable: 'true' });
  host.appendChild(editor); inputBox.appendChild(host); conv.appendChild(assistantTurn); conv.appendChild(inputBox);
  body.appendChild(conv); html.appendChild(head); html.appendChild(body);
  const fakeDoc = {
    hidden: false, documentElement: html, head, body,
    getElementById: (id) => html.querySelectorAll('style').find((x) => x.id === id) || null,
    createElement: (tag) => makeEl(tag),
    querySelector: (s) => html.querySelector(s),
    querySelectorAll: (s) => html.querySelectorAll(s),
    addEventListener() {}, removeEventListener() {},
  };
  const rafQueue = [];
  const sb = {
    window: null, document: fakeDoc, location: { pathname: '/c/cid-loop' }, navigator: { language: 'en' },
    __agPrismSuggestCall(raw) {
      const req = JSON.parse(raw);
      const res = req.action === 'suggest'
        ? { ok: true, suggestion: 'Run the regression test suite', engine: 'mock' }
        : { ok: true, config: { enabled: true, ttlMinutes: 15 } };
      Promise.resolve().then(() => sb.__agPrismSuggesterResolve(req.id, res));
    },
    MutationObserver: class { constructor(cb) { moCb = cb; } observe() {} disconnect() {} takeRecords() { return []; } },
    requestAnimationFrame(fn) { rafCount++; rafQueue.push(fn); return rafCount; },
    cancelAnimationFrame() {},
    setTimeout, clearTimeout, Date, Math, Number, String, Boolean, Array, Object, Map, Set, RegExp, JSON, Promise,
  };
  sb.window = sb; sb.globalThis = sb;
  vm.runInNewContext(src, sb);
  const rt = sb.__agPrismSuggesterFactory({ window: sb, document: fakeDoc });
  rt.applyConfig({ enabled: true, ttlMinutes: 15 });
  const res = await rt.triggerSuggest({ forceRefresh: true });
  assert.equal(res.ok, true, 'Mock suggest RPC must mount ghost overlay');

  const overlayNode = host.querySelector('[data-testid="prism-ghost-overlay"]');
  assert.ok(overlayNode, 'Ghost overlay must be mounted on host');
  assert.equal(overlayNode.getAttribute('data-ag-prism-suggester-owned'), '1', 'markNoTrOwned must stamp data-ag-prism-suggester-owned');
  assert.equal(offsetHeightReads, 1, 'Initial overlay mount reads offsetHeight once');

  // Steady-state re-sync must skip overlay rebuild and forced offsetHeight reflow
  const appendsAfterMount = overlayAppends;
  rt.sync();
  rt.sync();
  assert.equal(offsetHeightReads, 1, 'Steady-state sync() must execute 0 extra offsetHeight reflows');
  assert.equal(overlayAppends, appendsAfterMount, 'Steady-state sync() must perform 0 redundant overlay DOM rebuilds');

  // Self-triggered overlay MutationObserver records must NOT re-schedule rAF
  const rafBefore = rafCount;
  moCb([{ type: 'childList', target: overlayNode, addedNodes: [makeEl('span')], removedNodes: [] }]);
  assert.equal(rafCount, rafBefore, 'Suggester MO must filter its own overlay mutations with 0 rAF self-retriggers');
  rt.destroy();
});

test('DOM perf fixes: motion-engine skips full-subtree querySelector on non-button containers during pointerover', () => {
  const motionEngine = require(path.join(ROOT, 'motion-engine.js'));
  const prevDoc = globalThis.document;
  const prevMM = globalThis.matchMedia;
  const html = { nodeType: 1, getAttribute: () => 'ultra', hasAttribute: () => false };
  globalThis.document = { documentElement: html };
  globalThis.matchMedia = () => ({ matches: false });
  let containerQsCalls = 0;
  const rootListeners = new Map();
  const root = {
    addEventListener(t, fn) { rootListeners.set(t, fn); },
    removeEventListener(t) { rootListeners.delete(t); },
  };
  const chatContainer = {
    nodeType: 1, tagName: 'DIV', parentElement: null, parentNode: null, className: '',
    getAttribute: () => null, hasAttribute: () => false,
    closest: () => null,
    querySelector() { containerQsCalls++; return null; },
  };
  const binding = motionEngine.bindMicroInteractions(root);
  try {
    rootListeners.get('pointerover')({ target: chatContainer, relatedTarget: null });
    assert.equal(containerQsCalls, 0, 'pointerover on a non-button container must execute 0 subtree querySelector walks');
  } finally {
    binding.unbind();
    globalThis.document = prevDoc;
    globalThis.matchMedia = prevMM;
  }
});

test('DOM perf fixes: style.css disables backdrop-filter on side-question-panel, pp-open, and resizing, and narrows ctx-menu transition', () => {
  const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  assert.equal((css.match(/:has\(/g) || []).length, 0);
  assert.equal(/[^\x00-\x7F]/.test(css), false);
  const bfLine = css.split('\n').find((l) => l.includes('backdrop-filter:none !important;') && l.includes('data-ag-cs-win-blur="1"')) || '';
  assert.ok(bfLine.includes('[data-ag-pp-open="1"]'), 'backdrop-filter bypass must include data-ag-pp-open');
  assert.ok(bfLine.includes('[data-ag-cs-resizing="1"]'), 'backdrop-filter bypass must include data-ag-cs-resizing');
  assert.ok(bfLine.includes('[data-testid="side-question-panel"]'), 'backdrop-filter bypass must include side-question-panel');
  assert.equal(css.includes('transition:.11s;'), false, '.ag-cs-ctx-menu > button must not use implicit transition: all (.11s)');
});

test('DOM perf fixes: swarm-i18n-runtime scans only mutated subtrees on MutationObserver records', () => {
  const swarmRuntime = require(path.join(ROOT, 'vendor/host-i18n/swarm-i18n-runtime.js'));
  const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'vendor/host-i18n/swarm-zh-CN.json'), 'utf8'));
  const makeText = (t) => ({ nodeType: 3, nodeValue: t, parentElement: null, parentNode: null, isConnected: true });
  let untouchedReads = 0;
  const makeEl = (tag, attrs = {}) => {
    const map = new Map(Object.entries(attrs));
    const childNodes = [];
    const el = {
      nodeType: 1, tagName: tag.toUpperCase(), id: attrs.id || '', className: attrs.class || '',
      isConnected: true, parentElement: null, parentNode: null, childNodes,
      classList: { contains: (c) => String(el.className).split(/\s+/).includes(c) },
      getAttribute: (k) => (map.has(k) ? map.get(k) : null),
      setAttribute: (k, v) => { map.set(k, String(v)); },
      hasAttribute: (k) => map.has(k),
      removeAttribute: (k) => { map.delete(k); },
      append(c) { c.parentElement = c.parentNode = el; childNodes.push(c); return el; },
      querySelector: (sel) => (sel.includes('o2-root') ? rootDiv : null),
      querySelectorAll: () => [],
      getElementById: () => null,
    };
    return el;
  };
  const html = makeEl('html');
  const body = makeEl('body');
  const rootDiv = makeEl('div', { id: 'o2-root', class: 'o2-root' });
  const untouched = makeEl('div', { class: 'o2-static' });
  const staticTxt = makeText('Static');
  Object.defineProperty(staticTxt, 'nodeValue', {
    get() { untouchedReads++; return 'Static'; },
    set() {},
  });
  untouched.append(staticTxt);
  const mutated = makeEl('div', { class: 'o2-live' });
  const liveTxt = makeText('Running');
  mutated.append(liveTxt);
  rootDiv.append(untouched);
  rootDiv.append(mutated);
  body.append(rootDiv);
  html.append(body);

  let moCb = null;
  let visCb = null;
  const rafs = [];
  const doc = {
    hidden: false, readyState: 'complete', documentElement: html, body,
    querySelector: (sel) => (sel.includes('o2-root') || sel.includes('swarm-tabs') ? rootDiv : null),
    querySelectorAll: () => [], getElementById: (id) => (id === 'o2-root' ? rootDiv : null),
    addEventListener(t, fn) { if (t === 'visibilitychange') visCb = fn; },
    removeEventListener() {},
  };
  const win = {
    location: { href: 'plugin://swarm--swarm_board-1/' },
    document: doc,
    MutationObserver: class { constructor(cb) { moCb = cb; } observe() {} disconnect() {} },
    requestAnimationFrame(fn) { rafs.push(fn); return rafs.length; },
    cancelAnimationFrame() {},
    addEventListener() {}, removeEventListener() {},
  };
  const inst = swarmRuntime.mountSwarmI18n({ root: win, doc, dict, allowNonSwarmLocation: true });
  assert.equal(inst.status, 'active');
  const readsAfterBoot = untouchedReads;
  liveTxt.nodeValue = 'Done';
  moCb([{ type: 'characterData', target: liveTxt }]);
  while (rafs.length) rafs.shift()();
  assert.equal(untouchedReads, readsAfterBoot, 'Incremental MO batch must NOT re-walk untouched sibling subtrees');

  // If document becomes hidden AFTER rAF is scheduled but BEFORE rAF runs, pendingWhileHidden must remain armed and wake on focus/visibility
  liveTxt.nodeValue = 'Running';
  moCb([{ type: 'characterData', target: liveTxt }]);
  assert.equal(rafs.length, 1);
  doc.hidden = true;
  rafs.shift()();
  assert.equal(liveTxt.nodeValue, 'Running', 'Hibernated rAF must skip scan');
  doc.hidden = false;
  visCb?.();
  assert.equal(rafs.length, 1, 'Waking from hidden must re-schedule deferred scan when rAF ran while hibernating');
  rafs.shift()();
  assert.notEqual(liveTxt.nodeValue, 'Running', 'Deferred dirty node must translate after visibility wake');
  inst.destroy();
});

test('DOM perf fixes: host-workbench-enhancer toggles data-ag-scrolling on floating glass during viewport scroll (including mid-scroll mounts) and cleans up on destroy', () => {
  const enhancerMod = require(path.join(ROOT, 'host-workbench-enhancer.js'));
  const docListeners = new Map();
  const makeEl = (tag, attrs = {}) => {
    const map = new Map(Object.entries(attrs));
    const el = {
      nodeType: 1, tagName: tag.toUpperCase(), isConnected: true, parentElement: null, children: [],
      classList: { contains: (c) => String(map.get('class') || '').split(/\s+/).includes(c) },
      getAttribute: (k) => (map.has(k) ? map.get(k) : null),
      setAttribute: (k, v) => map.set(k, String(v)),
      hasAttribute: (k) => map.has(k),
      removeAttribute: (k) => map.delete(k),
      closest: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
    };
    return el;
  };
  const vp = makeEl('div', { 'data-testid': 'autoscroll-viewport' });
  const sideQ = makeEl('div', { 'data-testid': 'side-question-panel' });
  const scrollBtn = makeEl('button', { class: 'agy-scroll-bottom' });
  let scrollBtnMounted = false;
  const fakeDoc = {
    documentElement: makeEl('html'), body: makeEl('body'),
    querySelector: () => null,
    querySelectorAll: (sel) => (sel.includes('side-question-panel') ? (scrollBtnMounted ? [scrollBtn, sideQ] : [sideQ]) : []),
    addEventListener(t, fn, opt) { docListeners.set(t, { fn, opt }); },
    removeEventListener(t) { docListeners.delete(t); },
  };
  const fakeWin = { addEventListener() {}, removeEventListener() {} };
  const origNow = Date.now;
  let fakeNow = 10000;
  Date.now = () => fakeNow;
  const ctl = enhancerMod.createHostEnhancerController({ doc: fakeDoc, win: fakeWin, getConfig: () => ({}), getLang: () => 'en' });
  try {
    const sc = docListeners.get('scroll');
    assert.ok(sc && sc.opt?.capture === true && sc.opt?.passive === true, 'Viewport scroll glass bypass must be capture + passive');
    sc.fn({ target: vp });
    assert.equal(sideQ.getAttribute('data-ag-scrolling'), '1');
    assert.equal(scrollBtn.hasAttribute('data-ag-scrolling'), false);
    // Simulate .agy-scroll-bottom mounting mid-scroll after scrolling up from bottom
    scrollBtnMounted = true;
    fakeNow += 180;
    sc.fn({ target: vp });
    assert.equal(scrollBtn.getAttribute('data-ag-scrolling'), '1', 'Mid-scroll newly mounted .agy-scroll-bottom must be stamped on periodic re-sample');
  } finally {
    Date.now = origNow;
    ctl.destroy();
  }
  assert.equal(scrollBtn.hasAttribute('data-ag-scrolling'), false, 'destroy() must clear data-ag-scrolling');
  assert.equal(sideQ.hasAttribute('data-ag-scrolling'), false, 'destroy() must clear data-ag-scrolling');
  assert.equal(docListeners.has('scroll'), false, 'destroy() must remove scroll capture listener');
});

test('DOM perf fixes: thought-client caps below-fold sidebar title layout/visibility reads on 120-row sidebar', () => {
  const src = fs.readFileSync(path.join(ROOT, 'vendor/thought-translator/thought-client.js'), 'utf8');
  let rectCalls = 0;
  let visCalls = 0;
  const sidebar = {
    nodeType: 1, tagName: 'ASIDE', isConnected: true, hidden: false, parentElement: null, parentNode: null,
    style: {}, children: [], childNodes: [],
    getAttribute: (k) => (k === 'data-testid' ? 'conversation-list-sidebar' : null),
    hasAttribute: () => false, setAttribute() {}, removeAttribute() {},
    querySelector: () => null, querySelectorAll: () => [],
  };
  const rows = [];
  for (let i = 0; i < 120; i++) {
    const tn = { nodeType: 3, nodeValue: `Refactor module alpha task ${i}`, parentElement: null, parentNode: null, isConnected: true };
    const row = {
      nodeType: 1, tagName: 'DIV', isConnected: true, hidden: false, className: '',
      parentElement: sidebar, parentNode: sidebar, style: {},
      children: [], childNodes: [tn],
      getAttribute: (k) => (k === 'data-testid' ? 'conversation-row-sidebar' : null),
      hasAttribute: () => false, setAttribute() {}, removeAttribute() {},
      closest: () => null, querySelector: () => null, querySelectorAll: () => [],
      checkVisibility() { visCalls++; return true; },
      getBoundingClientRect() {
        rectCalls++;
        // Rows 0..119 stacked 40px high starting below viewport (2000px+)
        const top = 2000 + i * 40;
        return { top, bottom: top + 36, left: 0, right: 220, width: 220, height: 36 };
      },
    };
    tn.parentElement = tn.parentNode = row;
    rows.push(row);
    sidebar.children.push(row);
    sidebar.childNodes.push(row);
  }
  const html = {
    nodeType: 1, tagName: 'HTML', isConnected: true,
    getAttribute: (k) => (k === 'data-ag-cs-lang' ? 'zh-CN' : null),
    setAttribute() {}, removeAttribute() {}, hasAttribute: () => false,
  };
  const fakeDoc = {
    hidden: false, documentElement: html, body: sidebar,
    querySelector: () => null,
    querySelectorAll: (sel) => (String(sel).includes('conversation-row-sidebar') ? rows : []),
    addEventListener() {}, removeEventListener() {},
  };
  const timers = [];
  const sb = {
    window: null, document: fakeDoc, innerHeight: 900, innerWidth: 1440,
    __agPrismThoughtBridge: {
      call: () => Promise.resolve({ ok: true, entries: {} }),
      translateStream: () => Promise.resolve({ ok: true, items: [] }),
    },
    MutationObserver: class { observe() {} disconnect() {} },
    setTimeout(fn) { const h = { fn, unref() {} }; timers.push(h); return h; },
    clearTimeout(h) { const idx = timers.indexOf(h); if (idx >= 0) timers.splice(idx, 1); },
    Date, Math, Number, String, Boolean, Array, Object, Map, Set, WeakMap, WeakSet, RegExp, JSON, Promise,
  };
  sb.window = sb; sb.globalThis = sb;
  vm.runInNewContext(src, sb);
  sb.__agPrismThought.sync({ thoughtTranslate: 'machine', language: 'zh-CN', translateTitles: true, translateToolSummaries: false });
  while (timers.length) timers.shift().fn();
  assert.ok(rectCalls <= 8, `Below-fold sidebar rows must short-circuit after streak; got ${rectCalls} getBoundingClientRect calls on 120 rows`);
  assert.ok(visCalls <= 8, `Below-fold sidebar rows must short-circuit checkVisibility; got ${visCalls} calls on 120 rows`);
  sb.__agPrismThought.destroy();
});

test('perf guard 28 (DOM-08): context-menu-btw mounts inside persistent #ag-prism-overlay-portal with zero <hr> & zero repeat body mutations', () => {
  const src = fs.readFileSync(path.join(ROOT, 'context-menu-btw.js'), 'utf8');
  let bodyAppends = 0;
  let bodyRemovals = 0;
  const makeNode = (tag) => {
    const attrs = new Map();
    const children = [];
    const node = {
      nodeType: 1, tagName: String(tag).toUpperCase(), style: {}, children, parentNode: null, parentElement: null,
      get childElementCount() { return children.length; },
      setAttribute(k, v) { attrs.set(k, String(v)); if (k === 'id') this.id = String(v); if (k === 'class') this.className = String(v); },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      removeAttribute(k) { attrs.delete(k); },
      appendChild(ch) {
        if (this === body) bodyAppends++;
        children.push(ch); ch.parentNode = this; ch.parentElement = this; return ch;
      },
      remove() {
        const p = this.parentNode;
        if (!p) return;
        if (p === body) bodyRemovals++;
        const i = p.children.indexOf(this);
        if (i >= 0) p.children.splice(i, 1);
        this.parentNode = this.parentElement = null;
      },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) {
        const out = [];
        const walk = (n) => {
          for (const c of n.children) {
            if (sel === '#ag-prism-overlay-portal' && c.id === 'ag-prism-overlay-portal') out.push(c);
            else if (sel === 'hr' && c.tagName === 'HR') out.push(c);
            else if (sel === '[role="separator"]' && c.getAttribute('role') === 'separator') out.push(c);
            else if (sel.includes('.ag-cs-ctx-menu') && String(c.className || '').includes('ag-cs-ctx-menu')) out.push(c);
            else if (sel.includes('.ag-cs-ctx-toast') && String(c.className || '').includes('ag-cs-ctx-toast')) out.push(c);
            walk(c);
          }
        };
        walk(this);
        return out;
      },
      getBoundingClientRect: () => ({ width: 230, height: 180 }),
      addEventListener() {}, removeEventListener() {},
    };
    return node;
  };
  const body = makeNode('body');
  const html = makeNode('html');
  const scrollOpts = [];
  const doc = {
    body, documentElement: html,
    createElement: makeNode,
    createElementNS: (_ns, t) => makeNode(t),
    getElementById: (id) => (id === 'ag-prism-overlay-portal' ? body.querySelector('#ag-prism-overlay-portal') : null),
    querySelector: (s) => body.querySelector(s),
    querySelectorAll: (s) => body.querySelectorAll(s),
    addEventListener(type, _fn, opt) { if (type === 'scroll') scrollOpts.push(opt); },
    removeEventListener() {},
  };
  const win = { innerWidth: 1440, innerHeight: 900, addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, setTimeout, clearTimeout };
  const sb = { window: win, document: doc, navigator: { language: 'en' }, setTimeout, clearTimeout, Date, Math, Number, String, Boolean, Array, Object, Set, Map, RegExp, Promise };
  sb.globalThis = sb;
  vm.runInNewContext(src, sb);
  const ctl = sb.__agPrismContextMenu.createContextMenuController({ doc, win, nav: sb.navigator });
  const m1 = ctl.openAt(400, 300);
  assert.equal(m1.parentNode?.id, 'ag-prism-overlay-portal', 'menu must mount inside persistent #ag-prism-overlay-portal');
  assert.equal(m1.getAttribute('data-ag-owned'), '1', 'menu must carry data-ag-owned="1"');
  assert.equal(m1.querySelectorAll('hr').length, 0, 'menu must NOT insert <hr> (triggers Blink BODY .md-divider-spacing hr + * invalidation)');
  assert.ok(m1.querySelectorAll('[role="separator"]').length >= 1, 'menu must use <div role="separator">');
  assert.equal(bodyAppends, 1, 'portal appended to body exactly once');
  assert.equal(bodyRemovals, 0, 'body children never removed on open');
  assert.ok(scrollOpts.some((o) => o && o.capture === true && o.passive === true), 'scroll close listener must be passive');
  ctl.close();
  ctl.openAt(500, 320);
  ctl.close();
  assert.equal(bodyAppends, 1, 'subsequent open/close cycles must perform 0 additional document.body.appendChild calls');
  assert.equal(bodyRemovals, 0, 'subsequent close calls must perform 0 document.body child removals');
  ctl.destroy();
  const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  assert.ok(css.includes('&>:is(hr,[role="separator"]){'), 'style.css must style [role="separator"] inside .ag-cs-ctx-menu');
  assert.ok(css.includes('pointer-events:auto;contain:layout style;'), '.ag-cs-ctx-menu must isolate layout/style containment');
});
