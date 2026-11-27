import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');

function makeEventBus() {
  const map = new Map();
  return {
    add(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
    },
    remove(type, fn) {
      map.get(type)?.delete(fn);
    },
    dispatch(type, ev = {}) {
      for (const fn of [...(map.get(type) || [])]) fn(ev);
    },
    count(type) {
      return (map.get(type) || new Set()).size;
    },
  };
}

function makeFakeClock(initialNow = 1000) {
  let now = initialNow;
  let seq = 1;
  const timers = new Map();
  const intervals = new Map();
  const rafs = new Map();
  return {
    get now() { return now; },
    set now(v) { now = v; },
    timers,
    intervals,
    rafs,
    performance: { now: () => now },
    setTimeout(fn, ms = 0) {
      const id = seq++;
      const delay = Math.max(0, Number(ms) || 0);
      timers.set(id, { fn, ms: delay, due: now + delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    setInterval(fn, ms = 0) {
      const id = seq++;
      const period = Math.max(1, Number(ms) || 1);
      intervals.set(id, { fn, ms: period, due: now + period });
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    requestAnimationFrame(fn) {
      const id = seq++;
      rafs.set(id, fn);
      return id;
    },
    cancelAnimationFrame(id) {
      rafs.delete(id);
    },
    flushRafs(stepMs = 16) {
      now += stepMs;
      const list = [...rafs.entries()];
      rafs.clear();
      for (const [, fn] of list) fn(now);
      return list.length;
    },
    advanceTimers(deltaMs) {
      const target = now + deltaMs;
      while (true) {
        let next = null;
        for (const [id, t] of timers.entries()) {
          if (t.due <= target && (!next || t.due < next.due)) next = { kind: 'timeout', id, due: t.due, t };
        }
        for (const [id, iv] of intervals.entries()) {
          if (iv.due <= target && (!next || iv.due < next.due)) next = { kind: 'interval', id, due: iv.due, iv };
        }
        if (!next) break;
        now = next.due;
        if (next.kind === 'timeout') {
          timers.delete(next.id);
          next.t.fn();
        } else {
          next.iv.due += next.iv.ms;
          next.iv.fn();
        }
      }
      now = target;
    },
  };
}

function makeMascotDomMock(clock, opts = {}) {
  const attrsMap = new Map();
  const winBus = makeEventBus();
  const docBus = makeEventBus();

  const makeEl = (tag) => {
    const elAttrs = new Map();
    const classes = new Set();
    const kids = [];
    const el = {
      nodeType: 1,
      tagName: tag.toUpperCase(),
      className: '',
      dataset: {},
      children: kids,
      childNodes: kids,
      get firstElementChild() { return kids[0] || null; },
      get lastElementChild() { return kids[kids.length - 1] || null; },
      parentNode: null,
      parentElement: null,
      width: tag === 'canvas' ? 64 : undefined,
      height: tag === 'canvas' ? 64 : undefined,
      style: {
        setProperty(k, v) { this[k] = String(v); },
        removeProperty(k) { delete this[k]; },
      },
      classList: {
        add: (...cs) => cs.forEach((c) => classes.add(c)),
        remove: (...cs) => cs.forEach((c) => classes.delete(c)),
        contains: (c) => classes.has(c),
        toggle: (c, f) => {
          const on = f === undefined ? !classes.has(c) : Boolean(f);
          if (on) classes.add(c);
          else classes.delete(c);
          return on;
        },
      },
      get firstChild() { return kids[0] || null; },
      setAttribute(k, v) { elAttrs.set(k, String(v)); },
      getAttribute(k) { return elAttrs.has(k) ? elAttrs.get(k) : null; },
      hasAttribute(k) { return elAttrs.has(k); },
      removeAttribute(k) { elAttrs.delete(k); },
      appendChild(c) { c.parentNode = el; c.parentElement = el; kids.push(c); return c; },
      removeChild(c) { const i = kids.indexOf(c); if (i >= 0) kids.splice(i, 1); c.parentNode = null; return c; },
      remove() { if (el.parentNode) el.parentNode.removeChild(el); },
      addEventListener() {},
      removeEventListener() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 720, bottom: 72, width: 720, height: 72 }),
      getContext(type) {
        if (type !== '2d') return null;
        return {
          imageSmoothingEnabled: false,
          fillStyle: '',
          globalAlpha: 1,
          setTransform() {},
          clearRect() {},
          fillRect() {},
          save() {},
          restore() {},
          translate() {},
          rotate() {},
          scale() {},
          drawImage() {},
        };
      },
    };
    return el;
  };

  const docEl = {
    getAttribute: (k) => (attrsMap.has(k) ? attrsMap.get(k) : null),
    setAttribute: (k, v) => attrsMap.set(k, String(v)),
    removeAttribute: (k) => attrsMap.delete(k),
    hasAttribute: (k) => attrsMap.has(k),
  };

  const win = {
    devicePixelRatio: 1,
    addEventListener: (t, fn) => winBus.add(t, fn),
    removeEventListener: (t, fn) => winBus.remove(t, fn),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };

  const doc = {
    hidden: false,
    defaultView: win,
    documentElement: docEl,
    createElement: (tag) => makeEl(tag),
    addEventListener: (t, fn) => docBus.add(t, fn),
    removeEventListener: (t, fn) => docBus.remove(t, fn),
  };

  const hostEl = makeEl('div');
  hostEl.ownerDocument = doc;
  hostEl.clientWidth = 720;
  if ('isConnected' in opts) hostEl.isConnected = opts.isConnected;

  const src = fs.readFileSync(path.join(ROOT, 'dual-mascot-rig.js'), 'utf8');
  const sb = {
    window: win,
    document: doc,
    performance: clock.performance,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    requestAnimationFrame: clock.requestAnimationFrame,
    cancelAnimationFrame: clock.cancelAnimationFrame,
    Math, Number, String, Boolean, Array, Object, Map, Set, Date, JSON,
  };
  sb.globalThis = sb;
  vm.runInNewContext(src, sb);
  return { rig: sb.__agDualMascotRig, hostEl, doc, win, winBus, docBus };
}

test('Wave 3 P1-1a & P2-3 dual-mascot-rig: detached host pauses heartbeat/theater, syncPowerState wakes cleanly, undefined isConnected stays active, and evalChromaColorAt LUT matches math 100%', () => {
  // 1. Mock hostEl WITHOUT isConnected (undefined) must stay active and never false-pause
  const clockUndef = makeFakeClock(1000);
  const envUndef = makeMascotDomMock(clockUndef);
  assert.equal(envUndef.hostEl.isConnected, undefined);
  const stUndef = envUndef.rig.mountDualMascotStage(envUndef.hostEl, { miniPileEnabled: false, reducedMotion: false });
  assert.equal(stUndef.getLayoutSnapshot().perf.timerPaused, false, 'Mock hostEl with isConnected===undefined must not pause');
  assert.equal(stUndef.getLayoutSnapshot().perf.timerIntervalMs, envUndef.rig.TICK);
  assert.equal(clockUndef.intervals.size, 1);
  assert.ok(clockUndef.timers.size >= 1, 'Theater timer should be armed when isConnected is undefined');
  stUndef.dispose();
  assert.equal(clockUndef.intervals.size, 0);
  assert.equal(clockUndef.timers.size, 0);

  // 2. Real DOM hostEl with isConnected=true -> false pauses heartbeat & theater; true + syncPowerState() restores both
  const clock = makeFakeClock(2000);
  const env = makeMascotDomMock(clock, { isConnected: true });
  const stage = env.rig.mountDualMascotStage(env.hostEl, { miniPileEnabled: false, reducedMotion: false });
  assert.equal(stage.getLayoutSnapshot().perf.timerPaused, false);
  assert.equal(clock.intervals.size, 1);
  assert.ok(clock.timers.size >= 1);

  // Detach hostEl and call syncPowerState() -> immediate 0-timer sleep
  env.hostEl.isConnected = false;
  stage.syncPowerState();
  assert.equal(stage.getLayoutSnapshot().perf.timerIntervalMs, 0);
  assert.equal(stage.getLayoutSnapshot().perf.timerPaused, true);
  assert.equal(clock.intervals.size, 0, 'Detached hostEl must clear heartbeat interval');
  assert.equal(clock.timers.size, 0, 'Detached hostEl must clear theater timer');

  const tickBeforeSleep = stage.getLayoutSnapshot().actors[0].tick;
  clock.advanceTimers(10000);
  assert.equal(stage.getLayoutSnapshot().actors[0].tick, tickBeforeSleep, '0 ticks while detached');

  // Reattach hostEl and call syncPowerState() -> instant wake of heartbeat + theater
  env.hostEl.isConnected = true;
  stage.syncPowerState();
  assert.equal(stage.getLayoutSnapshot().perf.timerIntervalMs, env.rig.TICK);
  assert.equal(stage.getLayoutSnapshot().perf.timerPaused, false);
  assert.equal(clock.intervals.size, 1, 'Reattached hostEl must restart heartbeat interval');
  assert.ok(clock.timers.size >= 1, 'Reattached hostEl must reschedule theater timer');

  // Also verify onHeartbeat self-pauses if hostEl becomes detached without syncPowerState()
  env.hostEl.isConnected = false;
  clock.advanceTimers(env.rig.TICK * 2);
  assert.equal(stage.getLayoutSnapshot().perf.timerIntervalMs, 0);
  assert.equal(clock.intervals.size, 0, 'onHeartbeat must self-pause when hostEl.isConnected === false');
  assert.equal(clock.timers.size, 0);
  stage.dispose();

  // 3. P2-3 evalChromaColorAt LUT equivalence across all 12 discrete phases, accumulated float phases, grid coords, and arbitrary phases
  const CHROMA_STOPS = [
    [0x42, 0x85, 0xf4],
    [0x9b, 0x72, 0xcb],
    [0xea, 0x43, 0x35],
    [0xfb, 0xbc, 0x04],
    [0x5c, 0xc6, 0xfc],
  ];
  function refEvalChroma(gx, gy, phase = 0, isShadow = false) {
    const raw = ((gx + gy) * 0.068 - phase) % 1;
    const u = (raw < 0 ? raw + 1 : raw) * CHROMA_STOPS.length;
    const i0 = Math.floor(u) % CHROMA_STOPS.length;
    const i1 = (i0 + 1) % CHROMA_STOPS.length;
    const t = u - Math.floor(u);
    const s = t * t * (3 - 2 * t);
    const c0 = CHROMA_STOPS[i0];
    const c1 = CHROMA_STOPS[i1];
    let r = c0[0] + (c1[0] - c0[0]) * s;
    let g = c0[1] + (c1[1] - c0[1]) * s;
    let b = c0[2] + (c1[2] - c0[2]) * s;
    if (isShadow) {
      r = r * 0.68 + 18 * 0.14;
      g = g * 0.68 + 22 * 0.14;
      b = b * 0.72 + 40 * 0.14;
    }
    const hex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }

  for (let k = 0; k < 12; k++) {
    const phase = k / 12;
    for (let gx = 0; gx <= 18; gx++) {
      for (let gy = 0; gy <= 18; gy++) {
        for (const isShadow of [false, true]) {
          const expected = refEvalChroma(gx, gy, phase, isShadow);
          const actual1 = env.rig.evalChromaColorAt(gx, gy, phase, isShadow);
          const actual2 = env.rig.evalChromaColorAt(gx, gy, phase, isShadow);
          assert.equal(actual1, expected, `Cold LUT mismatch at (${gx},${gy},k=${k},s=${isShadow})`);
          assert.equal(actual2, expected, `Warm LUT mismatch at (${gx},${gy},k=${k},s=${isShadow})`);
        }
      }
    }
  }
  // Accumulated float drift check (simulating 120 chroma steps of +1/12 % 1)
  let accPhase = 0;
  for (let step = 0; step < 120; step++) {
    const expected = refEvalChroma(7, 9, (step % 12) / 12, step % 2 === 1);
    assert.equal(env.rig.evalChromaColorAt(7, 9, accPhase, step % 2 === 1), expected);
    accPhase = (accPhase + 1 / 12) % 1;
  }
  // Arbitrary non-12-bucket phases remain 100% mathematically exact
  for (const p of [0.1, 0.137, 0.37, 0.73, -0.22]) {
    assert.equal(env.rig.evalChromaColorAt(5, 8, p, false), refEvalChroma(5, 8, p, false));
    assert.equal(env.rig.evalChromaColorAt(5, 8, p, true), refEvalChroma(5, 8, p, true));
  }
});

test('Wave 3 P1-1b & P2-1 home-ripple-host: parkRipple reclaims VRAM while keeping parked=true + lossless reattach at full DPR, and 300Hz throttle aligns via setTimeout with clean cancel', () => {
  const src = fs.readFileSync(path.join(ROOT, 'home-ripple-host.js'), 'utf8');
  const clock = makeFakeClock(1000);
  const docBus = makeEventBus();
  const winBus = makeEventBus();
  let homeMounted = true;

  const makeEl = (tag) => {
    const attrs = new Map();
    const bus = makeEventBus();
    return {
      tagName: tag.toUpperCase(),
      className: '',
      width: tag === 'canvas' ? 300 : undefined,
      height: tag === 'canvas' ? 150 : undefined,
      style: {},
      isConnected: true,
      children: [],
      get firstChild() { return this.children[0] || null; },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      hasAttribute: (k) => attrs.has(k),
      removeAttribute: (k) => attrs.delete(k),
      appendChild(c) { this.children.push(c); c.isConnected = true; return c; },
      insertBefore(c) { this.children.unshift(c); c.isConnected = true; return c; },
      remove() { this.isConnected = false; },
      querySelector: () => null,
      addEventListener: (t, fn) => bus.add(t, fn),
      removeEventListener: (t, fn) => bus.remove(t, fn),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: home.clientWidth, height: home.clientHeight }),
    };
  };

  const home = makeEl('div');
  home.clientWidth = 800;
  home.clientHeight = 480;
  const html = makeEl('html');
  html.setAttribute('data-ag-cs-ambient', '1');

  const fakeDoc = {
    hidden: false,
    documentElement: html,
    createElement: (tag) => makeEl(tag),
    querySelector: (sel) => (sel === '.agy-home' && homeMounted ? home : null),
    addEventListener: (t, fn) => docBus.add(t, fn),
    removeEventListener: (t, fn) => docBus.remove(t, fn),
  };

  const sb = {
    document: fakeDoc,
    devicePixelRatio: 2,
    performance: clock.performance,
    requestAnimationFrame: clock.requestAnimationFrame,
    cancelAnimationFrame: clock.cancelAnimationFrame,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    ResizeObserver: class { observe() {} disconnect() {} },
    addEventListener: (t, fn) => winBus.add(t, fn),
    removeEventListener: (t, fn) => winBus.remove(t, fn),
    Float32Array, Math, Number, String, Boolean, Array, Object, Map, Set,
  };
  sb.window = sb;
  sb.globalThis = sb;
  vm.runInNewContext(src, sb);

  let fieldDraws = 0;
  let fieldDisposes = 0;
  let glowReleases = 0;
  let glowDraws = 0;
  const rippleCore = {
    RIPPLE: { cellWidth: 16, cellHeight: 24 },
    parseCssColorToRgb: () => null,
    createWaveField: () => ({ height: new Float32Array(1), active: () => false, disturb() {}, skimmer() {}, advance() {} }),
    createGlyphField(cv) {
      return {
        mode: 'webgl2',
        busy: () => true,
        needsDraw: () => true,
        setCalmZones() {},
        invalidate() {},
        draw() {
          if (cv.width <= 0 || cv.height <= 0) throw new Error('draw at 0x0');
          fieldDraws += 1;
        },
        dispose() { fieldDisposes += 1; },
      };
    },
    mountBrandHorizonGlow(cv) {
      return {
        mode: 'webgl2',
        resize(w, h, dpr) { cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr)); },
        releaseBackingStore() { glowReleases += 1; cv.width = 0; cv.height = 0; },
        invalidate() {},
        clear() {},
        draw() {
          if (cv.width <= 0 || cv.height <= 0) throw new Error('glow draw at 0x0');
          glowDraws += 1;
        },
        dispose() {},
      };
    },
  };

  const ctl = sb.__agPrismHomeRippleHost.createHomeRippleController({
    rippleCore,
    isDestroyed: () => false,
    isAllowed: () => true,
    isDarkTheme: () => true,
    motionReduced: () => false,
    getMinFrameGapMs: () => 0,
    getAmbientIntensity: () => 1,
    getAccentTone: () => 'follow',
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
  });

  ctl.sync();
  const m = ctl.getMount();
  // Full 2x DPR on main ASCII canvas (800*2=1600, 480*2=960)
  assert.equal(m.canvas.width, 1600);
  assert.equal(m.canvas.height, 960);
  assert.equal(m.glowCanvas.width, 480);
  assert.equal(m.glowCanvas.height, 288);

  // First drawFrame paints frame 1 and schedules next rAF
  clock.flushRafs(16);
  assert.equal(fieldDraws, 1);
  assert.equal(clock.rafs.size, 1);

  // P2-1: Simulate 300Hz VSync arriving 3.3ms later (< minGap=33ms):
  // Must NOT re-arm rAF immediately; must schedule setTimeout for remaining ~30ms!
  clock.flushRafs(3.3);
  assert.equal(fieldDraws, 1, 'Throttled frame must skip render');
  assert.equal(clock.rafs.size, 0, '300Hz throttled frame must NOT spin rAF');
  assert.equal(clock.timers.size, 1, '300Hz throttled frame must align via setTimeout');
  const [{ ms: alignMs }] = [...clock.timers.values()];
  assert.ok(alignMs >= 28 && alignMs <= 32, `Expected aligned timer ~30ms, got ${alignMs}`);

  // When aligned timer expires, it wakes rAF and draws frame 2 cleanly
  clock.advanceTimers(alignMs);
  assert.equal(clock.rafs.size, 1);
  clock.flushRafs(4);
  assert.equal(fieldDraws, 2);

  // Trigger another 300Hz throttled timer, then navigate away from home (parkRipple) -> releases VRAM & cancels timer!
  clock.flushRafs(3.3);
  assert.equal(clock.timers.size, 1);
  const disposesBeforePark = fieldDisposes;
  homeMounted = false;
  ctl.sync();
  assert.equal(m.parked, true, 'parkRipple must keep parked=true after reclaim()');
  assert.equal(m.sleeping, true);
  assert.equal(m.canvas.width, 0, 'parkRipple must shrink main canvas to 0x0');
  assert.equal(m.canvas.height, 0);
  assert.equal(m.glowCanvas.width, 0, 'parkRipple must shrink glowCanvas to 0x0');
  assert.equal(m.glowCanvas.height, 0);
  assert.equal(glowReleases, 1);
  assert.equal(clock.timers.size, 0, 'parkRipple must clear throttle alignment timer');
  assert.equal(clock.rafs.size, 0);

  // Navigate back to home -> lossless in-place restore at full 2x DPR without disposing field!
  homeMounted = true;
  ctl.sync();
  assert.equal(m.parked, false);
  assert.equal(m.canvas.width, 1600, 'Reattach must restore main ASCII canvas at full 2x DPR');
  assert.equal(m.canvas.height, 960);
  assert.equal(m.glowCanvas.width, 480);
  assert.equal(m.glowCanvas.height, 288);
  assert.equal(fieldDisposes, disposesBeforePark, 'Reattach with unchanged size must restore in-place');
  const drawsBeforeResume = fieldDraws;
  clock.flushRafs(40);
  assert.equal(fieldDraws, drawsBeforeResume + 1);
  assert.ok(glowDraws >= 2);

  // Ensure unmount also cleans pending throttle timer
  clock.flushRafs(3.3);
  assert.equal(clock.timers.size, 1);
  ctl.unmount();
  assert.equal(clock.timers.size, 0);
  assert.equal(clock.rafs.size, 0);
});

