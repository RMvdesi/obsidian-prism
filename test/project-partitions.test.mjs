import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const cdp = require(path.join(ROOT, 'cdp.js'));
const partitionsFactory = require(path.join(ROOT, 'vendor', 'project-partitions', 'partitions-client.js'));
const i18nExtBeta4 = require(path.join(ROOT, 'src', 'runtime', 'i18n-ext-beta4.js'));
const settingsExtBeta4 = require(path.join(ROOT, 'src', 'runtime', 'settings-ext-beta4.js'));

const CANONICAL_9_LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'tr'];
const NON_CJK_LOCALES = ['en', 'ko', 'es', 'fr', 'de', 'tr'];
const CJK_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/;

function createPartitionsMiniDom({ projects = [], summaries = {} } = {}) {
  const listenersByNode = new WeakMap();

  const matchesSingle = (el, sel) => {
    const s = sel.trim();
    if (!s) return false;
    if (s.startsWith('#')) return el.id === s.slice(1);
    let rest = s;
    const tm = rest.match(/^[a-zA-Z0-9-]+/);
    if (tm) {
      if (el.tagName !== tm[0].toUpperCase()) return false;
      rest = rest.slice(tm[0].length);
    }
    for (const m of rest.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
      if (!el.classList.contains(m[1])) return false;
    }
    for (const m of rest.matchAll(/\[([^\]=]+)(?:="([^"]*)")?\]/g)) {
      if (!el.hasAttribute(m[1])) return false;
      if (m[2] !== undefined && el.getAttribute(m[1]) !== m[2]) return false;
    }
    return true;
  };

  const matches = (el, selList) =>
    String(selList || '')
      .split(',')
      .some((part) => {
        const tokens = part.trim().split(/\s+/).filter(Boolean);
        if (!tokens.length || !matchesSingle(el, tokens[tokens.length - 1])) return false;
        let cur = el.parentElement;
        for (let i = tokens.length - 2; i >= 0; i--) {
          let found = false;
          while (cur) {
            if (matchesSingle(cur, tokens[i])) { found = true; cur = cur.parentElement; break; }
            cur = cur.parentElement;
          }
          if (!found) return false;
        }
        return true;
      });

  const walk = (root, out = []) => {
    for (const c of root.children) { out.push(c); walk(c, out); }
    return out;
  };

  const makeEl = (tag, doc) => {
    const attrs = new Map();
    const listeners = new Map();
    const el = {
      tagName: String(tag).toUpperCase(),
      nodeType: 1,
      id: '', type: '', value: '', placeholder: '', maxLength: 0, className: '', _text: '',
      ownerDocument: doc, parentElement: null, parentNode: null, children: [],
      style: { cssText: '', setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
      classList: {
        add(...cs) { const s = new Set(el.className.split(/\s+/).filter(Boolean)); cs.forEach((c) => c && s.add(c)); el.className = [...s].join(' '); },
        remove(...cs) { const d = new Set(cs); el.className = el.className.split(/\s+/).filter((x) => x && !d.has(x)).join(' '); },
        contains(c) { return el.className.split(/\s+/).includes(c); },
      },
      get isConnected() { let p = el; while (p) { if (p === doc.documentElement) return true; p = p.parentElement; } return false; },
      get firstElementChild() { return el.children[0] || null; },
      get firstChild() { return el.children[0] || null; },
      get textContent() { return el.children.length ? el._text + el.children.map((c) => c.textContent).join('') : el._text; },
      set textContent(v) { el._text = String(v ?? ''); el.children.length = 0; },
      setAttribute(k, v) { attrs.set(k, String(v)); if (k === 'id') el.id = String(v); if (k === 'class') el.className = String(v); },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      hasAttribute(k) { return attrs.has(k); },
      removeAttribute(k) { attrs.delete(k); if (k === 'id') el.id = ''; },
      appendChild(c) { if (c.parentElement) c.parentElement.removeChild(c); c.parentElement = c.parentNode = el; el.children.push(c); return c; },
      insertBefore(c, ref) {
        if (!ref) return el.appendChild(c);
        if (c.parentElement) c.parentElement.removeChild(c);
        const idx = el.children.indexOf(ref);
        c.parentElement = c.parentNode = el;
        if (idx < 0) el.children.push(c); else el.children.splice(idx, 0, c);
        return c;
      },
      removeChild(c) { const idx = el.children.indexOf(c); if (idx >= 0) el.children.splice(idx, 1); c.parentElement = c.parentNode = null; return c; },
      remove() { if (el.parentElement) el.parentElement.removeChild(el); },
      contains(target) { let cur = target; while (cur) { if (cur === el) return true; cur = cur.parentElement; } return false; },
      matches(sel) { return matches(el, sel); },
      closest(sel) { let cur = el; while (cur) { if (matches(cur, sel)) return cur; cur = cur.parentElement; } return null; },
      querySelector(sel) { for (const n of walk(el)) if (matches(n, sel)) return n; return null; },
      querySelectorAll(sel) { return walk(el).filter((n) => matches(n, sel)); },
      getBoundingClientRect() { return { left: 16, top: 40, right: 220, bottom: 70, width: 204, height: 30 }; },
      addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
      removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
      dispatchEvent(ev) {
        const event = ev && typeof ev === 'object' ? ev : { type: String(ev) };
        if (!event.target) event.target = el;
        event.preventDefault = event.preventDefault || (() => {});
        event.stopPropagation = event.stopPropagation || (() => { event._stopped = true; });
        let cur = el;
        while (cur) {
          const set = listenersByNode.get(cur)?.get(event.type);
          if (set) for (const fn of [...set]) fn(event);
          if (event._stopped || !event.bubbles) break;
          cur = cur.parentElement;
        }
        return true;
      },
      click() { el.dispatchEvent({ type: 'click', bubbles: true }); },
      focus() {},
      select() {},
    };
    listenersByNode.set(el, listeners);
    return el;
  };

  const docListeners = new Map();
  const doc = {
    documentElement: null, head: null, body: null,
    createElement(tag) { return makeEl(tag, doc); },
    createElementNS(_ns, tag) { return makeEl(tag, doc); },
    getElementById(id) { return walk(doc.documentElement).find((n) => n.id === id) || null; },
    querySelector(sel) { return doc.documentElement.querySelector(sel); },
    querySelectorAll(sel) { return doc.documentElement.querySelectorAll(sel); },
    addEventListener(type, fn) { if (!docListeners.has(type)) docListeners.set(type, new Set()); docListeners.get(type).add(fn); },
    removeEventListener(type, fn) { docListeners.get(type)?.delete(fn); },
    dispatchEvent(ev) { const set = docListeners.get(ev.type); if (set) for (const fn of [...set]) fn(ev); return true; },
  };
  doc.documentElement = makeEl('html', doc);
  doc.head = makeEl('head', doc);
  doc.body = makeEl('body', doc);
  doc.documentElement.appendChild(doc.head);
  doc.documentElement.appendChild(doc.body);

  const rootEl = doc.createElement('div');
  rootEl.id = 'root';
  doc.body.appendChild(rootEl);

  const navCalls = [];
  let storeState = { trajectorySummaries: { summaries } };
  let projectsState = [...projects];
  const storeSubs = new Set();
  const store = { getState: () => storeState, subscribe: (fn) => { storeSubs.add(fn); return () => storeSubs.delete(fn); } };
  const services = { core: { projectManagementService: { projectsStateProvider: { getState: () => projectsState }, onDidAnyProjectChange: () => ({ dispose() {} }) } } };
  const router = { state: { location: { pathname: '/' } }, navigate: (arg) => { navCalls.push(arg); return true; } };
  rootEl.__reactContainer$test = {
    current: {
      memoizedProps: { value: { store } },
      child: { memoizedProps: { value: services }, sibling: { memoizedProps: { value: router } } },
    },
  };

  const sidebar = doc.createElement('div');
  sidebar.setAttribute('data-testid', 'conversation-list-sidebar');
  rootEl.appendChild(sidebar);

  const virtualInner = doc.createElement('div');
  virtualInner.className = 'w-full relative';
  virtualInner.style.height = '420px';
  sidebar.appendChild(virtualInner);

  const projectsHeader = doc.createElement('div');
  projectsHeader.setAttribute('data-testid', 'section-header');
  projectsHeader.setAttribute('data-title', 'Projects');
  projectsHeader.style.transform = 'translateY(0px)';
  virtualInner.appendChild(projectsHeader);

  const nativeProjectRows = [];
  projects.forEach((p, idx) => {
    const row = doc.createElement('div');
    row.setAttribute('data-sidebar-section-drop-id', p.id);
    row.style.transform = `translateY(${(idx + 1) * 33}px)`;
    const hdr = doc.createElement('button');
    hdr.setAttribute('data-testid', 'project-header');
    hdr.textContent = p.name;
    const moreBtn = doc.createElement('button');
    moreBtn.setAttribute('aria-haspopup', 'menu');
    moreBtn.__reactFiber$test = {
      memoizedProps: {},
      return: {
        memoizedProps: { onCopyClick: () => {}, onSettingsClick: () => {}, onRevealClick: () => {}, onDeleteClick: () => {} },
      },
    };
    row.appendChild(hdr);
    row.appendChild(moreBtn);
    virtualInner.appendChild(row);
    nativeProjectRows.push(row);
  });

  const convsHeader = doc.createElement('div');
  convsHeader.setAttribute('data-testid', 'section-header');
  convsHeader.setAttribute('data-title', 'Conversations');
  convsHeader.style.transform = `translateY(${(projects.length + 1) * 33}px)`;
  virtualInner.appendChild(convsHeader);

  const lsMap = new Map();
  const localStorage = {
    getItem: (k) => (lsMap.has(k) ? lsMap.get(k) : null),
    setItem: (k, v) => { lsMap.set(k, String(v)); },
    removeItem: (k) => { lsMap.delete(k); },
  };

  const winListeners = new Map();
  const win = {
    document: doc, localStorage, innerWidth: 1280, innerHeight: 800, location: { pathname: '/' },
    requestAnimationFrame: (fn) => { fn(); return 1; }, cancelAnimationFrame: () => {},
    addEventListener(type, fn) { if (!winListeners.has(type)) winListeners.set(type, new Set()); winListeners.get(type).add(fn); },
    removeEventListener(type, fn) { winListeners.get(type)?.delete(fn); },
    dispatchEvent(ev) { const set = winListeners.get(ev.type); if (set) for (const fn of [...set]) fn(ev); },
    KeyboardEvent: class KeyboardEvent { constructor(type, init = {}) { this.type = type; this.key = init.key || ''; this.bubbles = Boolean(init.bubbles); } },
    __agPrism: { getState: () => ({ cfg: { language: 'zh-CN', projectPartitions: 'on' } }) },
  };

  return {
    win, doc, sidebar, virtualInner, projectsHeader, convsHeader, nativeProjectRows, navCalls,
    setProjects(next) { projectsState = [...next]; },
    setSummaries(next) { storeState = { trajectorySummaries: { summaries: next } }; },
  };
}

test('microkernel channel: projectPartitions defaults to off (0 B), builds with disk cache, and tears down cleanly', async () => {
  assert.equal(cdp.DEFAULT_CONFIG.projectPartitions, 'off');
  assert.equal(cdp.validateConfigEntry('projectPartitions', 'off'), true);
  assert.equal(cdp.validateConfigEntry('projectPartitions', 'on'), true);
  assert.equal(cdp.validateConfigEntry('projectPartitions', 'invalid'), false);
  assert.equal(cdp.reconcileConfigAliases({ projectPartitions: true }).projectPartitions, 'on');
  assert.equal(cdp.reconcileConfigAliases({ projectPartitions: false }).projectPartitions, 'off');

  const ch = cdp.findChannel('projectPartitions');
  assert.ok(ch, 'CHANNEL_REGISTRY must register projectPartitions');
  assert.equal(ch.shouldEnable({}), false);
  assert.equal(ch.shouldEnable({ projectPartitions: 'off' }), false);
  assert.equal(ch.shouldEnable({ projectPartitions: 'on' }), true);
  assert.equal(ch.shouldEnable({ projectPartitions: true }), true);
  assert.equal(cdp.buildProjectPartitionsExpression({ projectPartitions: 'off' }), '');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-part-cache-'));
  const cachePath = path.join(tmpDir, '.bundle-cache.json');
  try {
    cdp.resetBundleCacheStats();
    const expr1 = cdp.buildProjectPartitionsExpression({ projectPartitions: 'on' }, { cachePath });
    assert.ok(expr1.length > 5000, 'compiled channel expression should be non-empty');
    assert.ok(Buffer.byteLength(expr1, 'utf8') <= ch.budgetBytes, 'compiled channel expression must stay within budget');
    assert.doesNotThrow(() => new vm.Script(expr1), 'compiled channel expression must parse cleanly');
    assert.match(expr1, /__agPrismProjectPartitions/);

    cdp.resetBundleCacheStats();
    const expr2 = cdp.buildProjectPartitionsExpression({ projectPartitions: 'on' }, { cachePath });
    assert.equal(expr2, expr1, 'cached channel expression must match cold build');
    const stats = cdp.getBundleCacheStats();
    assert.ok((stats.channelHitsByName.projectPartitions || 0) >= 1, 'should record channel cache hit');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  for (const token of [
    '__agPrismProjectPartitions',
    '__agPrismProjectPartitionsFactory',
    '__agPrismProjectPartitionsUi',
    '__agPrismProjectPartitionsHost',
    'ag-prism-project-partitions-css',
    'ag-prism-part-hide-css',
    'ag-prism-partitions-root',
    'data-ag-prism-project-partitions',
  ]) {
    assert.ok(cdp.PROJECT_PARTITIONS_REMOVE_EXPRESSION.includes(token), `PROJECT_PARTITIONS_REMOVE_EXPRESSION missing ${token}`);
    assert.ok(cdp.REMOVE_EXPRESSION.includes(token), `REMOVE_EXPRESSION missing ${token}`);
  }

  const refreshExpr = cdp.buildConfigRefreshExpression({ projectPartitions: 'on' });
  assert.ok(refreshExpr.includes('__agPrismProjectPartitions'), 'config refresh should notify projectPartitions');

  // Table-driven daemon probe and cache derivation
  assert.ok(cdp.CHANNEL_CACHE_NAMES.includes('projectPartitions'));
  const { PAGE_HEALTH_PROBE_EXPRESSION } = await import('../src/daemon/session-heal-channels.mjs');
  assert.ok(PAGE_HEALTH_PROBE_EXPRESSION.includes('hasProjectPartitions:'));
  assert.ok(PAGE_HEALTH_PROBE_EXPRESSION.includes('projectPartitionsCodeHash:'));
});

test('hygiene & 9 locales: pure ASCII CSS, 0 :has(, 0 backdrop-filter, 9 locales with tr and 0 standalone yue', () => {
  const css = partitionsFactory.PARTITIONS_CSS;
  assert.ok(css.length > 500);
  assert.equal(/[^\x00-\x7F]/.test(css), false, 'PARTITIONS_CSS must be pure ASCII');
  assert.equal(/:has\s*\(/.test(css), false, 'PARTITIONS_CSS must not use :has(');
  assert.equal(/backdrop-filter/i.test(css), false, 'PARTITIONS_CSS must avoid GPU backdrop-filter');
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, 'PARTITIONS_CSS braces must be balanced');

  // 9 locales in partitions-ui I18N (0 standalone yue, yue -> zh-CN, tr -> tr)
  assert.deepEqual(Object.keys(partitionsFactory.I18N).sort(), [...CANONICAL_9_LOCALES].sort());
  assert.equal(partitionsFactory.I18N.yue, undefined);
  assert.equal(partitionsFactory.resolveLang('yue'), 'zh-CN');
  assert.equal(partitionsFactory.resolveLang('zh-yue'), 'zh-CN');
  assert.equal(partitionsFactory.resolveLang('tr-TR'), 'tr');
  for (const loc of CANONICAL_9_LOCALES) {
    const dict = partitionsFactory.I18N[loc];
    for (const [k, v] of Object.entries(dict)) {
      assert.ok(typeof v === 'string' && v.length > 0, `partitions I18N[${loc}].${k} must be non-empty`);
      if (NON_CJK_LOCALES.includes(loc)) {
        assert.equal(CJK_RE.test(v), false, `partitions I18N[${loc}].${k} leaked CJK: "${v}"`);
      }
    }
  }

  // 9 locales in i18n-ext-beta4.js
  for (const key of ['setProjectPartitionsLabel', 'setProjectPartitionsDesc']) {
    const row = i18nExtBeta4.TABLE[key];
    assert.ok(Array.isArray(row) && row.length === CANONICAL_9_LOCALES.length, `i18n-ext-beta4.${key} must have 9 locales`);
    CANONICAL_9_LOCALES.forEach((loc, i) => {
      assert.ok(typeof row[i] === 'string' && row[i].length > 0);
      if (NON_CJK_LOCALES.includes(loc)) {
        assert.equal(CJK_RE.test(row[i]), false, `i18n-ext-beta4.${key}[${loc}] leaked CJK: "${row[i]}"`);
      }
    });
  }
});

test('settings-ext-beta4: mounts projectPartitions toggle after sidebarNavFold and persists on/off', () => {
  const dom = createPartitionsMiniDom();
  const sec = dom.doc.createElement('div');
  sec.setAttribute('data-body-built', '1');
  const grpWrap = dom.doc.createElement('div');
  const navFoldRow = dom.doc.createElement('div');
  navFoldRow.setAttribute('data-ag-cs-row', 'sidebarNavFold');
  grpWrap.appendChild(navFoldRow);
  sec.appendChild(grpWrap);
  dom.doc.body.appendChild(sec);

  const saved = [];
  const cfgState = { sidebarNavFold: 'off', projectPartitions: 'off', language: 'tr' };
  const origI18nExt = globalThis.__agPrismI18nExtBeta4;
  globalThis.__agPrismI18nExtBeta4 = i18nExtBeta4;
  try {
    settingsExtBeta4.sync(sec, {
      doc: dom.doc,
      win: dom.win,
      lang: cfgState.language,
      ui: { onLabel: 'Açık', offLabel: 'Kapalı' },
      effVal: (k) => cfgState[k],
      saveSetting: (k, v) => { cfgState[k] = v; saved.push([k, v]); },
      runGuardedMut: (fn) => fn(),
    });

    const row = sec.querySelector('[data-ag-cs-row="projectPartitions"]');
    assert.ok(row, 'settings-ext-beta4 must mount projectPartitions row after sidebarNavFold');
    assert.equal(row.querySelector('[data-k="t"]').textContent, 'Proje Bölümleri');
    const onBtn = row.querySelector('button[data-ag-cs-ext-key="projectPartitions"][data-ag-cs-ext-role="on"]');
    const offBtn = row.querySelector('button[data-ag-cs-ext-key="projectPartitions"][data-ag-cs-ext-role="off"]');
    assert.ok(onBtn && offBtn, 'projectPartitions switch must render On and Off buttons');
    assert.equal(offBtn.getAttribute('aria-pressed'), 'true');
    assert.equal(onBtn.getAttribute('aria-pressed'), 'false');

    onBtn.click();
    assert.deepEqual(saved, [['projectPartitions', 'on']]);
    assert.equal(onBtn.getAttribute('aria-pressed'), 'true');
  } finally {
    if (origI18nExt === undefined) delete globalThis.__agPrismI18nExtBeta4;
    else globalThis.__agPrismI18nExtBeta4 = origI18nExt;
  }
});

test('controller: 3-level hierarchy (Partition -> Project -> Conversations), CRUD, and zero-height hide without mutating virtual list', () => {
  const projects = [
    {
      id: 'proj-alpha',
      name: 'AlphaApp',
      projectResources: { resources: [{ type: { case: 'folderUri', value: 'file:///d%3A/Work/AlphaApp' } }] },
    },
    {
      id: 'proj-beta',
      name: 'BetaTool',
      projectResources: { resources: [{ type: { case: 'gitFolder', value: { folderUri: 'file:///D:/Work/BetaTool/' } } }] },
    },
  ];
  const summaries = {
    'conv-1': {
      trajectoryType: 4, summary: 'Recent main chat', lastModifiedTime: { seconds: 1700000200n },
      workspaces: [{ workspaceFolderAbsoluteUri: 'file:///D:/Work/AlphaApp' }],
    },
    'conv-2': {
      trajectoryType: 4, summary: 'Pinned older chat', annotations: { pinned: true },
      lastModifiedTime: { seconds: 1700000100n }, status: 2,
      workspaces: [{ workspaceFolderAbsoluteUri: 'file:///d%3A/Work/AlphaApp/' }],
    },
    'conv-side': {
      trajectoryType: 2, summary: 'Side question excluded', lastModifiedTime: { seconds: 1700000500n },
      workspaces: [{ workspaceFolderAbsoluteUri: 'file:///d%3A/Work/AlphaApp' }],
    },
    'conv-archived': {
      trajectoryType: 4, archived: true, summary: 'Archived excluded', lastModifiedTime: { seconds: 1700000600n },
      workspaces: [{ workspaceFolderAbsoluteUri: 'file:///d%3A/Work/AlphaApp' }],
    },
    'conv-fork': {
      trajectoryType: 4, forkParentConversationId: 'conv-1', summary: 'Fork excluded', lastModifiedTime: { seconds: 1700000700n },
      workspaces: [{ workspaceFolderAbsoluteUri: 'file:///d%3A/Work/AlphaApp' }],
    },
  };

  const dom = createPartitionsMiniDom({ projects, summaries });
  const origWindow = globalThis.window;
  const origDoc = globalThis.document;
  globalThis.window = dom.win;
  globalThis.document = dom.doc;
  try {
    const ctrl = partitionsFactory.mountProjectPartitions({
      root: dom.win,
      doc: dom.doc,
      config: { projectPartitions: 'on', language: 'zh-CN' },
    });

    assert.equal(ctrl.getStatus().status, 'active');
    assert.equal(dom.doc.documentElement.getAttribute('data-ag-prism-project-partitions'), '1');
    assert.ok(dom.doc.getElementById('ag-prism-project-partitions-css'));

    assert.equal(ctrl.createPartition('   ').ok, false);
    const devRes = ctrl.createPartition('Develop');
    assert.equal(devRes.ok, true);
    assert.equal(ctrl.createPartition('develop').ok, false);
    const toolsRes = ctrl.createPartition('Tools');
    assert.equal(toolsRes.ok, true);

    assert.equal(ctrl.renamePartition(toolsRes.partition.id, 'DevTools').ok, true);
    ctrl.movePartition(toolsRes.partition.id, -1);
    assert.deepEqual(ctrl.getState().partitions.map((p) => p.name), ['DevTools', 'Develop']);

    ctrl.assignProjectToPartition('proj-alpha', devRes.partition.id);
    ctrl.toggleProjectExpanded('proj-alpha', true);
    ctrl.renderPartitions();

    const rootNode = dom.sidebar.querySelector('.ag-prism-partitions-root');
    assert.ok(rootNode);
    assert.equal(rootNode.parentElement, dom.sidebar);
    assert.equal(rootNode.querySelectorAll('.ag-prism-part-section').length, 2);

    const level2Rows = rootNode.querySelectorAll('.ag-prism-part-project');
    assert.equal(level2Rows.length, 1);
    assert.equal(level2Rows[0].getAttribute('data-project-id'), 'proj-alpha');

    const level3Rows = rootNode.querySelectorAll('.ag-prism-part-conv-row');
    assert.equal(level3Rows.length, 2);
    assert.equal(level3Rows[0].getAttribute('data-cascade-id'), 'conv-2');
    assert.equal(level3Rows[1].getAttribute('data-cascade-id'), 'conv-1');

    level3Rows[0].click();
    assert.equal(dom.navCalls.length, 1);
    assert.deepEqual(dom.navCalls[0], { to: '/c/$cascadeId', params: { cascadeId: 'conv-2' } });

    const hideCss = dom.doc.getElementById('ag-prism-part-hide-css');
    assert.ok(hideCss);
    assert.match(hideCss.textContent, /data-sidebar-section-drop-id="proj-alpha"/);
    assert.match(hideCss.textContent, /data-sidebar-section-id="proj-alpha"/);
    assert.match(hideCss.textContent, /height:\s*0\s*!important/);
    assert.equal(dom.virtualInner.style.height, '420px');
    assert.equal(dom.projectsHeader.style.transform, 'translateY(0px)');
    assert.equal(dom.convsHeader.style.transform, 'translateY(99px)');

    // Native project `...` menu injection + cascading submenu
    const moreBtn = dom.nativeProjectRows[1].querySelector('button[aria-haspopup="menu"]');
    ctrl.recordProjectTriggerFromEvent(moreBtn);
    const nativeMenu = dom.doc.createElement('div');
    nativeMenu.setAttribute('role', 'menu');
    const nativeItem = dom.doc.createElement('div');
    nativeItem.setAttribute('role', 'menuitem');
    nativeItem.textContent = 'Delete project';
    nativeMenu.appendChild(nativeItem);
    dom.doc.body.appendChild(nativeMenu);

    assert.equal(ctrl.tryInjectIntoNativeMenu(nativeMenu), true);
    const partMenuItem = nativeMenu.querySelector('.ag-prism-part-menu-item');
    assert.ok(partMenuItem);
    partMenuItem.click();
    const submenu = dom.doc.querySelector('.ag-prism-part-popup');
    assert.ok(submenu);
    const submenuItems = submenu.querySelectorAll('.ag-prism-part-popup-item');
    assert.ok(submenuItems.length >= 2);
    submenuItems[0].click();
    assert.equal(ctrl.getState().projectToPartition['proj-beta'], toolsRes.partition.id);

    ctrl.deletePartition(toolsRes.partition.id);
    assert.equal(ctrl.getState().projectToPartition['proj-beta'], undefined);

    dom.setProjects([projects[1]]);
    ctrl.renderPartitions();
    assert.equal(ctrl.getState().projectToPartition['proj-alpha'], undefined);

    ctrl.destroy();
    assert.equal(ctrl.getStatus().status, 'destroyed');
    assert.equal(dom.doc.documentElement.getAttribute('data-ag-prism-project-partitions'), null);
    assert.equal(dom.doc.getElementById('ag-prism-project-partitions-css'), null);
    assert.equal(dom.doc.getElementById('ag-prism-part-hide-css'), null);
    assert.equal(dom.doc.querySelector('.ag-prism-partitions-root'), null);
    assert.equal(dom.doc.querySelector('.ag-prism-part-popup'), null);
  } finally {
    globalThis.window = origWindow;
    globalThis.document = origDoc;
  }
});


test('persistence: project-partitions.json atomic store, PROTECTED_USER_PATHS, and controller cross-port restore & migration', () => {
  const { PROTECTED_USER_PATHS } = require(path.join(ROOT, 'src', 'platform', 'install-manifest.cjs'));
  assert.ok(PROTECTED_USER_PATHS.includes('project-partitions.json'), 'project-partitions.json must be protected across upgrades');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-part-store-'));
  const filePath = path.join(tmpDir, 'project-partitions.json');
  try {
    // Missing file returns exists: false with clean empty schema
    const emptyRes = cdp.readProjectPartitionsData(filePath);
    assert.equal(emptyRes.exists, false);
    assert.deepEqual(emptyRes.data, { version: 1, partitions: [], projectToPartition: {}, expandedProjects: {} });

    // Atomic write normalizes invalid entries, trims names, and drops orphan partition refs
    const written = cdp.writeProjectPartitionsData(
      {
        partitions: [
          { id: 'part-1', name: '  Develop  ', collapsed: 1 },
          { id: 'part-1', name: 'Duplicate ID ignored' },
          { id: '', name: 'Empty ID ignored' },
        ],
        projectToPartition: { 'proj-alpha': 'part-1', 'proj-bad': 'nonexistent' },
        expandedProjects: { 'proj-alpha': 1, 'proj-false': false },
      },
      filePath
    );
    assert.deepEqual(written, {
      version: 1,
      partitions: [{ id: 'part-1', name: 'Develop', collapsed: true }],
      projectToPartition: { 'proj-alpha': 'part-1' },
      expandedProjects: { 'proj-alpha': true },
    });

    const readBack = cdp.readProjectPartitionsData(filePath);
    assert.equal(readBack.exists, true);
    assert.deepEqual(readBack.data, written);

    // Corrupt JSON fails closed cleanly
    fs.writeFileSync(filePath, '{corrupt', 'utf8');
    assert.equal(cdp.readProjectPartitionsData(filePath).exists, false);

    // Controller save emits persistBinding, survives empty localStorage (random port restart), and migrates legacy localStorage
    const dom = createPartitionsMiniDom({ projects: [], summaries: {} });
    const bindingPayloads = [];
    dom.win[cdp.PARTITIONS_BINDING] = (raw) => bindingPayloads.push(JSON.parse(raw));
    const origW = globalThis.window;
    const origD = globalThis.document;
    globalThis.window = dom.win;
    globalThis.document = dom.doc;
    try {
      const ctrl = partitionsFactory.mountProjectPartitions({
        root: dom.win,
        doc: dom.doc,
        config: { projectPartitions: 'on', language: 'en' },
        initialState: written,
        hasPersistedState: true,
        persistBinding: cdp.PARTITIONS_BINDING,
      });
      // Immediately hydrated from initialState even with blank localStorage
      assert.deepEqual(ctrl.getState().partitions, written.partitions);
      assert.equal(ctrl.getState().projectToPartition['proj-alpha'], 'part-1');
      assert.equal(bindingPayloads[0]?.action, 'load', 'init should request freshest disk state');

      // Mutating calls persistBinding save
      const added = ctrl.createPartition('Tools');
      assert.equal(added.ok, true);
      const saveCall = bindingPayloads.find((p) => p.action === 'save');
      assert.ok(saveCall, 'mutations must call persistBinding save');
      assert.deepEqual(saveCall.data.partitions.map((p) => p.name), ['Develop', 'Tools']);

      // Simulate random-port restart: wipe localStorage & apply persisted disk state
      dom.win.localStorage.removeItem(partitionsFactory.STORAGE_KEY);
      ctrl.applyPersistedState(written, true);
      assert.deepEqual(ctrl.getState().partitions.map((p) => p.name), ['Develop']);
      assert.ok(dom.win.localStorage.getItem(partitionsFactory.STORAGE_KEY).includes('Develop'));

      // Legacy localStorage migration: if disk does not exist yet, existing in-memory partitions persist to disk
      bindingPayloads.length = 0;
      ctrl.applyPersistedState(null, false);
      assert.equal(bindingPayloads.length, 1);
      assert.equal(bindingPayloads[0].action, 'save');
      assert.deepEqual(bindingPayloads[0].data.partitions.map((p) => p.name), ['Develop']);

      ctrl.destroy();
    } finally {
      globalThis.window = origW;
      globalThis.document = origD;
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('RpcDispatcher: PARTITIONS_BINDING enforces trusted context, feature gate, 64KB cap, disk save/load, and peer broadcast', async () => {
  const { RpcDispatcher } = await import('../src/daemon/rpc-dispatcher.mjs');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-part-rpc-'));
  const filePath = path.join(tmpDir, 'project-partitions.json');
  try {
    let featureEnabled = true;
    const fakeCdp = {
      SETTING_BINDING: cdp.SETTING_BINDING,
      LEGACY_SETTING_BINDING: cdp.LEGACY_SETTING_BINDING,
      PARTITIONS_BINDING: cdp.PARTITIONS_BINDING,
      readConfig: () => ({ projectPartitions: featureEnabled ? 'on' : 'off' }),
      shouldEnableProjectPartitions: (cfg) => cfg?.projectPartitions === 'on',
      readProjectPartitionsData: () => cdp.readProjectPartitionsData(filePath),
      writeProjectPartitionsData: (raw) => cdp.writeProjectPartitionsData(raw, filePath),
    };

    const makeEntry = (id, { trusted = true } = {}) => {
      const evals = [];
      const ctxMeta = { frameId: 'main-frame', isDefault: true, type: 'default', docGen: 1 };
      return {
        id,
        evals,
        sidebarHostVerified: trusted,
        sidebarDocument: 1,
        sidebarVerifiedDocument: 1,
        sidebarHostContextId: 10,
        mainFrameId: 'main-frame',
        hasFrameTree: true,
        contextFrames: new Map([
          [10, ctxMeta],
          [99, { frameId: 'child-iframe', isDefault: true, type: 'default', docGen: 1 }],
        ]),
        session: {
          closed: false,
          async send(method, params) {
            if (method === 'Runtime.evaluate') evals.push(params);
            return {};
          },
        },
      };
    };

    const entryA = makeEntry('A', { trusted: true });
    const entryB = makeEntry('B', { trusted: true });
    const entryUntrusted = makeEntry('C', { trusted: false });
    const sessions = new Map([['a', entryA], ['b', entryB], ['c', entryUntrusted]]);

    const rpc = new RpcDispatcher({
      getCdp: () => fakeCdp,
      sessionRegistry: { sessions },
      channelOrchestrator: { isRunning: () => true },
    });

    // 1. Rejects child iframe execution context (ctx 99)
    await rpc.handleBindingCall(entryA, {
      name: cdp.PARTITIONS_BINDING,
      payload: JSON.stringify({ action: 'save', data: { partitions: [{ id: 'p1', name: 'Evil' }] } }),
      executionContextId: 99,
    });
    assert.equal(fs.existsSync(filePath), false, 'iframe context must be rejected fail-closed');

    // 2. Rejects oversized > 64KB payload
    await rpc.handleBindingCall(entryA, {
      name: cdp.PARTITIONS_BINDING,
      payload: JSON.stringify({ action: 'save', pad: 'x'.repeat(70000) }),
      executionContextId: 10,
    });
    assert.equal(fs.existsSync(filePath), false, 'oversized payload must be rejected');

    // 3. Rejects when feature is off
    featureEnabled = false;
    await rpc.handleBindingCall(entryA, {
      name: cdp.PARTITIONS_BINDING,
      payload: JSON.stringify({ action: 'save', data: { partitions: [{ id: 'p1', name: 'Disabled' }] } }),
      executionContextId: 10,
    });
    assert.equal(fs.existsSync(filePath), false, 'save must be rejected when projectPartitions is off');

    // 4. Accepts trusted save when enabled, writes disk, and broadcasts ONLY to trusted peer B (not A, not C)
    featureEnabled = true;
    const saveRes = await rpc.handleBindingCall(entryA, {
      name: cdp.PARTITIONS_BINDING,
      payload: JSON.stringify({
        action: 'save',
        data: { partitions: [{ id: 'p1', name: 'Develop', collapsed: false }], projectToPartition: { 'proj-1': 'p1' }, expandedProjects: {} },
      }),
      executionContextId: 10,
    });
    assert.equal(saveRes.ok, true);
    assert.equal(cdp.readProjectPartitionsData(filePath).data.partitions[0].name, 'Develop');
    assert.equal(entryA.evals.length, 0);
    assert.equal(entryB.evals.length, 1);
    assert.match(entryB.evals[0].expression, /applyPersistedState/);
    assert.match(entryB.evals[0].expression, /Develop/);
    assert.equal(entryUntrusted.evals.length, 0, 'untrusted peer must not receive broadcast');

    // 5. Load returns disk state to caller
    const loadRes = await rpc.handleBindingCall(entryA, {
      name: cdp.PARTITIONS_BINDING,
      payload: JSON.stringify({ action: 'load' }),
      executionContextId: 10,
    });
    assert.equal(loadRes.ok, true);
    assert.equal(loadRes.exists, true);
    assert.equal(entryA.evals.length, 1);
    assert.match(entryA.evals[0].expression, /applyPersistedState/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
