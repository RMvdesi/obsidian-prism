import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const cdp = require(path.join(ROOT, 'cdp.js'));
const cgMod = require(path.join(ROOT, 'vendor', 'context-guard', 'context-guard-client.js'));
const setCgMod = require(path.join(ROOT, 'src', 'runtime', 'settings-context-guard.js'));

function createMiniDom() {
  const matches = (el, selList) =>
    selList.split(',').some((raw) => {
      const s = raw.trim();
      if (!s) return false;
      if (s.startsWith('#')) return el.id === s.slice(1);
      let rest = s;
      const tm = /^[a-zA-Z0-9-]+/.exec(rest);
      if (tm) {
        if (el.tagName !== tm[0].toUpperCase()) return false;
        rest = rest.slice(tm[0].length);
      }
      for (const m of rest.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
        if (!el.classList.contains(m[1])) return false;
      }
      for (const m of rest.matchAll(/\[([^\]=^$*]+)(?:([\^$*]?=)"([^"]*)")?\]/g)) {
        if (!el.hasAttribute(m[1])) return false;
        const val = el.getAttribute(m[1]) || '';
        if (m[2] === '=' && val !== m[3]) return false;
        if (m[2] === '^=' && !val.startsWith(m[3])) return false;
        if (m[2] === '*=' && !val.includes(m[3])) return false;
      }
      return true;
    });

  const makeEl = (tag) => {
    const attrs = new Map();
    const cls = new Set();
    const ls = new Map();
    const el = {
      tagName: String(tag).toUpperCase(),
      nodeType: 1,
      id: '',
      value: '',
      title: '',
      disabled: false,
      style: {},
      _text: '',
      children: [],
      parentElement: null,
      parentNode: null,
      shadowRoot: null,
      get isConnected() {
        let p = el;
        while (p) {
          if (p === doc.documentElement || p === pulseHost.shadowRoot) return true;
          p = p.parentNode || p.parentElement;
        }
        return false;
      },
      get className() { return [...cls].join(' '); },
      set className(v) { cls.clear(); String(v || '').split(/\s+/).filter(Boolean).forEach((c) => cls.add(c)); },
      classList: {
        add: (...a) => a.forEach((c) => c && cls.add(c)),
        remove: (...a) => a.forEach((c) => c && cls.delete(c)),
        contains: (c) => cls.has(c),
      },
      get textContent() { return el.children.length ? el._text + el.children.map((c) => c.textContent).join('') : el._text; },
      set textContent(v) { el._text = String(v ?? ''); el.children.length = 0; },
      get nextSibling() {
        const p = el.parentNode;
        if (!p) return null;
        const idx = p.children.indexOf(el);
        return idx >= 0 && idx + 1 < p.children.length ? p.children[idx + 1] : null;
      },
      setAttribute(k, v) { attrs.set(k, String(v)); if (k === 'id') el.id = String(v); },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      hasAttribute(k) { return attrs.has(k); },
      removeAttribute(k) { attrs.delete(k); },
      appendChild(c) {
        if (c.parentNode) c.remove();
        c.parentNode = el;
        c.parentElement = el;
        el.children.push(c);
        return c;
      },
      insertBefore(c, ref) {
        if (c.parentNode) c.remove();
        c.parentNode = el;
        c.parentElement = el;
        const idx = el.children.indexOf(ref);
        if (idx >= 0) el.children.splice(idx, 0, c);
        else el.children.push(c);
        return c;
      },
      removeChild(c) {
        el.children = el.children.filter((x) => x !== c);
        c.parentNode = null;
        c.parentElement = null;
        return c;
      },
      remove() { if (el.parentNode) el.parentNode.removeChild(el); },
      contains(target) {
        let cur = target;
        while (cur) { if (cur === el) return true; cur = cur.parentNode || cur.parentElement; }
        return false;
      },
      closest(sel) {
        let cur = el;
        while (cur) { if (cur.nodeType === 1 && matches(cur, sel)) return cur; cur = cur.parentElement; }
        return null;
      },
      querySelectorAll(sel) {
        const out = [];
        const walk = (n) => {
          for (const c of n.children || []) {
            if (matches(c, sel)) out.push(c);
            walk(c);
          }
        };
        walk(el);
        return out;
      },
      querySelector(sel) { return el.querySelectorAll(sel)[0] || null; },
      getElementById(id) { return el.querySelector(`#${id}`); },
      addEventListener(ev, fn) { if (!ls.has(ev)) ls.set(ev, new Set()); ls.get(ev).add(fn); },
      removeEventListener(ev, fn) { ls.get(ev)?.delete(fn); },
      dispatchEvent(ev) { for (const fn of ls.get(ev.type) || []) fn(ev); },
      focus() {},
      blur() {},
      click() { if (!el.disabled) for (const fn of ls.get('click') || []) fn({ preventDefault() {}, stopPropagation() {} }); },
    };
    return el;
  };

  const docLs = new Map();
  const rootEl = makeEl('html');
  const body = makeEl('body');
  rootEl.appendChild(body);
  const doc = {
    hidden: false,
    activeElement: body,
    documentElement: rootEl,
    body,
    createElement: makeEl,
    querySelectorAll: (sel) => rootEl.querySelectorAll(sel),
    querySelector: (sel) => rootEl.querySelector(sel),
    getElementById: (id) => rootEl.querySelector(`#${id}`),
    addEventListener(ev, fn) { if (!docLs.has(ev)) docLs.set(ev, new Set()); docLs.get(ev).add(fn); },
    removeEventListener(ev, fn) { docLs.get(ev)?.delete(fn); },
    dispatchEvent(ev) { for (const fn of docLs.get(ev.type) || []) fn(ev); },
  };

  const conv = makeEl('div');
  conv.setAttribute('data-testid', 'conversation-view');
  conv.setAttribute('data-cascade-id', '11111111-2222-3333-4444-555555555555');
  body.appendChild(conv);

  const pulseHost = makeEl('div');
  pulseHost.setAttribute('id', 'ag-prism-pulse-bar');
  pulseHost.setAttribute('data-ag-prism-pulse-bar', 'true');
  const sr = makeEl('shadow');
  const card = makeEl('div');
  card.setAttribute('id', 'context-card');
  const note = makeEl('div');
  note.setAttribute('id', 'context-note');
  card.appendChild(note);
  sr.appendChild(card);
  pulseHost.shadowRoot = sr;
  body.appendChild(pulseHost);

  const inputBox = makeEl('div');
  inputBox.setAttribute('data-testid', 'agent-input-box');
  const editor = makeEl('div');
  editor.setAttribute('data-lexical-editor', 'true');
  editor.setAttribute('contenteditable', 'true');
  const sendBtn = makeEl('button');
  sendBtn.setAttribute('data-testid', 'input-send-button');
  inputBox.appendChild(editor);
  inputBox.appendChild(sendBtn);
  body.appendChild(inputBox);

  const winLs = new Map();
  const store = new Map();
  const win = {
    document: doc,
    Event: globalThis.Event,
    navigator: { language: 'zh-CN' },
    location: { pathname: '/c/11111111-2222-3333-4444-555555555555', search: '?project=demo-proj' },
    sessionStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    addEventListener(ev, fn) { if (!winLs.has(ev)) winLs.set(ev, new Set()); winLs.get(ev).add(fn); },
    removeEventListener(ev, fn) { winLs.get(ev)?.delete(fn); },
  };
  return { win, doc, conv, pulseHost, card, note, editor, sendBtn, store };
}