test('Wave 3 P1-1c & P2-4 conv-aura: park() releases VRAM & sync() restores cleanly, and computeConvAuraOptics / invokeConvGlowDraw reuse static buffers without stale spectrum leak', () => {
  const src = fs.readFileSync(path.join(ROOT, 'conv-aura.js'), 'utf8');
  const clock = makeFakeClock(1000);
  const docBus = makeEventBus();
  const winBus = makeEventBus();
  let onHome = false;

  const makeEl = (tag, testId = '') => {
    const attrs = new Map();
    if (testId) attrs.set('data-testid', testId);
    const kids = [];
    return {
      nodeType: 1,
      tagName: tag.toUpperCase(),
      className: '',
      width: tag === 'canvas' ? 300 : undefined,
      height: tag === 'canvas' ? 150 : undefined,
      hidden: false,
      isConnected: true,
      parentElement: null,
      clientWidth: 900,
      clientHeight: 600,
      style: { setProperty(k, v) { this[k] = v; } },
      get firstChild() { return kids[0] || null; },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      hasAttribute: (k) => attrs.has(k),
      removeAttribute: (k) => attrs.delete(k),
      insertBefore(c) { c.parentElement = this; c.isConnected = true; kids.unshift(c); return c; },
      appendChild(c) { c.parentElement = this; c.isConnected = true; kids.push(c); return c; },
      remove() { this.isConnected = false; },
      closest: () => null,
      matches: (sel) => Boolean(testId && sel.includes(`"${testId}"`)),
      querySelectorAll: () => [],
    };
  };

  const seat = makeEl('div');
  const convView = makeEl('div', 'conversation-view');
  seat.appendChild(convView);
  const stopBtn = makeEl('button', 'stop-button');
  const homeMarker = makeEl('div');

  const fakeDoc = {
    hidden: false,
    documentElement: makeEl('html'),
    hasFocus: () => true,
    createElement: (tag) => makeEl(tag),
    querySelector: (sel) => (sel === '.agy-home' && onHome ? homeMarker : null),
    querySelectorAll(sel) {
      if (sel.includes('conversation-view')) return onHome ? [] : [convView];
      if (sel.includes('stop-button')) return [stopBtn];
      return [];
    },
    addEventListener: (t, fn) => docBus.add(t, fn),
    removeEventListener: (t, fn) => docBus.remove(t, fn),
  };

  const sb = {
    document: fakeDoc,
    devicePixelRatio: 2,
    performance: clock.performance,
    requestAnimationFrame: clock.requestAnimationFrame,
    cancelAnimationFrame: clock.cancelAnimationFrame,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    ResizeObserver: class { observe() {} disconnect() {} },
    addEventListener: (t, fn) => winBus.add(t, fn),
    removeEventListener: (t, fn) => winBus.remove(t, fn),
    WeakSet, Set, Map, Array, Object, Math, Number, String, Boolean,
  };
  sb.window = sb;
  sb.globalThis = sb;
  vm.runInNewContext(src, sb);

  // P2-4a: computeConvAuraOptics isolates default callers (out={}) and reuses caller-supplied out buffer with zero GC
  const api = sb.__agPrismConvAura;
  const isoA = api.computeConvAuraOptics('running', 1000, 1200, true, true);
  const isoB = api.computeConvAuraOptics('idle', 1000, 1400, true, false);
  assert.notEqual(isoA, isoB, 'default computeConvAuraOptics call must not mutate previous caller snapshot');
  assert.equal(isoA.semantic, 'none');
  assert.equal(isoB.frameMs, 110);
  const sharedBuf = {};
  const oRun = api.computeConvAuraOptics('running', 1000, 1200, true, true, sharedBuf);
  assert.equal(oRun, sharedBuf);
  assert.equal(oRun.semantic, 'none');
  const oIdle = api.computeConvAuraOptics('idle', 1000, 1400, true, false, sharedBuf);
  assert.equal(oIdle, sharedBuf, 'computeConvAuraOptics must reuse explicit out buffer object');
  assert.equal(oIdle.frameMs, 110);
  const oDec = api.computeConvAuraOptics('awaiting-decision', 1000, 1300, false, false, sharedBuf);
  assert.equal(oDec, sharedBuf);
  assert.equal(oDec.semantic, 'awaiting-decision');

  // P2-4b: invokeConvGlowDraw reuses extra buffer across running frames & clears spectrum when undefined
  let glowReleases = 0;
  let glowResizes = 0;
  const seenExtraRefs = new Set();
  const seenSpectra = [];
  let spectrumVal = 'warm';

  const mockRippleCore = {
    resolveHorizonDpr: (raw, scale) => Math.min(raw, 2) * scale,
    mountBrandHorizonGlow(cv) {
      return {
        mode: 'webgl2',
        resize(w, h, dpr) {
          glowResizes += 1;
          cv.width = Math.max(1, Math.round(w * dpr));
          cv.height = Math.max(1, Math.round(h * dpr));
        },
        releaseBackingStore() {
          glowReleases += 1;
          cv.width = 0;
          cv.height = 0;
        },
        invalidate() {},
        clear() {},
        draw(_now, _dark, _str, extra) {
          if (cv.width <= 0 || cv.height <= 0) throw new Error('conv-aura draw at 0x0');
          seenExtraRefs.add(extra);
          seenSpectra.push(extra.spectrum);
        },
        drawStaticSnapshot(_now, _dark, _str, extra) {
          if (cv.width <= 0 || cv.height <= 0) throw new Error('conv-aura snap at 0x0');
          seenExtraRefs.add(extra);
          seenSpectra.push(extra.spectrum);
        },
        dispose() {},
      };
    },
  };

  const ctl = api.createConvAuraController({
    isDestroyed: () => false,
    isHomeRippleEnabled: () => true,
    isMotionStandardOrUltra: () => true,
    isDarkTheme: () => true,
    getMinFrameGapMs: () => 0,
    getAmbientIntensity: () => 1,
    getSpectrumMode: () => spectrumVal,
    isWindowFocused: () => true,
    rippleCore: mockRippleCore,
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
    runGuardedMut: (fn) => fn(),
  });

  ctl.sync();
  const inst = ctl.getInstance();
  assert.ok(inst.canvas.width > 0 && inst.canvas.height > 0);

  // Run 5 running frames, switching spectrum from 'warm' -> undefined mid-way
  for (let i = 0; i < 5; i++) {
    if (i === 2) spectrumVal = undefined;
    clock.advanceTimers(40);
    clock.flushRafs(16);
  }
  assert.equal(seenExtraRefs.size, 1, 'invokeConvGlowDraw must reuse single static extra buffer across frames');
  assert.equal(seenSpectra[0], 'warm');
  assert.equal(seenSpectra[seenSpectra.length - 1], undefined, 'Static extra buffer must clear stale spectrum when undefined');

  // P1-1c: Switch to home page -> park() releases glowCanvas VRAM and keeps parked=true
  onHome = true;
  ctl.sync();
  assert.equal(inst.parked, true, 'park() must preserve parked=true after releaseBacking()');
  assert.equal(inst.sleeping, true);
  assert.equal(inst.backingReleased, true);
  assert.equal(inst.canvas.width, 0);
  assert.equal(inst.canvas.height, 0);
  assert.equal(glowReleases, 1);
  assert.equal(clock.timers.size, 0);
  assert.equal(clock.rafs.size, 0);

  // Switch back to conversation page -> sync() rebuilds backing store & paints immediately
  const resizesBeforeReturn = glowResizes;
  const drawsBeforeReturn = inst.drawCount;
  onHome = false;
  ctl.sync();
  assert.equal(inst.parked, false);
  assert.equal(inst.backingReleased, false);
  assert.ok(inst.canvas.width > 0 && inst.canvas.height > 0, 'Returning to conversation must restore glowCanvas backing store');
  assert.ok(glowResizes > resizesBeforeReturn);
  assert.equal(inst.drawCount, drawsBeforeReturn + 1, 'Returning to conversation must immediately paint first frame');

  ctl.unmount();
});

