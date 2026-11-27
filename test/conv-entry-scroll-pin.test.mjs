import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');

test('stream-choreography pins conversation entry to bottom across expanded work-detail auto-unfold & ResizeObserver, preserves mid-history scroll, and yields instantly on user wheel', () => {
  const src = fs.readFileSync(path.join(ROOT, 'stream-choreography.js'), 'utf8');
  const rafs = [];
  let roCb = null;
  const now = 1000;
  const vpListeners = new Map();
  const vp = {
    tagName: 'DIV',
    nodeType: 1,
    isConnected: true,
    clientHeight: 600,
    scrollHeight: 2400,
    scrollTop: 1800,
    firstElementChild: { tagName: 'DIV', nodeType: 1, isConnected: true },
    getAttribute: (k) => (k === 'data-testid' ? 'autoscroll-viewport' : null),
    getBoundingClientRect: () => ({ top: 0, bottom: 600, height: 600 }),
    addEventListener(t, fn) { (vpListeners.get(t) || vpListeners.set(t, new Set()).get(t)).add(fn); },
    removeEventListener(t, fn) { vpListeners.get(t)?.delete(fn); },
  };
  const mkBtn = (id, tid, expanded, growBy, topY) => {
    const attrs = new Map([['data-testid', tid], ['aria-expanded', expanded]]);
    return {
      id, tagName: 'BUTTON', nodeType: 1, isConnected: true,
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      setAttribute: (k, v) => attrs.set(k, String(v)),
      removeAttribute: (k) => attrs.delete(k),
      hasAttribute: (k) => attrs.has(k),
      closest: (s) => (s.includes('autoscroll-viewport') ? vp : null),
      getBoundingClientRect: () => ({ top: topY, bottom: topY + 24, height: 24 }),
      click() {
        attrs.set('aria-expanded', 'true');
        vp.scrollHeight += growBy;
      },
      querySelectorAll: () => [],
    };
  };
  const innerBtns = [
    mkBtn('hist-0', 'tool-group-collapsible', 'false', 900, -1200),
    mkBtn('hist-1', 'tool-group-collapsible', 'false', 800, -400),
    mkBtn('last-0', 'tool-group-collapsible', 'false', 500, 460),
    mkBtn('last-1', 'tool-group-collapsible', 'false', 400, 520),
  ];
  const scope = { nodeType: 1, isConnected: true, querySelectorAll: (s) => (s.includes('tool-group-collapsible') ? innerBtns : []) };
  const outer = mkBtn('outer', 'worked-for-collapsible', 'true', 0, 420);
  outer.nextElementSibling = scope;
  const convEl = {
    tagName: 'DIV', nodeType: 1, isConnected: true,
    getAttribute: (k) => (k === 'data-testid' ? 'conversation-view' : null),
    querySelector: (s) => (s.includes('autoscroll-viewport') ? vp : null),
  };
  const fakeDoc = {
    documentElement: { getAttribute: () => 'ultra' },
    body: {},
    querySelectorAll: (s) => (s.includes('worked-for-collapsible') ? [outer] : []),
  };
  const sb = {
    document: fakeDoc,
    window: {},
    performance: { now: () => now },
    requestAnimationFrame: (fn) => { rafs.push(fn); return rafs.length; },
    cancelAnimationFrame: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {},
    ResizeObserver: class { constructor(cb) { roCb = cb; } observe() {} disconnect() { roCb = null; } },
    addEventListener() {},
    removeEventListener() {},
    Map, Set, WeakMap, WeakSet, Array, Object, Math, Number, String, Boolean, Date, RegExp,
  };
  sb.window = sb; sb.globalThis = sb;
  vm.runInNewContext(src, sb);
  const ctl = sb.__agPrismStreamChoreography.createStreamChoreographyController({
    isDestroyed: () => false, isMotionStandardOrUltra: () => true, isMotionUltra: () => true, isConvRunning: () => false,
    isThoughtIsolatedNode: () => false, isThoughtMutationRecord: () => false, isManagedThoughtPanel: () => false,
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v), runGuardedMut: (fn) => fn(),
  });

  // 1) Arm on conversation entry -> stays pinned to exact bottom across tasklist ResizeObserver + multi-frame auto-unfold
  assert.equal(ctl.armConvEntryBottomPin(convEl), true);
  vp.scrollHeight += 350;
  roCb?.();
  assert.equal(vp.scrollTop, vp.scrollHeight - vp.clientHeight, 'ResizeObserver must keep viewport pinned to bottom of tasklist');

  ctl.syncWorkedForAutoUnfold();
  while (rafs.length) rafs.shift()();
  assert.equal(vp.scrollTop, vp.scrollHeight - vp.clientHeight, 'Auto-unfold of bottom & historical tool groups must stay pinned to true bottom');

  // 2) User wheel immediately aborts entry bottom pin
  for (const fn of [...(vpListeners.get('wheel') || [])]) fn({});
  assert.equal(ctl.isConvEntryPinActive(vp), false, 'User wheel must abort entry bottom pin immediately');
  vp.scrollTop = 1200;
  vp.scrollHeight += 500;
  assert.equal(vp.scrollTop, 1200, 'After user scroll, viewport must not be yanked back to bottom');

  // 3) Mid-history tab switch must NOT force-jump to bottom, and above-fold unfold compensates delta
  vp.scrollHeight = 5000;
  vp.scrollTop = 2000;
  assert.equal(ctl.armConvEntryBottomPin(convEl), false, 'Mid-history scroll position must not arm bottom pin');
  const histAbove = mkBtn('hist-above', 'tool-group-collapsible', 'false', 600, -300);
  innerBtns.push(histAbove);
  ctl.syncWorkedForAutoUnfold();
  assert.equal(vp.scrollTop, 2600, 'Historical unfold above viewport must compensate scrollTop by exact height delta');
});