test('Channel 17 contextGuard: default off produces 0 B, enabled compiles within budget & 9 locales have 0 CJK leaks', () => {
  const ch = cdp.findChannel('contextGuard');
  assert.ok(ch, 'contextGuard channel must be registered in CHANNEL_REGISTRY');
  assert.equal(cdp.DEFAULT_CONFIG.contextGuard, 'off');
  assert.equal(cdp.DEFAULT_CONFIG.compactThreshold, '80');
  assert.equal(ch.shouldEnable(cdp.DEFAULT_CONFIG), false);
  assert.equal(ch.build(cdp.DEFAULT_CONFIG, { noDiskCache: true }), '');

  const onCfg = { ...cdp.DEFAULT_CONFIG, contextGuard: 'on', compactThreshold: '85' };
  assert.equal(ch.shouldEnable(onCfg), true);
  const expr = ch.build(onCfg, { noDiskCache: true });
  assert.ok(expr.length > 0 && Buffer.byteLength(expr, 'utf8') <= ch.budgetBytes);
  assert.doesNotThrow(() => new vm.Script(expr), 'Channel 17 expression must parse cleanly');
  assert.doesNotThrow(() => new vm.Script(ch.teardown), 'Channel 17 teardown must parse cleanly');

  // Verify 9 locales complete and non-CJK indices (en=2, ko=4, es=5, fr=6, de=7, tr=8) contain 0 Han chars
  const HAN_RE = /[\u4E00-\u9FFF]/;
  for (const [k, row] of Object.entries(cgMod.COPY)) {
    assert.equal(row.length, 9, `COPY.${k} must have 9 locale entries`);
    for (const idx of [2, 4, 5, 6, 7, 8]) {
      assert.equal(HAN_RE.test(row[idx]), false, `COPY.${k}[${idx}] leaked CJK: ${row[idx]}`);
    }
  }
  for (const [k, row] of Object.entries(setCgMod.TXT)) {
    assert.equal(row.length, 9, `settings TXT.${k} must have 9 locale entries`);
    for (const idx of [2, 4, 5, 6, 7, 8]) {
      assert.equal(HAN_RE.test(row[idx]), false, `settings TXT.${k}[${idx}] leaked CJK: ${row[idx]}`);
    }
  }
});