test('Wave 3 P1-1d prism-rim-canvas: origin-centered radial gradient cache + translate equivalence, window.blur clear & 1800ms VRAM reclaim, and teardown listener cleanup', () => {
  const src = fs.readFileSync(path.join(ROOT, 'prism-rim-canvas.js'), 'utf8');
  const clock = makeFakeClock(5000);
  const docBus = makeEventBus();
  const rootBus = makeEventBus();
  const winBus = makeEventBus();

  let gradCreates = 0;
  const gradArgs = [];
  const drawOps = [];
  let clearCalls = 0;

  const makeCanvas = () => {
    const attrs = new Map();
    const cv = {
      width: 300,
      height: 150,
      className: '',
      isConnected: true,
      parentElement: null,
      nextElementSibling: null,
      classList: { contains: (c) => cv.className.split(/\s+/).includes(c) },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      remove() { this.isConnected = false; },
      getContext(type) {
        if (type !== '2d') return null;
        let tx = 0;
        let ty = 0;
        let savedStack = [];
        return {
          globalAlpha: 1,
          lineWidth: 1,
          strokeStyle: null,
          save() { savedStack.push({ tx, ty, a: this.globalAlpha }); },
          translate(x, y) { tx += x; ty += y; },
          restore() { const s = savedStack.pop(); if (s) { tx = s.tx; ty = s.ty; this.globalAlpha = s.a; } },
          clearRect(_x, _y, w, h) {
            if (cv.width <= 0 || cv.height <= 0 || w <= 0 || h <= 0) throw new Error('clearRect at 0x0');
            clearCalls += 1;
          },
          beginPath() {},
          roundRect(x, y, w, h, r) {
            drawOps.push({ worldX: tx + x, worldY: ty + y, tx, ty, x, y, w, h, r });
          },
          stroke() {
            if (cv.width <= 0 || cv.height <= 0) throw new Error('stroke at 0x0');
          },
          createRadialGradient(x0, y0, r0, x1, y1, r1) {
            gradCreates += 1;
            gradArgs.push([x0, y0, r0, x1, y1, r1]);
            const stops = [];
            return { stops, addColorStop(p, c) { stops.push([p, c]); } };
          },
        };
      },
    };
    return cv;
  };

  const makeBox = (rect) => {
    const attrs = new Map([['data-ag-cs-prism-box', '1']]);
    const kids = [];
    const box = {
      isConnected: true,
      style: { setProperty() {} },
      get firstElementChild() { return kids[0] || null; },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      hasAttribute: (k) => attrs.has(k),
      removeAttribute: (k) => attrs.delete(k),
      appendChild(c) { c.parentElement = box; c.isConnected = true; kids.push(c); return c; },
      querySelector: (s) => (s === '.ag-cs-prism-rim-cv' ? kids[0] || null : null),
      getBoundingClientRect: () => rect,
    };
    return box;
  };

  const box1 = makeBox({ left: 100, top: 100, right: 400, bottom: 180, width: 300, height: 80 });
  let dark = true;
  let accent = 'follow';
  const html = {
    getAttribute: (k) => (k === 'data-ag-cs-motion' ? 'standard' : k === 'data-ag-cs-ambient' ? '1' : k === 'data-ag-cs-accent' ? accent : null),
    addEventListener: (t, fn) => rootBus.add(t, fn),
    removeEventListener: (t, fn) => rootBus.remove(t, fn),
  };

  const fakeDoc = {
    hidden: false,
    documentElement: html,
    createElement: () => makeCanvas(),
    getElementById: () => null,
    querySelectorAll(sel) {
      if (sel.includes('data-ag-cs-prism-box')) return [box1];
      if (sel.includes('.ag-cs-prism-rim-cv')) return box1.firstElementChild ? [box1.firstElementChild] : [];
      if (sel.includes('data-ag-cs-prism-cv')) return box1.hasAttribute('data-ag-cs-prism-cv') ? [box1] : [];
      return [];
    },
    addEventListener: (t, fn) => docBus.add(t, fn),
    removeEventListener: (t, fn) => docBus.remove(t, fn),
  };

  const sb = {
    document: fakeDoc,
    devicePixelRatio: 1,
    performance: clock.performance,
    requestAnimationFrame: clock.requestAnimationFrame,
    cancelAnimationFrame: clock.cancelAnimationFrame,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    getComputedStyle: () => ({ borderTopLeftRadius: '10px' }),
    addEventListener: (t, fn) => winBus.add(t, fn),
    removeEventListener: (t, fn) => winBus.remove(t, fn),
    Set, Map, Array, Math, Number, String, Boolean,
  };
  sb.window = sb;
  sb.globalThis = sb;
  vm.runInNewContext(src, sb);

  const ctl = sb.__agPrismRimCanvas.createPrismRimCanvasController({
    isDestroyed: () => false,
    isDarkTheme: () => dark,
    motionReduced: () => false,
    getMinFrameGapMs: () => 0,
    getAmbientIntensity: () => 1,
    getAccentTone: () => accent,
    canMountRealCanvas: () => true,
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
    runGuardedMut: (fn) => fn(),
  });

  assert.equal(winBus.count('blur'), 1, 'Controller must register window.blur listener');

  // Move pointer across 8 distinct points inside box1 -> gradient created ONLY ONCE at origin (0,0)
  for (let i = 0; i < 8; i++) {
    ctl.onPointerMove({ clientX: 140 + i * 20, clientY: 130 + i * 4 });
    clock.flushRafs(20);
  }
  assert.equal(gradCreates, 1, 'Repeated pointer moves must reuse cached origin-centered radial gradient');
  assert.deepEqual(gradArgs[0], [0, 0, 0, 0, 0, 240], 'Cached radial gradient must be centered at (0,0)');
  assert.equal(drawOps.length, 8);
  // Every translated roundRect maps back to exact world inset (strokeInset=1.0)
  for (const op of drawOps) {
    assert.ok(Math.abs(op.worldX - 1.0) < 1e-6, `Expected worldX=1.0, got ${op.worldX}`);
    assert.ok(Math.abs(op.worldY - 1.0) < 1e-6, `Expected worldY=1.0, got ${op.worldY}`);
  }

  // Theme / tone change invalidates gradient cache key cleanly
  dark = false;
  ctl.onPointerMove({ clientX: 250, clientY: 140 });
  clock.flushRafs(20);
  assert.equal(gradCreates, 2, 'Dark->Light toggle must rebuild cached radial gradient');

  accent = 'iris';
  ctl.onPointerMove({ clientX: 260, clientY: 140 });
  clock.flushRafs(20);
  assert.equal(gradCreates, 3, 'Tone change must rebuild cached radial gradient');

  // window.blur cancels pending rAF, clears canvas immediately, and arms 1800ms VRAM shrink
  const cv1 = box1.firstElementChild;
  assert.equal(cv1.width, 302);
  ctl.onPointerMove({ clientX: 270, clientY: 140 });
  assert.equal(clock.rafs.size, 1);
  const clearsBeforeBlur = clearCalls;

  winBus.dispatch('blur');
  assert.equal(clock.rafs.size, 0, 'window.blur must cancel pending rim rAF');
  assert.ok(clearCalls > clearsBeforeBlur, 'window.blur must clear active rim canvases');
  assert.equal(clock.timers.size, 1, 'window.blur must arm 1800ms idle shrink timer');

  clock.advanceTimers(1850);
  assert.equal(cv1.width, 0, 'Rim canvas must shrink to 0x0 1800ms after window.blur');
  assert.equal(cv1.height, 0);

  // Teardown unbinds window.blur cleanly with 0 leaks
  ctl.teardown();
  assert.equal(winBus.count('blur'), 0, 'teardown() must remove window.blur listener');
  assert.equal(docBus.count('visibilitychange'), 0);
  assert.equal(rootBus.count('pointerleave'), 0);
});

test('Wave 3 P2-2 vendor/effort-slider/upstream-client: paintDither caches gradient after sweep, stepClaudeCanvas caches getContext("2d") and pauses on data-ag-cs-win-blur="1"', () => {
  const src = fs.readFileSync(path.join(ROOT, 'vendor', 'effort-slider', 'upstream-client.js'), 'utf8');
  const clock = makeFakeClock(1000);
  const rootAttrs = new Map();

  let getContextCalls = 0;
  let gradCalls = 0;
  let fillRectCalls = 0;

  const makeMockCtx = () => ({
    globalAlpha: 1,
    fillStyle: '',
    clearRect() {},
    fillRect() { fillRectCalls += 1; },
    beginPath() {},
    moveTo() {},
    quadraticCurveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    createLinearGradient() {
      gradCalls += 1;
      return { addColorStop() {} };
    },
  });

  const makeEl = (tag) => {
    const attrs = new Map();
    const classes = new Set();
    const kids = [];
    const ctx = tag === 'canvas' ? makeMockCtx() : null;
    const el = {
      nodeType: 1,
      tagName: tag.toUpperCase(),
      className: '',
      dataset: {},
      classList: {
        add: (...cs) => cs.forEach((c) => classes.add(c)),
        remove: (...cs) => cs.forEach((c) => classes.delete(c)),
        contains: (c) => classes.has(c),
        toggle: (c, f) => {
          const on = f === undefined ? !classes.has(c) : Boolean(f);
          if (on) classes.add(c);
          else classes.delete(c);
          return on;
        },
      },
      children: kids,
      childNodes: kids,
      get firstElementChild() { return kids[0] || null; },
      get lastElementChild() { return kids[kids.length - 1] || null; },
      parentNode: null,
      width: tag === 'canvas' ? 280 : undefined,
      height: tag === 'canvas' ? 28 : undefined,
      style: {
        display: '',
        setProperty(k, v) { this[k] = String(v); },
        removeProperty(k) { delete this[k]; },
      },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      hasAttribute: (k) => attrs.has(k),
      removeAttribute: (k) => attrs.delete(k),
      appendChild(c) { c.parentNode = el; kids.push(c); return c; },
      removeChild(c) { const i = kids.indexOf(c); if (i >= 0) kids.splice(i, 1); c.parentNode = null; return c; },
      addEventListener() {},
      removeEventListener() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 280, height: 28 }),
      getContext(type) {
        if (type !== '2d') return null;
        getContextCalls += 1;
        return ctx;
      },
    };
    return el;
  };

  const docEl = {
    getAttribute: (k) => (rootAttrs.has(k) ? rootAttrs.get(k) : null),
    setAttribute: (k, v) => rootAttrs.set(k, String(v)),
    removeAttribute: (k) => rootAttrs.delete(k),
    hasAttribute: (k) => rootAttrs.has(k),
  };

  const doc = {
    hidden: false,
    documentElement: docEl,
    head: makeEl('head'),
    body: makeEl('body'),
    getElementById: () => null,
    createElement: (t) => makeEl(t),
    querySelector: () => null,
    querySelectorAll: () => [],
  };

  const win = {
    document: doc,
    performance: clock.performance,
    requestAnimationFrame: clock.requestAnimationFrame,
    cancelAnimationFrame: clock.cancelAnimationFrame,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    getComputedStyle: () => ({ backgroundColor: 'rgb(18, 18, 22)', color: 'rgb(240, 240, 245)' }),
    addEventListener() {},
    removeEventListener() {},
    matchMedia: () => ({ matches: false }),
  };

  win.__agCodexEffortSliderDisableAutoBoot = true;
  const sb = {
    window: win,
    document: doc,
    __agCodexEffortSliderDisableAutoBoot: true,
    performance: clock.performance,
    requestAnimationFrame: clock.requestAnimationFrame,
    cancelAnimationFrame: clock.cancelAnimationFrame,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    Date: { now: () => clock.now },
    Math, Number, String, Boolean, Array, Object, Map, Set, WeakMap, WeakSet, JSON,
  };
  sb.globalThis = sb;
  vm.runInNewContext(src, sb);

  const api = sb.AntigravityCodexEffortSlider;
  assert.ok(api && typeof api.paintDither === 'function');

  // 1. paintDither gradient cache: during sweep (progress < 1) builds gradient each frame; once progress >= 1 caches by `${w}|${dark}`
  const ctxA = makeMockCtx();
  const ctxB = makeMockCtx();
  gradCalls = 0;
  api.paintDither(ctxA, 220, 28, true, 0.3, 0.1, 1);
  api.paintDither(ctxA, 220, 28, true, 0.6, 0.2, 1);
  assert.equal(gradCalls, 2, 'During intro sweep (progress < 1), gradient updates per frame');

  // Sweep complete (progress >= 1): 15 frames at same (w, dark) -> only 1 gradient created!
  for (let i = 0; i < 15; i++) {
    api.paintDither(ctxA, 220, 28, true, 1, 0.5 + i * 0.05, 1);
  }
  assert.equal(gradCalls, 3, 'Post-sweep frames with same (w, dark) must hit cached LinearGradient');

  // Changing dark or width or ctx invalidates cleanly
  api.paintDither(ctxA, 220, 28, false, 1, 1.5, 1);
  assert.equal(gradCalls, 4, 'Changing dark flag must rebuild cached LinearGradient');
  api.paintDither(ctxA, 260, 28, false, 1, 1.6, 1);
  assert.equal(gradCalls, 5, 'Changing width must rebuild cached LinearGradient');
  api.paintDither(ctxB, 260, 28, false, 1, 1.7, 1);
  assert.equal(gradCalls, 6, 'Distinct canvas context must keep independent gradient cache');

  // 2. stepClaudeCanvas caches getContext('2d') and halts on data-ag-cs-win-blur="1"
  getContextCalls = 0;
  fillRectCalls = 0;
  const container = makeEl('div');
  const seat = {
    effortLevels: ['low', 'medium', 'high'],
    currentEffort: 'high',
    locked: false,
    baseName: 'Claude Opus 4.6',
    theme: 'claude',
    isClaude: true,
    subscribe: () => () => {},
  };

  const mounted = api.mountCodexEffortSlider({ container, seat, document: doc, window: win });
  assert.ok(clock.rafs.size >= 1, 'Claude high effort must start canvas rAF');

  for (let i = 0; i < 6; i++) {
    clock.flushRafs(20);
  }
  assert.equal(getContextCalls, 1, 'stepClaudeCanvas must cache getContext("2d") instead of querying every frame');
  assert.ok(fillRectCalls >= 6, 'Claude dither canvas must render across active frames');

  // Set data-ag-cs-win-blur="1" -> next rAF stops loop immediately with zero redraws
  const fillsBeforeBlur = fillRectCalls;
  rootAttrs.set('data-ag-cs-win-blur', '1');
  clock.flushRafs(20);
  assert.equal(fillRectCalls, fillsBeforeBlur, 'stepClaudeCanvas must skip painting on data-ag-cs-win-blur="1"');
  assert.equal(clock.rafs.size, 0, 'stepClaudeCanvas must halt rAF loop on data-ag-cs-win-blur="1"');

  mounted.unmount();
});