test('contextGuard embeds in #context-card Shadow DOM, guards reading viewport during Lexical v2.35 /compact, and destroys cleanly', async () => {
  const env = createMiniDom();
  const vp = env.doc.createElement('div');
  vp.setAttribute('data-testid', 'autoscroll-viewport');
  vp.scrollHeight = 3600;
  vp.clientHeight = 720;
  let nativeTop = 1400;
  Object.setPrototypeOf(vp, Object.create(Object.prototype, {
    scrollTop: {
      configurable: true,
      enumerable: true,
      get() { return nativeTop; },
      set(v) { nativeTop = Math.max(0, Math.min(2880, Number(v) || 0)); },
    },
    scrollTo: {
      configurable: true,
      writable: true,
      value(arg) { nativeTop = Math.max(0, Math.min(2880, Number(arg?.top ?? arg) || 0)); },
    },
    scroll: { configurable: true, writable: true, value(arg) { this.scrollTo(arg); } },
    scrollBy: { configurable: true, writable: true, value(arg) { nativeTop += Number(arg?.top ?? arg) || 0; } },
  }));
  env.conv.appendChild(vp);

  // Mount Lexical v2.35 slash menu option
  const opt = env.doc.createElement('div');
  opt.setAttribute('id', 'typeahead-item-0');
  opt.setAttribute('role', 'option');
  const lbl = env.doc.createElement('span');
  lbl.setAttribute('data-testid', 'menu-option-label');
  lbl.textContent = 'compact';
  let slashPicked = 0;
  lbl.addEventListener('click', () => { slashPicked += 1; });
  opt.appendChild(lbl);
  env.doc.body.appendChild(opt);

  let sendClicks = 0;
  env.sendBtn.addEventListener('click', () => {
    sendClicks += 1;
    vp.scrollTop = vp.scrollHeight;
    vp.scrollTo({ top: vp.scrollHeight });
    nativeTop = 2880;
    vp.dispatchEvent({ type: 'scroll' });
  });

  const savedSettings = [];
  env.win.__agPrismSetting = (k, v) => savedSettings.push([k, v]);

  let standaloneDestroyed = false;
  env.win.__agSessionGuard = { destroy() { standaloneDestroyed = true; } };

  let fakeNow = 5000;
  const ctl = cgMod.createContextGuardController({
    win: env.win,
    doc: env.doc,
    autoPoll: false,
    autoObserve: false,
    now: () => fakeNow,
    silentIdleDelayMs: 0,
    scrollSettleMs: 0,
    slashPollMs: 5,
    slashSubmitDelayMs: 0,
    scrollShieldMs: 400,
    compactThreshold: '80',
    lang: 'zh-CN',
    getContextSnapshot: () => ({ usedFraction: 0.84, streaming: false }),
  });

  assert.equal(standaloneDestroyed, true, 'must gracefully yield standalone Session Guard');
  assert.equal(env.win.__agSessionGuardOwner, 'obsidian-prism');

  // Verify #context-card Shadow DOM embedding & persistence
  const sec = env.card.querySelector('[data-testid="ag-prism-context-guard-sec"]');
  assert.ok(sec, 'must mount minimal section inside #context-card');
  const btn85 = sec.querySelector('button[data-ag-pcg-th="85"]');
  btn85.click();
  assert.deepEqual(savedSettings[0], ['compactThreshold', '85']);
  const btn80 = sec.querySelector('button[data-ag-pcg-th="80"]');
  btn80.click();

  await ctl.evaluateNow();
  assert.equal(slashPicked, 1);
  assert.equal(sendClicks, 1);
  assert.equal(vp.scrollTop, 1400, 'host jump-to-bottom must be blocked with 0px jump');
  assert.equal(ctl.getDebugState().scrollShieldActive, true);

  // Manual wheel scroll up works immediately and updates pin
  vp.dispatchEvent({ type: 'wheel', deltaY: -150 });
  nativeTop = 1250;
  vp.dispatchEvent({ type: 'scroll' });
  assert.equal(vp.scrollTop, 1250);

  // Subsequent host snap stays pinned at user new reading position
  fakeNow += 500;
  vp.scrollTop = 2880;
  assert.equal(vp.scrollTop, 1250);

  // destroy() restores viewport cleanly with zero own-property residue & removes Shadow DOM section
  ctl.destroy();
  assert.equal(Object.prototype.hasOwnProperty.call(vp, 'scrollTop'), false);
  assert.equal(env.card.querySelector('[data-testid="ag-prism-context-guard-sec"]'), null);
  assert.equal(env.win.__agSessionGuardOwner, undefined);
});