test('Wave 3 P1-3d vendor/host-i18n: blur->focus with 0 DOM mutations does 0 full scans; blur with DOM mutations catches up via one-shot probe; pointerenter skips 9-selector QSA when no floating hint while contextmenu keeps full scan', () => {
  const runtime = require(path.join(ROOT, 'vendor', 'host-i18n', 'host-i18n-runtime.js'));
  const clock = makeFakeClock(1000);
  const docBus = makeEventBus();
  const winBus = makeEventBus();
  const observerInstances = [];
  let floatingQsaCalls = 0;
  let bodyChildWalks = 0;

  function notifyObservers(mutation) {
    for (const obs of observerInstances) {
      if (!obs.connected) continue;
      obs.queue.push(mutation);
    }
  }
  function flushObservers() {
    for (const obs of observerInstances) {
      if (!obs.connected || obs.queue.length === 0) continue;
      const batch = obs.queue.splice(0);
      obs.cb(batch);
    }
  }

  class MockMO {
    constructor(cb) {
      this.cb = cb;
      this.connected = false;
      this.queue = [];
      this.cbCalls = 0;
      const origCb = cb;
      this.cb = (recs) => { this.cbCalls += 1; origCb(recs); };
      observerInstances.push(this);
    }
    observe() { this.connected = true; }
    disconnect() { this.connected = false; this.queue.length = 0; }
    takeRecords() { return this.queue.splice(0); }
  }

  function makeText(val) {
    return {
      nodeType: 3,
      _v: String(val),
      parentElement: null,
      parentNode: null,
      isConnected: true,
      get nodeValue() { return this._v; },
      set nodeValue(v) {
        const n = String(v);
        if (this._v === n) return;
        this._v = n;
        notifyObservers({ type: 'characterData', target: this });
      },
      get textContent() { return this._v; },
      get previousSibling() {
        if (!this.parentNode) return null;
        const i = this.parentNode.childNodes.indexOf(this);
        return i > 0 ? this.parentNode.childNodes[i - 1] : null;
      },
      get nextSibling() {
        if (!this.parentNode) return null;
        const i = this.parentNode.childNodes.indexOf(this);
        return i >= 0 && i + 1 < this.parentNode.childNodes.length ? this.parentNode.childNodes[i + 1] : null;
      },
    };
  }

  function makeEl(tag, opts = {}) {
    const attrs = new Map(Object.entries(opts.attrs || {}));
    const childNodes = [];
    const el = {
      nodeType: 1,
      tagName: String(tag).toUpperCase(),
      id: opts.id || attrs.get('id') || '',
      className: opts.className || '',
      isConnected: true,
      parentElement: null,
      parentNode: null,
      childNodes,
      get children() { return childNodes.filter((c) => c.nodeType === 1); },
      get firstChild() { return childNodes[0] || null; },
      get lastElementChild() { const ch = this.children; return ch[ch.length - 1] || null; },
      get previousElementSibling() {
        if (!this.parentNode) return null;
        const ch = this.parentNode.children;
        const i = ch.indexOf(this);
        return i > 0 ? ch[i - 1] : null;
      },
      get previousSibling() {
        if (!this.parentNode) return null;
        const i = this.parentNode.childNodes.indexOf(this);
        return i > 0 ? this.parentNode.childNodes[i - 1] : null;
      },
      get nextSibling() {
        if (!this.parentNode) return null;
        const i = this.parentNode.childNodes.indexOf(this);
        return i >= 0 && i + 1 < this.parentNode.childNodes.length ? this.parentNode.childNodes[i + 1] : null;
      },
      get textContent() { return childNodes.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join(''); },
      append(...nodes) {
        for (const n of nodes) {
          const item = typeof n === 'string' ? makeText(n) : n;
          item.parentElement = el;
          item.parentNode = el;
          childNodes.push(item);
          notifyObservers({ type: 'childList', target: el, addedNodes: [item], removedNodes: [] });
        }
        return el;
      },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      hasAttribute: (k) => attrs.has(k),
      removeAttribute: (k) => attrs.delete(k),
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) {
        const out = [];
        const match = (n) => sel.split(',').map((s) => s.trim()).some((part) => {
          if (part.startsWith('[') && part.endsWith(']')) {
            const inner = part.slice(1, -1);
            const eq = inner.indexOf('=');
            if (eq === -1) return n.hasAttribute(inner);
            const k = inner.slice(0, eq);
            const v = inner.slice(eq + 1).replace(/^"|"$/g, '');
            return n.getAttribute(k) === v;
          }
          if (part.startsWith('.')) return n.className.split(/\s+/).includes(part.slice(1));
          return false;
        });
        const walk = (n) => {
          for (const c of n.children) {
            if (match(c)) out.push(c);
            walk(c);
          }
        };
        walk(this);
        return out;
      },
    };
    if (opts.text !== undefined) {
      const t = makeText(opts.text);
      t.parentElement = el;
      t.parentNode = el;
      childNodes.push(t);
    }
    return el;
  }

  const html = makeEl('html');
  const body = makeEl('body');
  html.append(body);

  // Instrument a sentinel probe element under body to count full-document walks
  const probeBtn = makeEl('button', { text: 'Settings' });
  const origFirstChildGetter = Object.getOwnPropertyDescriptor(probeBtn, 'firstChild').get;
  Object.defineProperty(probeBtn, 'firstChild', {
    get() {
      bodyChildWalks += 1;
      return origFirstChildGetter.call(this);
    },
    configurable: true,
  });

  // Add a dialog & dialog-wrapping portal (must NOT trigger floating QSA hint)
  const dialog = makeEl('div', { attrs: { role: 'dialog' } });
  const dialogPortal = makeEl('div', { attrs: { 'data-floating-ui-portal': '' } });
  dialogPortal.append(makeEl('div', { attrs: { role: 'dialog' } }));
  const workbench = makeEl('div', { id: 'workbench' });
  const nestedContextMenu = makeEl('div', { attrs: { role: 'menu' }, text: 'Delete' });
  workbench.append(probeBtn);
  body.append(workbench, dialog, dialogPortal);

  const doc = {
    readyState: 'complete',
    hidden: false,
    documentElement: html,
    body,
    getElementById: (id) => {
      let found = null;
      const walk = (n) => {
        for (const c of n.children) {
          if (c.id === id) { found = c; return; }
          walk(c);
        }
      };
      walk(html);
      return found;
    },
    querySelector: (s) => html.querySelector(s),
    querySelectorAll(s) {
      if (s.includes('[role="tooltip"]') && s.includes('.monaco-hover')) floatingQsaCalls += 1;
      return html.querySelectorAll(s);
    },
    addEventListener: (t, fn) => docBus.add(t, fn),
    removeEventListener: (t, fn) => docBus.remove(t, fn),
  };

  const win = {
    document: doc,
    MutationObserver: MockMO,
    addEventListener: (t, fn) => winBus.add(t, fn),
    removeEventListener: (t, fn) => winBus.remove(t, fn),
  };

  const dict = { exact: { Settings: '设置', Save: '保存', Copy: '复制', Delete: '删除', Cancel: '取消' }, patterns: [] };
  const inst = runtime.mountHostI18n({
    root: win,
    doc,
    dict,
    mode: 'on',
    nowFn: () => clock.now,
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
    rafFn: clock.requestAnimationFrame,
    cancelRafFn: clock.cancelAnimationFrame,
  });

  assert.equal(probeBtn.textContent, '设置');

  // 1. Alt+Tab blur -> focus with ZERO DOM mutations -> 0 full-document scans!
  clock.advanceTimers(1500);
  bodyChildWalks = 0;
  winBus.dispatch('blur');
  assert.equal(observerInstances[0].connected, false, 'Main MO disconnects during visible blur');
  const dirtyObs = observerInstances[observerInstances.length - 1];
  assert.notEqual(dirtyObs, observerInstances[0]);
  assert.equal(dirtyObs.connected, true, 'One-shot dirty probe observes while visible-blurred');

  winBus.dispatch('focus');
  assert.equal(observerInstances[0].connected, true, 'Main MO reconnects on focus');
  assert.equal(dirtyObs.connected, false, 'One-shot dirty probe disconnects on focus');
  assert.equal(bodyChildWalks, 0, 'Zero DOM mutations during blur->focus must trigger 0 full-document scans!');

  // 2. Blur with DOM mutations -> one-shot dirty probe self-disconnects on 1st mutation (0 callbacks for burst), focus catches up!
  winBus.dispatch('blur');
  assert.equal(dirtyObs.connected, true);
  const callsBeforeBurst = dirtyObs.cbCalls;
  const lateBtn1 = makeEl('button', { text: 'Save' });
  body.append(lateBtn1);
  flushObservers();
  assert.equal(dirtyObs.cbCalls, callsBeforeBurst + 1);
  assert.equal(dirtyObs.connected, false, 'One-shot dirty probe must self-disconnect after 1st mutation');

  // Subsequent 30 mutations during blur cause 0 observer callbacks
  const lateBtn2 = makeEl('button', { text: 'Cancel' });
  for (let i = 0; i < 30; i++) body.append(makeEl('span', { text: `noise-${i}` }));
  body.append(lateBtn2);
  flushObservers();
  assert.equal(dirtyObs.cbCalls, callsBeforeBurst + 1, '0 observer callbacks after one-shot probe self-disconnects');
  assert.equal(lateBtn1.textContent, 'Save');

  winBus.dispatch('focus');
  assert.equal(lateBtn1.textContent, '保存', 'Focus wake must catch up mutations occurred during blur');
  assert.equal(lateBtn2.textContent, '取消');

  // 3. document.hidden = true must NOT keep dirty probe connected, and visibility restore catches up
  doc.hidden = true;
  docBus.dispatch('visibilitychange');
  assert.equal(observerInstances[0].connected, false);
  assert.equal(dirtyObs.connected, false, 'Hidden document must disconnect dirty probe too');
  const hiddenBtn = makeEl('button', { text: 'Copy' });
  body.append(hiddenBtn);
  doc.hidden = false;
  docBus.dispatch('visibilitychange');
  assert.equal(hiddenBtn.textContent, '复制');

  // 4. pointerenter without floating hint skips 9-selector full-document querySelectorAll
  floatingQsaCalls = 0;
  clock.advanceTimers(200);
  docBus.dispatch('pointerenter', { type: 'pointerenter', target: probeBtn });
  clock.advanceTimers(200);
  assert.equal(floatingQsaCalls, 0, 'Ordinary pointerenter without floating shell/portal hint must do 0 full 9-selector QSA');

  // 5. pointerenter WITH floating tooltip at body tail translates tooltip cleanly
  const tip = makeEl('div', { attrs: { role: 'tooltip' }, text: 'Copy' });
  // Insert silently without triggering MO to verify scanFloatingContainers handles it
  body.childNodes.push(tip);
  tip.parentElement = body;
  tip.parentNode = body;
  clock.advanceTimers(200);
  docBus.dispatch('pointerenter', { type: 'pointerenter', target: probeBtn });
  clock.advanceTimers(200);
  assert.equal(tip.textContent, '复制', 'pointerenter with floating tooltip at body tail must translate it');
  // Remove tip from tail for contextmenu test
  body.childNodes.pop();

  // 6. contextmenu ALWAYS executes full 9-selector QSA (even for deeply nested menu not at body tail)
  workbench.childNodes.push(nestedContextMenu);
  nestedContextMenu.parentElement = workbench;
  nestedContextMenu.parentNode = workbench;
  floatingQsaCalls = 0;
  clock.advanceTimers(200);
  docBus.dispatch('contextmenu', { type: 'contextmenu', target: probeBtn });
  clock.advanceTimers(200);
  assert.equal(floatingQsaCalls, 1, 'contextmenu must perform full 9-selector floating QSA');
  assert.equal(nestedContextMenu.textContent, '删除', 'contextmenu full scan must translate nested menu');

  inst.destroy();
  assert.equal(observerInstances[0].connected, false);
  assert.equal(dirtyObs.connected, false);
});

test('GPU-01 usage-ui.cjs: lazy-binds non-passive document wheel/touchmove/modal guards only while open and unbinds on close/dispose', () => {
  const src = fs.readFileSync(path.join(ROOT, 'vendor', 'pulse-dashboard', 'compat', 'usage-ui.cjs'), 'utf8');
  const docBus = makeEventBus();
  const winBus = makeEventBus();
  const makeNode = (tag, id = '') => {
    const attrs = new Map();
    const kids = [];
    const node = {
      nodeType: 1,
      tagName: String(tag || 'DIV').toUpperCase(),
      id,
      className: '',
      hidden: false,
      disabled: false,
      tabIndex: 0,
      textContent: '',
      dataset: {},
      children: kids,
      childNodes: kids,
      get firstElementChild() { return kids[0] || null; },
      get lastElementChild() { return kids[kids.length - 1] || null; },
      parentNode: null,
      style: {
        cssText: '',
        setProperty(k, v) { this[k] = String(v); },
        getPropertyValue(k) { return this[k] || ''; },
      },
      _popoverOpen: false,
      get open() { return attrs.has('open'); },
      get isConnected() { return true; },
      showPopover() { this._popoverOpen = true; },
      hidePopover() { this._popoverOpen = false; },
      matches(sel) { return sel === ':popover-open' ? this._popoverOpen : false; },
      setAttribute(k, v) { attrs.set(k, String(v)); if (k === 'id') this.id = String(v); },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      removeAttribute(k) { attrs.delete(k); },
      hasAttribute(k) { return attrs.has(k); },
      append(...ns) { for (const n of ns) { if (n && typeof n === 'object') { n.parentNode = node; kids.push(n); } } },
      before() {},
      after() {},
      replaceChildren(...ns) { kids.length = 0; this.append(...ns); },
      remove() {},
      focus() {},
      addEventListener() {},
      removeEventListener() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
      getClientRects: () => [{ width: 800, height: 600 }],
      querySelector(sel) {
        if (sel === '#totals') {
          if (!idMap.has('totals')) idMap.set('totals', makeNode('div', 'totals'));
          return idMap.get('totals');
        }
        if (sel === 'svg') return makeNode('svg');
        return null;
      },
      querySelectorAll: () => [],
      attachShadow() {
        const sr = makeNode('#shadow');
        sr.host = node;
        sr.getElementById = (k) => {
          if (!idMap.has(k)) idMap.set(k, makeNode('div', k));
          return idMap.get(k);
        };
        sr.querySelectorAll = () => [];
        return sr;
      },
      getContext() {
        return { clearRect() {}, fillRect() {}, getImageData: () => ({ data: [120, 140, 220, 255] }), fillStyle: '' };
      },
      animate: () => ({ cancel() {} }),
    };
    return node;
  };
  const idMap = new Map();
  const rootEl = makeNode('div');
  const fakeDoc = {
    createElement: (t) => makeNode(t),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
    addEventListener: (t, fn) => docBus.add(t, fn),
    removeEventListener: (t, fn) => docBus.remove(t, fn),
  };
  const fakeWin = {
    document: fakeDoc,
    addEventListener: (t, fn) => winBus.add(t, fn),
    removeEventListener: (t, fn) => winBus.remove(t, fn),
    matchMedia: () => ({ matches: true }),
    getComputedStyle: () => ({ getPropertyValue: () => '#3186ff' }),
    MutationObserver: class { observe() {} disconnect() {} },
    performance: { now: () => 1000 },
    setTimeout,
    clearTimeout,
  };
  const mod = { exports: null };
  vm.runInNewContext(src, {
    module: mod,
    exports: {},
    window: fakeWin,
    document: fakeDoc,
    matchMedia: fakeWin.matchMedia,
    getComputedStyle: fakeWin.getComputedStyle,
    MutationObserver: fakeWin.MutationObserver,
    performance: fakeWin.performance,
    setTimeout,
    clearTimeout,
    Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON, Promise,
  });
  const ui = mod.exports({
    root: rootEl,
    language: {
      language: 'en',
      t: (k) => k,
      mountLanguagePicker: () => ({ close() {}, sync() {}, update() {}, dispose() {} }),
    },
    setMarkup: (el, html) => {
      if (String(html || '').includes('<span')) el.replaceChildren(makeNode('span'));
    },
    guideDismissed: true,
    onDismissGuide: async () => {},
    onLanguage: () => {},
    onRefresh: async () => {},
  });

  // Closed on mount: 0 document wheel/touchmove/keydown/pointerdown guards!
  for (const ev of ['wheel', 'touchmove', 'keydown', 'focusin', 'pointerdown', 'mousedown', 'click']) {
    assert.equal(docBus.count(ev), 0, `Closed usage modal must bind 0 document ${ev} listeners`);
  }
  assert.equal(winBus.count('resize'), 0, 'Closed usage modal must bind 0 window resize listeners');

  const sampleData = {
    today: '2026-11-26',
    firstDate: '2026-11-26',
    timeZone: 'UTC+8',
    todayTokens: 1000,
    weekTokens: 1000,
    monthTokens: 1000,
    totalTokens: 1000,
    requests: 2,
    models: ['gemini-2.5-pro'],
    days: [{ date: '2026-11-26', models: { 'gemini-2.5-pro': { total: 1000, requests: 2, uncached: 500, cacheRead: 200, cacheWrite: 100, output: 200 } } }],
    scope: 'local',
    accountKey: 'acct-1',
  };
  ui.open(sampleData);
  assert.equal(docBus.count('wheel'), 1, 'Open usage modal must bind document wheel guard');
  assert.equal(docBus.count('touchmove'), 1, 'Open usage modal must bind document touchmove guard');
  assert.equal(winBus.count('resize'), 1, 'Open usage modal must bind window resize listener');

  ui.close();
  assert.equal(docBus.count('wheel'), 0, 'Closing usage modal must unbind document wheel guard');
  assert.equal(docBus.count('touchmove'), 0, 'Closing usage modal must unbind document touchmove guard');
  assert.equal(winBus.count('resize'), 0, 'Closing usage modal must unbind window resize listener');

  ui.open(sampleData);
  assert.equal(docBus.count('wheel'), 1);
  ui.dispose();
  for (const ev of ['wheel', 'touchmove', 'keydown', 'focusin', 'pointerdown', 'mousedown', 'click']) {
    assert.equal(docBus.count(ev), 0, `dispose() must leave 0 document ${ev} listeners`);
  }
  assert.equal(winBus.count('resize'), 0);
});