test('contextGuard /clear intercepts Enter, redacts secrets, navigates same-project link & syncs Settings panel rows', () => {
  const env = createMiniDom();
  const uMsg = env.doc.createElement('div');
  uMsg.setAttribute('data-testid', 'user-message-bubble');
  uMsg.textContent = 'Refactor auth with key sk-secret1234567890abcdef and Bearer tok_1234567890abcd';
  env.conv.appendChild(uMsg);

  const projLink = env.doc.createElement('a');
  projLink.setAttribute('href', '/?project=demo-proj');
  let navigated = 0;
  projLink.addEventListener('click', () => { navigated += 1; });
  env.doc.body.appendChild(projLink);

  const ctl = cgMod.createContextGuardController({
    win: env.win,
    doc: env.doc,
    autoPoll: false,
    autoObserve: false,
    compactThreshold: 'off',
    lang: 'en',
  });

  env.editor.textContent = '/clear keep';
  let prevented = false;
  env.doc.dispatchEvent({
    type: 'keydown',
    key: 'Enter',
    target: env.editor,
    preventDefault() { prevented = true; },
    stopPropagation() {},
    stopImmediatePropagation() {},
  });
  assert.equal(prevented, true);
  assert.equal(navigated, 1, 'must click exact same-project new conversation link');
  const pending = JSON.parse(env.store.get('agPrism.pendingCleanRestart.v1') || '{}');
  assert.ok(pending.prompt.includes('[REDACTED_TOKEN]'), 'must redact API keys in clean restart brief');
  assert.equal(pending.prompt.includes('sk-secret1234567890abcdef'), false);

  // Settings panel rows render cleanly in Modules section
  const settingsRoot = env.doc.createElement('div');
  const telRow = env.doc.createElement('div');
  telRow.setAttribute('data-ag-cs-row', 'telemetryModule');
  settingsRoot.appendChild(telRow);
  const saves = [];
  assert.equal(
    setCgMod.sync(settingsRoot, {
      doc: env.doc,
      win: env.win,
      lang: 'tr',
      effVal: (k) => (k === 'contextGuard' ? 'off' : '80'),
      saveSetting: (k, v) => saves.push([k, v]),
    }),
    true
  );
  const btn80 = settingsRoot.querySelector('button[data-ag-cs-cg-val="80"]');
  assert.ok(btn80);
  btn80.click();
  assert.deepEqual(saves, [['contextGuard', 'on'], ['compactThreshold', '80']]);

  ctl.destroy();
});