test('GPU-03 conv-aura: 300Hz running stream with 60Hz targetFps aligns via setTimeout instead of spinning rAF', () => {
  const src = fs.readFileSync(path.join(ROOT, 'conv-aura.js'), 'utf8');
  const clock = makeFakeClock(1000);
  const docBus = makeEventBus();
  const winBus = makeEventBus();

  const makeEl = (tag) => {
    const attrs = new Map();
    const kids = [];
    const el = {
      tagName: tag.toUpperCase(),
      className: '',
      isConnected: true,
      parentElement: null,
      children: kids,
      width: tag === 'canvas' ? 300 : undefined,
      height: tag === 'canvas' ? 150 : undefined,
      style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      hasAttribute: (k) => attrs.has(k),
      removeAttribute: (k) => attrs.delete(k),
      appendChild(c) { c.parentElement = el; kids.push(c); return c; },
      insertBefore(c) { c.parentElement = el; kids.unshift(c); return c; },
      get firstChild() { return kids[0] || null; },
      remove() { this.isConnected = false; },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 600 }),
      querySelector: () => null,
      querySelectorAll: () => [],
    };
    return el;
  };
  const convView = makeEl('div');
  convView.clientWidth = 900;
  convView.clientHeight = 600;
  const stopBtn = makeEl('button');
  stopBtn.getBoundingClientRect = () => ({ left: 800, top: 550, right: 830, bottom: 580, width: 30, height: 30 });
  stopBtn.getClientRects = () => [{ width: 30, height: 30 }];
  convView.querySelector = (s) => (s.includes('stop-button') ? stopBtn : null);
  convView.querySelectorAll = (s) => (s.includes('stop-button') ? [stopBtn] : []);
  const fakeDoc = {
    hidden: false,
    documentElement: makeEl('html'),
    body: makeEl('body'),
    createElement: (t) => makeEl(t),
    querySelector: (s) => (s.includes('conversation-view') ? convView : null),
    querySelectorAll: (s) => (s.includes('conversation-view') ? [convView] : []),
    addEventListener: (t, fn) => docBus.add(t, fn),
    removeEventListener: (t, fn) => docBus.remove(t, fn),
  };
  convView.offsetParent = fakeDoc.body;
  stopBtn.offsetParent = convView;
  const sb = {
    document: fakeDoc,
    devicePixelRatio: 1,
    performance: clock.performance,
    requestAnimationFrame: clock.requestAnimationFrame,
    cancelAnimationFrame: clock.cancelAnimationFrame,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1', position: 'relative' }),
    ResizeObserver: class { observe() {} disconnect() {} },
    addEventListener: (t, fn) => winBus.add(t, fn),
    removeEventListener: (t, fn) => winBus.remove(t, fn),
    Math, Number, String, Boolean, Array, Object, Map, Set,
  };
  sb.window = sb;
  sb.globalThis = sb;
  vm.runInNewContext(src, sb);

  const ctl = sb.__agPrismConvAura.createConvAuraController({
    isDestroyed: () => false,
    isHomeRippleEnabled: () => true,
    isMotionStandardOrUltra: () => true,
    isDarkTheme: () => true,
    getMinFrameGapMs: () => 15.2,
    getAmbientIntensity: () => 1,
    getSpectrumMode: () => 'default',
    isWindowFocused: () => true,
    rippleCore: {
      resolveHorizonDpr: (raw, scale) => Math.min(raw, 2) * scale,
      mountBrandHorizonGlow: (cv) => ({
        mode: 'webgl2',
        resize(w, h, dpr) { cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr)); },
        releaseBackingStore() { cv.width = 0; cv.height = 0; },
        invalidate() {},
        clear() {},
        draw() {},
        drawStaticSnapshot() {},
        dispose() {},
      }),
    },
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
    runGuardedMut: (fn) => fn(),
  });

  ctl.sync();
  assert.ok(ctl.getInstance(), 'conv-aura must mount on mock conversation-view');
  // Advance past initial start burst into steady 'running' phase, then tick at 300Hz (3.33ms) VSync cadence
  clock.advanceTimers(550);
  clock.flushRafs(3.33); // enters 'running', records lastRafTs & lastGpuDrawAt, schedules rAF
  clock.flushRafs(3.33); // +3.33ms -> measures vsDt=3.33ms, rem=12ms > max(8, 5.33) -> timer-aligned!
  assert.equal(clock.rafs.size, 0, '300Hz running conv-aura under 60Hz targetFps must not spin rAF');
  assert.equal(clock.timers.size, 1, '300Hz running conv-aura under 60Hz targetFps must align via setTimeout');
  ctl.unmount();
});

test('GPU-05 crystal-prism-core & model-glyph-crystal: low-power WebGL2, DPR<=2, 0x0 dispose, and blur halts step loop', () => {
  const crystalCore = require(path.join(ROOT, 'crystal-prism-core.js'));
  let seenGlOpts = null;
  const fakeCv = {
    width: 100,
    height: 10,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 10 }),
    getContext(type, opts) {
      if (type === 'webgl2') { seenGlOpts = opts; return null; }
      return {
        setTransform() {}, clearRect() {}, save() {}, restore() {}, beginPath() {}, roundRect() {},
        rect() {}, clip() {}, fillRect() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc() {},
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} }),
      };
    },
  };
  const prevDpr = globalThis.devicePixelRatio;
  globalThis.devicePixelRatio = 3;
  try {
    const inst = crystalCore.mountCrystalPrismBar(fakeCv, { reduceMotion: true });
    assert.equal(seenGlOpts?.powerPreference, 'low-power', 'crystal-prism-core must request low-power WebGL2 context');
    assert.ok(fakeCv.width <= 400, `DPR must cap at 2 (<=400px for 200px bar), got ${fakeCv.width}`);
    inst.dispose();
    assert.equal(fakeCv.width, 0, 'crystal-prism-core dispose() must zero canvas width to 0');
    assert.equal(fakeCv.height, 0, 'crystal-prism-core dispose() must zero canvas height to 0');
  } finally {
    if (prevDpr === undefined) delete globalThis.devicePixelRatio;
    else globalThis.devicePixelRatio = prevDpr;
  }

  const mgcSrc = fs.readFileSync(path.join(ROOT, 'model-glyph-crystal.js'), 'utf8');
  assert.match(mgcSrc, /(?:data-ag-cs-|DP\s*\+\s*')win-blur/, 'model-glyph-crystal must gate isHid() on data-ag-cs-win-blur="1"');
  assert.match(mgcSrc, /'blur',\s*cancelStepRaf/, 'model-glyph-crystal must cancel stepCrystalLoop on window.blur');
  assert.match(mgcSrc, /onFocus\s*=\s*\(\)\s*=>\s*Promise\.resolve\(\)\.then\(onPwr\)/, 'model-glyph-crystal must defer focus wake past ui-runtime clearWinBlur');
});

test('GPU-07 prism-rim-canvas: mirror-mode pointer moves reuse cached radial & linear gradients without per-frame allocation', () => {
  const src = fs.readFileSync(path.join(ROOT, 'prism-rim-canvas.js'), 'utf8');
  const clock = makeFakeClock(5000);
  const docBus = makeEventBus();
  const rootBus = makeEventBus();
  const winBus = makeEventBus();
  let radialCreates = 0;
  let linearCreates = 0;

  const makeCanvas = () => {
    const attrs = new Map();
    const cv = {
      width: 300, height: 150, className: '', isConnected: true, parentElement: null,
      classList: { contains: (c) => cv.className.split(/\s+/).includes(c) },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      remove() { this.isConnected = false; },
      getContext: (t) => t !== '2d' ? null : {
        globalAlpha: 1, lineWidth: 1, strokeStyle: null, fillStyle: null,
        save() {}, restore() {}, translate() {}, clip() {}, clearRect() {}, fillRect() {},
        beginPath() {}, roundRect() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {},
        createRadialGradient() { radialCreates += 1; return { addColorStop() {} }; },
        createLinearGradient() { linearCreates += 1; return { addColorStop() {} }; },
      },
    };
    return cv;
  };
  const kids = [];
  const boxAttrs = new Map([['data-ag-cs-prism-box', '1'], ['data-ag-cs-prism-mirror', '1']]);
  const box = {
    isConnected: true, style: { setProperty() {} },
    get firstElementChild() { return kids[0] || null; },
    setAttribute: (k, v) => boxAttrs.set(k, String(v)),
    getAttribute: (k) => (boxAttrs.has(k) ? boxAttrs.get(k) : null),
    hasAttribute: (k) => boxAttrs.has(k),
    removeAttribute: (k) => boxAttrs.delete(k),
    appendChild(c) { c.parentElement = box; c.isConnected = true; kids.push(c); return c; },
    querySelector: (s) => (s === '.ag-cs-prism-rim-cv' ? kids[0] || null : null),
    getBoundingClientRect: () => ({ left: 100, top: 100, right: 400, bottom: 180, width: 300, height: 80 }),
  };
  const html = {
    getAttribute: (k) => (k === 'data-ag-cs-motion' ? 'standard' : k === 'data-ag-cs-ambient' ? '1' : null),
    addEventListener: (t, fn) => rootBus.add(t, fn),
    removeEventListener: (t, fn) => rootBus.remove(t, fn),
  };
  const fakeDoc = {
    hidden: false, documentElement: html,
    createElement: () => makeCanvas(),
    getElementById: () => null,
    querySelectorAll: (s) => s.includes('data-ag-cs-prism-box') ? [box] : [],
    addEventListener: (t, fn) => docBus.add(t, fn),
    removeEventListener: (t, fn) => docBus.remove(t, fn),
  };
  const sb = {
    document: fakeDoc, devicePixelRatio: 1, performance: clock.performance,
    requestAnimationFrame: clock.requestAnimationFrame, cancelAnimationFrame: clock.cancelAnimationFrame,
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    getComputedStyle: () => ({ borderTopLeftRadius: '10px' }),
    addEventListener: (t, fn) => winBus.add(t, fn),
    removeEventListener: (t, fn) => winBus.remove(t, fn),
    Set, Map, Array, Math, Number, String, Boolean,
  };
  sb.window = sb; sb.globalThis = sb;
  vm.runInNewContext(src, sb);
  const ctl = sb.__agPrismRimCanvas.createPrismRimCanvasController({
    isDestroyed: () => false, isDarkTheme: () => true, motionReduced: () => false,
    getMinFrameGapMs: () => 0, getAmbientIntensity: () => 1, getAccentTone: () => 'follow',
    canMountRealCanvas: () => true, setAttrIfChanged: (el, k, v) => el.setAttribute(k, v), runGuardedMut: (fn) => fn(),
  });
  for (let i = 0; i < 6; i++) {
    if (i === 3) ctl.markDirty();
    ctl.onPointerMove({ clientX: 130 + i * 24, clientY: 130 + i * 3 });
    clock.flushRafs(16);
  }
  assert.equal(radialCreates, 3, 'Mirror mode must create its 3 radial gradients only once across 6 pointer moves');
  assert.equal(linearCreates, 2, 'Mirror mode must create its 2 ghost linear gradients only once across 6 pointer moves');
  ctl.teardown();
});

test('GPU-02/04/06/08/09/10 invariants: inline-widget composer scope & blur pause, sidebar blur CSS, octopath low-power/RO, effort DPR<=2, oled mono cache, vial isCalm/0x0 dispose, pulse-vial <31KB', () => {
  // GPU-02 inline-widget.cjs
  const iwSrc = fs.readFileSync(path.join(ROOT, 'vendor', 'pulse-dashboard', 'compat', 'inline-widget.cjs'), 'utf8');
  assert.equal(/document\.querySelectorAll\('button,\[role="button"\]/.test(iwSrc), false, 'inline-widget fits()/densityBounds() must not scan full document');
  assert.match(iwSrc, /isWindowPaused/, 'inline-widget must pause observer/interval on hidden or data-ag-cs-win-blur="1"');
  assert.match(iwSrc, /isStreamNoiseNode/, 'inline-widget MO must fast-filter streaming leaf mutations');
  assert.match(iwSrc, /onWake=\(\)=>queueMicrotask\(/, 'inline-widget onWake must defer past synchronous clearWinBlur');

  // GPU-04 sidebar-client.js
  const sbSrc = fs.readFileSync(path.join(ROOT, 'vendor', 'sidebar-studio', 'sidebar-client.js'), 'utf8');
  assert.match(sbSrc, /html\[data-ag-cs-win-blur="1"\] \.ag-prism-vessel::after/, 'sidebar-client CSS must pause vessel conic-gradient halo on win-blur');
  assert.match(sbSrc, /html\[data-ag-cs-win-blur="1"\] \.ag-prism-aura-orb\{will-change:auto!important\}/, 'sidebar-client CSS must release will-change on blur/hidden');
  assert.match(sbSrc, /html\[data-ag-cs-win-blur="1"\] \.ag-prism-vessel\{backdrop-filter:none!important/, 'sidebar-client CSS must drop backdrop-filter on blur/low-motion');

  // GPU-06 octopath-stage-webgl.js
  const octSrc = fs.readFileSync(path.join(ROOT, 'vendor', 'clawd-mascot', 'octopath-stage-webgl.js'), 'utf8');
  assert.equal(/powerPreference:\s*'high-performance'/.test(octSrc), false, 'octopath-stage-webgl must not force high-performance dGPU');
  assert.match(octSrc, /ResizeObserver/, 'octopath-stage-webgl must cache CSS width via ResizeObserver');

  // GPU-08 effort-slider/upstream-client.js
  const esSrc = fs.readFileSync(path.join(ROOT, 'vendor', 'effort-slider', 'upstream-client.js'), 'utf8');
  assert.match(esSrc, /html\[data-ag-cs-win-blur='1'\] \.ces-star/, 'effort-slider CSS must pause star/sweep animations on win-blur');
  assert.match(esSrc, /N\(2,\s*\(win\s*&&\s*\+win\.devicePixelRatio\)/, 'effort-slider Claude canvas must cap DPR at 2');
  assert.match(esSrc, /winBlurred\s*=\s*false;\s*Promise\.resolve\(\)\.then\(/, 'effort-slider onWinFocus must clear winBlurred and defer wake past clearWinBlur');

  // GPU-09 keyboard-3d-gl.js & oled-cyber-screen.js
  const kbSrc = fs.readFileSync(path.join(ROOT, 'vendor', 'periodic-picker', 'keyboard-3d-gl.js'), 'utf8');
  assert.match(kbSrc, /rafAlignTimer/, 'keyboard-3d-gl must align throttled rAF via timer on high-Hz displays');
  const oledSrc = fs.readFileSync(path.join(ROOT, 'vendor', 'periodic-picker', 'oled-cyber-screen.js'), 'utf8');
  assert.match(oledSrc, /getMonoSurfaceForKey/, 'oled-cyber-screen must cache monochrome offscreen surface instead of per-frame ctx.filter');

  // GPU-10 vial-core.js + pulse-vial-bridge.js
  const vialCore = require(path.join(ROOT, 'vial-core.js'));
  let reduceFlag = false;
  const vCv = {
    width: 96, height: 220,
    getContext: (t) => t === '2d' ? {
      setTransform() {}, clearRect() {}, save() {}, restore() {}, beginPath() {}, roundRect() {},
      rect() {}, clip() {}, fillRect() {}, strokeRect() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {},
      arcTo() {}, closePath() {}, stroke() {}, fill() {}, arc() {}, ellipse() {}, translate() {}, rotate() {},
      scale() {}, setLineDash() {}, fillText() {},
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    } : null,
    addEventListener() {}, removeEventListener() {},
  };
  const vl = vialCore.mountPhysicalWaterVial(vCv, {
    getState: () => ({ isDark: true, streaming: true, fill: 0.5, reduceMotion: reduceFlag }),
  });
  assert.equal(typeof vl.isCalm(), 'boolean', 'vial-core must expose zero-alloc isCalm()');
  reduceFlag = true;
  vl.step(0.016);
  assert.equal(vl.isSettled(), true, 'vial-core must dynamically settle when reduceMotion becomes true');
  vl.dispose();
  assert.equal(vCv.width, 0, 'vial-core dispose() must zero canvas width to 0');
  assert.equal(vCv.height, 0, 'vial-core dispose() must zero canvas height to 0');

  const pvbSize = fs.statSync(path.join(ROOT, 'pulse-vial-bridge.js')).size;
  assert.ok(pvbSize < 31000, `pulse-vial-bridge.js must stay < 31,000 B, got ${pvbSize}`);
});
