import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');

const cdp = require(path.join(ROOT, 'cdp.js'));
const rippleCore = require(path.join(ROOT, 'ripple-core.js'));
const simWorkerMod = require(path.join(ROOT, 'src', 'runtime', 'ripple-field-sim-worker.js'));

function makeClock(startNow = 1000) {
  let now = startNow;
  let seq = 1;
  const timers = new Map();
  const rafs = new Map();
  return {
    get now() { return now; },
    set now(v) { now = v; },
    timers,
    rafs,
    performance: { now: () => now },
    setTimeout(fn, ms = 0) {
      const id = seq++;
      timers.set(id, { fn, due: now + Math.max(0, Number(ms) || 0) });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(fn) {
      const id = seq++;
      rafs.set(id, fn);
      return id;
    },
    cancelAnimationFrame(id) { rafs.delete(id); },
    advance(deltaMs, stepMs = 16) {
      const end = now + deltaMs;
      while (now < end) {
        let nextT = null;
        for (const [id, t] of timers.entries()) {
          if (t.due <= end && (!nextT || t.due < nextT.t.due)) nextT = { id, t };
        }
        const nextR = rafs.size > 0 ? Math.min(end, now + stepMs) : Infinity;
        if (nextT && nextT.t.due <= nextR) {
          now = nextT.t.due;
          timers.delete(nextT.id);
          nextT.t.fn();
        } else if (nextR < Infinity) {
          now = nextR;
          const list = [...rafs.entries()];
          rafs.clear();
          for (const [, fn] of list) fn(now);
        } else {
          now = end;
        }
      }
    },
  };
}

function makeGlTracker() {
  const stats = {
    createProgram: 0,
    texStorage2D: 0,
    texSubImage2D: 0,
    drawArrays: 0,
    loseContext: 0,
    lost: false,
    lastCells: null,
    uniforms: {},
  };
  const gl = {
    VERTEX_SHADER: 0x8b31, FRAGMENT_SHADER: 0x8b30, COMPILE_STATUS: 0x8b81, LINK_STATUS: 0x8b82,
    COLOR_BUFFER_BIT: 0x4000, TRIANGLES: 0x0004, TEXTURE_2D: 0x0de1, TEXTURE0: 0x84c0, TEXTURE1: 0x84c1,
    RGBA: 0x1908, RGBA8: 0x8058, UNSIGNED_BYTE: 0x1401, NEAREST: 0x2600, LINEAR: 0x2601, CLAMP_TO_EDGE: 0x812f,
    TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800, TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803,
    isContextLost: () => stats.lost,
    createShader: () => ({}),
    shaderSource() {},
    compileShader() {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    deleteShader() {},
    createProgram: () => { stats.createProgram += 1; return {}; },
    attachShader() {},
    linkProgram() {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    useProgram() {},
    deleteProgram() {},
    getUniformLocation: (_p, n) => ({ n }),
    createTexture: () => ({}),
    deleteTexture() {},
    activeTexture() {},
    bindTexture() {},
    texParameteri() {},
    texStorage2D() { stats.texStorage2D += 1; },
    texImage2D() {},
    texSubImage2D(...args) {
      stats.texSubImage2D += 1;
      const buf = args[8];
      if (buf && ArrayBuffer.isView(buf)) stats.lastCells = new Uint8Array(buf);
    },
    viewport() {},
    clearColor() {},
    clear() {},
    uniform1i() {},
    uniform1f() {},
    uniform2f() {},
    uniform3f() {},
    uniform4f(loc, a, b, c, d) { if (loc?.n) stats.uniforms[loc.n] = [a, b, c, d]; },
    drawArrays() { stats.drawArrays += 1; },
    getExtension: (n) => (n === 'WEBGL_lose_context' ? { loseContext() { stats.lost = true; stats.loseContext += 1; } } : null),
  };
  return { gl, stats };
}

function createHarness({ withSim = true } = {}) {
  const clock = makeClock(1000);
  const workerClock = makeClock(1000);
  const blobSources = new Map();
  const createdWorkers = [];
  const offscreens = [];
  let blobSeq = 0;

  const docBus = new Map();
  const winBus = new Map();
  const moCbs = [];
  let dropInit = false;
  const addB = (m, t, f) => { if (!m.has(t)) m.set(t, new Set()); m.get(t).add(f); };
  const remB = (m, t, f) => m.get(t)?.delete(f);

  const mk2d = () => ({ setTransform() {}, clearRect() {}, fillText() {}, font: '', textBaseline: '', textAlign: '', fillStyle: '' });
  class MockOffscreenCanvas {
    constructor(w, h) {
      this.width = w;
      this.height = h;
      this._listeners = new Map();
      this._gl = makeGlTracker();
      offscreens.push(this);
    }
    addEventListener(t, fn) { addB(this._listeners, t, fn); }
    dispatchContextLost() {
      this._gl.stats.lost = true;
      for (const fn of this._listeners.get('webglcontextlost') || []) fn({ preventDefault() {} });
    }
    getContext(t) {
      if (t === 'webgl2') return this._gl.gl;
      if (t === '2d') return mk2d();
      return null;
    }
  }

  const doc = { hidden: false };
  const makeEl = (tag, cls = '', w = 700, h = 450) => {
    const attrs = new Map();
    const listeners = new Map();
    const kids = [];
    let offscreenMoved = false;
    const el = {
      nodeType: 1,
      tagName: tag.toUpperCase(),
      className: cls,
      dataset: {},
      style: { setProperty(k, v) { this[k] = String(v); }, removeProperty(k) { delete this[k]; } },
      clientWidth: w,
      clientHeight: h,
      width: tag === 'canvas' ? 300 : undefined,
      height: tag === 'canvas' ? 150 : undefined,
      isConnected: true,
      parentNode: null,
      parentElement: null,
      ownerDocument: doc,
      children: kids,
      get firstChild() { return kids[0] || null; },
      setAttribute(k, v) { attrs.set(k, String(v)); if (k === 'data-ag-cs-perf-mode') el.dataset.agCsPerfMode = String(v); },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      hasAttribute(k) { return attrs.has(k); },
      removeAttribute(k) { attrs.delete(k); },
      appendChild(c) { c.parentNode = c.parentElement = el; c.isConnected = true; kids.push(c); return c; },
      insertBefore(c, r) { c.parentNode = c.parentElement = el; c.isConnected = true; const i = kids.indexOf(r); if (i >= 0) kids.splice(i, 0, c); else kids.push(c); return c; },
      replaceWith(n) { const p = el.parentNode; if (!p) return; const i = p.children.indexOf(el); if (i >= 0) p.children[i] = n; n.parentNode = n.parentElement = p; n.isConnected = true; el.parentNode = el.parentElement = null; el.isConnected = false; },
      remove() { const p = el.parentNode; if (p) { const i = p.children.indexOf(el); if (i >= 0) p.children.splice(i, 1); } el.parentNode = el.parentElement = null; el.isConnected = false; },
      addEventListener(t, fn) { addB(listeners, t, fn); },
      removeEventListener(t, fn) { remB(listeners, t, fn); },
      dispatchEvent(t, ev = {}) { ev.target = ev.target || el; for (const fn of [...(listeners.get(t) || [])]) fn(ev); },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: el.clientWidth, height: el.clientHeight, right: el.clientWidth, bottom: el.clientHeight }),
      closest: (s) => (s.includes('conversation-view') ? el.getAttribute('data-testid') === 'conversation-view' ? el : null : null),
      querySelector: (s) => (s === '.agy-home' ? null : el.querySelectorAll(s)[0] || null),
      querySelectorAll: (s) => {
        if (!s.includes('conversation-view')) return [];
        return convView.isConnected ? [convView] : [];
      },
      transferControlToOffscreen() {
        if (offscreenMoved) throw new Error('InvalidStateError: Cannot transferControlToOffscreen twice');
        offscreenMoved = true;
        return new MockOffscreenCanvas(el.width || 1, el.height || 1);
      },
      getContext(t) {
        if (t === '2d') return mk2d();
        return makeGlTracker().gl;
      },
    };
    return el;
  };

  const html = makeEl('html');
  const body = makeEl('body');
  const seat = makeEl('div', 'flex-1 min-h-0 flex flex-col', 700, 450);
  const convView = makeEl('div', '', 700, 450);
  convView.setAttribute('data-testid', 'conversation-view');
  html.appendChild(body);
  body.appendChild(seat);
  seat.appendChild(convView);
  doc.documentElement = html;
  doc.body = body;
  doc.createElement = (t) => makeEl(t, '', 700, 450);
  doc.querySelector = (s) => (s === '.agy-home' ? null : null);
  doc.querySelectorAll = (s) => (s.includes('conversation-view') ? [convView] : []);
  doc.addEventListener = (t, fn) => addB(docBus, t, fn);
  doc.removeEventListener = (t, fn) => remB(docBus, t, fn);
  doc.dispatchEvent = (t, ev = {}) => { for (const fn of [...(docBus.get(t) || [])]) fn(ev); };

  class MockWorker {
    constructor(url) {
      this.url = url;
      this.terminated = false;
      this.msgs = [];
      this.rawMsgs = [];
      this.onmessage = null;
      this.onerror = null;
      const src = blobSources.get(url) || '';
      const selfCtx = {
        onmessage: null,
        postMessage: (d) => {
          if (this.terminated) return;
          this.onmessage?.({ data: d });
        },
        close() {},
        OffscreenCanvas: MockOffscreenCanvas,
        requestAnimationFrame: workerClock.requestAnimationFrame,
        cancelAnimationFrame: workerClock.cancelAnimationFrame,
        setTimeout: workerClock.setTimeout,
        clearTimeout: workerClock.clearTimeout,
        performance: workerClock.performance,
        Math, Number, String, Boolean, Array, Object, Map, Set,
        Uint8Array, Float32Array, Float64Array,
      };
      selfCtx.self = selfCtx;
      selfCtx.globalThis = selfCtx;
      vm.runInNewContext(src, selfCtx);
      this._self = selfCtx;
      createdWorkers.push(this);
    }
    postMessage(d) {
      if (this.terminated) return;
      this.msgs.push(d?.type || '');
      this.rawMsgs.push(d);
      if (dropInit && d?.type === 'init') return;
      this._self.onmessage?.({ data: d });
    }
    terminate() { this.terminated = true; }
  }

  const sb = {
    document: doc,
    devicePixelRatio: 1,
    performance: clock.performance,
    requestAnimationFrame: clock.requestAnimationFrame,
    cancelAnimationFrame: clock.cancelAnimationFrame,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    OffscreenCanvas: MockOffscreenCanvas,
    Worker: MockWorker,
    Blob: class { constructor(parts) { this.parts = parts; } },
    URL: {
      createObjectURL(blob) { const u = `blob:test/${++blobSeq}`; blobSources.set(u, blob.parts.join('')); return u; },
      revokeObjectURL(u) { blobSources.delete(u); },
    },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    ResizeObserver: class { observe() {} disconnect() {} },
    MutationObserver: class {
      constructor(cb) { this.cb = cb; this._recs = []; }
      observe(el, opts = {}) {
        const rec = { cb: this.cb, el, filter: Array.isArray(opts?.attributeFilter) ? [...opts.attributeFilter] : null };
        this._recs.push(rec);
        moCbs.push(rec);
      }
      disconnect() {
        for (const rec of this._recs) {
          const i = moCbs.indexOf(rec);
          if (i >= 0) moCbs.splice(i, 1);
        }
        this._recs.length = 0;
      }
    },
    addEventListener: (t, fn) => addB(winBus, t, fn),
    removeEventListener: (t, fn) => remB(winBus, t, fn),
    Math, Number, String, Boolean, Array, Object, Map, Set,
    Uint8Array, Float32Array, Float64Array,
  };
  sb.window = sb;
  sb.globalThis = sb;

  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'runtime', 'ripple-worker.js'), 'utf8'), sb);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'ripple-core.js'), 'utf8'), sb);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'home-ripple-host.js'), 'utf8'), sb);
  if (withSim) {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'runtime', 'ripple-field-sim-worker.js'), 'utf8'), sb);
  }

  const dispatchWin = (t, ev = {}) => { for (const fn of [...(winBus.get(t) || [])]) fn(ev); };
  const fireAttr = (attrName, targetEl = html) => {
    for (const rec of [...moCbs]) {
      if (rec.el !== targetEl) continue;
      if (rec.filter && !rec.filter.includes(attrName)) continue;
      rec.cb([{ type: 'attributes', attributeName: attrName, target: targetEl }]);
    }
  };
  const setDropInit = (v) => { dropInit = !!v; };
  return { sb, doc, html, seat, clock, workerClock, createdWorkers, offscreens, dispatchWin, fireAttr, setDropInit };
}

test('Channel 17 compile, WORKER_SIM_SRC hygiene, and gating (<=36KB on, 0B off)', () => {
  assert.doesNotThrow(() => new vm.Script(simWorkerMod.WORKER_SIM_SRC));
  const simSrc = fs.readFileSync(path.join(ROOT, 'src', 'runtime', 'ripple-field-sim-worker.js'), 'utf8');
  assert.equal(simSrc.includes('requestAnimationFrame(tk)'), false);
  assert.ok(/preserveDrawingBuffer\s*:\s*false/.test(simSrc));

  const onExpr = cdp.buildRippleSimChannelExpression({ ...cdp.DEFAULT_CONFIG }, { noDiskCache: true });
  const onBytes = Buffer.byteLength(onExpr, 'utf8');
  assert.ok(onBytes > 0 && onBytes <= 36 * 1024, `rippleSim bytes ${onBytes} must fit <= 36KB`);
  assert.doesNotThrow(() => new vm.Script(onExpr));

  assert.equal(cdp.buildRippleSimChannelExpression({ ...cdp.DEFAULT_CONFIG, motionLevel: 'off' }, { noDiskCache: true }), '');
  assert.equal(cdp.buildRippleSimChannelExpression({ ...cdp.DEFAULT_CONFIG, homeRipple: false, convRipple: 'off' }, { noDiskCache: true }), '');
});

test('Sim worker runs wave physics + WebGL2 off main thread (0 main rAF), handles resize anti-flicker, pause & auto-sleep', async () => {
  const h = createHarness({ withSim: true });
  await h.sb.__agPrismRippleWorker.probeWorkerWebGL2();

  const ctl = h.sb.__agPrismHomeRippleHost.createHomeRippleController({
    rippleCore: h.sb.__agCsRippleCore,
    isDestroyed: () => false,
    isAllowed: () => true,
    isConvAllowed: () => true,
    getConvLevel: () => 'full',
    isConvRunning: () => false,
    isDarkTheme: () => true,
    motionReduced: () => false,
    getMinFrameGapMs: () => 0,
    getAmbientIntensity: () => 1,
    getAccentTone: () => 'follow',
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
  });

  ctl.sync();
  // Drain initial state sync rAF
  h.clock.advance(20, 16);
  const m = ctl.getMount();
  assert.equal(m.field.selfDriven, true);
  assert.equal(m.mode, 'conv');

  // After initial 1 settled draw inside worker, worker must sleep and main thread must have 0 queued rAF
  h.workerClock.advance(200, 16);
  assert.equal(h.clock.rafs.size, 0, 'Main thread must have 0 active rAF in conv selfDriven mode');
  assert.equal(m.sleeping, true);

  // Trigger click ripple: worker runs frames, main thread stays at 0 rAF
  const mainRafsBefore = h.clock.rafs.size;
  const simOs = h.offscreens.find((c) => c._gl.stats.createProgram > 0);
  assert.ok(simOs, 'Expected WebGL2 simulation OffscreenCanvas');
  const drawsBefore = simOs._gl.stats.drawArrays;
  h.seat.dispatchEvent('pointerdown', { button: 0, clientX: 250, clientY: 200, target: h.seat });
  assert.equal(m.sleeping, false);
  assert.equal(h.clock.rafs.size, mainRafsBefore, 'disturb must NOT schedule main-thread rAF');

  h.workerClock.advance(300, 16);
  assert.ok(simOs._gl.stats.drawArrays > drawsBefore + 5, 'Worker must advance & render frames autonomously');

  // Issue #97 resize: 4th arg dpr read properly, 0 program rebuilds, synchronous 1 frame draw inside onmessage
  const progsBefore = simOs._gl.stats.createProgram;
  const drawsBeforeResize = simOs._gl.stats.drawArrays;
  m.field.resize(80, 40, m.waves, 1.5);
  assert.deepEqual({ ...m.field.getBufferSize() }, { width: 80 * 7 * 1.5, height: 40 * 15 * 1.5, dpr: 1.5 });
  assert.equal(simOs._gl.stats.createProgram, progsBefore, 'Resize must reuse WebGL2 program');
  assert.equal(simOs._gl.stats.drawArrays, drawsBeforeResize + 1, 'Resize must synchronously draw 1 frame');

  // Pause (sleep) immediately stops worker rAF to 0fps
  m.field.setPaused(true, true);
  h.workerClock.advance(200, 16);
  assert.equal(h.workerClock.rafs.size, 0, 'setPaused(true) must clear worker rAF immediately');

  // Wake again and let a single bounded wave settle cleanly -> auto-sleep
  m.wake(true);
  m.waves.disturb(10, 10, { amplitudeScale: 0.75, radiusScale: 0.85, duration: 0.25 });
  assert.equal(m.field.isSettled(), false);
  for (let t = 0; t < 15000 && (!m.sleeping || !m.field.isSettled()); t += 48) h.workerClock.advance(48, 48);
  assert.equal(m.sleeping, true, 'Settled wave must auto-sleep back to 0fps');
  assert.equal(m.field.isSettled(), true);
  assert.equal(h.workerClock.rafs.size, 0);

  // Release & webglcontextlost fallback: remountF must allocate real wave arrays and not crash
  m.field.releaseBackingStore();
  assert.deepEqual({ ...m.field.getBufferSize() }, { width: 0, height: 0, dpr: 1.5 });
  simOs.dispatchContextLost();
  h.clock.advance(64, 16);
  assert.equal(m.field.selfDriven, undefined);
  assert.ok(m.waves.height instanceof Float32Array, 'Fallback remount must restore Float32Array waves.height');

  ctl.unmount();
});

test('Late Channel 17 arrival swaps canvas cleanly and upgrades legacy worker mount to selfDriven', async () => {
  const h = createHarness({ withSim: false });
  await h.sb.__agPrismRippleWorker.probeWorkerWebGL2();

  const ctl = h.sb.__agPrismHomeRippleHost.createHomeRippleController({
    rippleCore: h.sb.__agCsRippleCore,
    isDestroyed: () => false,
    isAllowed: () => true,
    isConvAllowed: () => true,
    getConvLevel: () => 'medium',
    isConvRunning: () => false,
    isDarkTheme: () => true,
    motionReduced: () => false,
    getMinFrameGapMs: () => 0,
    getAmbientIntensity: () => 1,
    getAccentTone: () => 'follow',
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
  });

  ctl.sync();
  h.clock.advance(20, 16);
  const m = ctl.getMount();
  const legacyCv = m.canvas;
  assert.equal(m.field.mode, 'worker-webgl2');
  assert.equal(m.field.selfDriven, undefined);

  // Late Channel 17 injection arrives after legacy worker already transferred control
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'runtime', 'ripple-field-sim-worker.js'), 'utf8'), h.sb);
  assert.doesNotThrow(() => h.sb.__agPrismSimReady?.());
  assert.notEqual(m.canvas, legacyCv, 'Upgrade must replace <canvas> before transferControlToOffscreen');
  assert.equal(m.field.selfDriven, true, 'Late Channel 17 must upgrade legacy mount to selfDriven worker');

  ctl.unmount();
});

test('P1/P2 regressions: unmount cleanup, hidden upgrade defer + reattach pointerLeave, clearAura redraw, release sleep, coalescing & onPtr gating', async () => {
  // P1 #1 & P1 #6: hidden defers upgrade until visibilitychange; unmount clears __agPrismSimReady and marks parked
  const h1 = createHarness({ withSim: false });
  await h1.sb.__agPrismRippleWorker.probeWorkerWebGL2();
  const ctl1 = h1.sb.__agPrismHomeRippleHost.createHomeRippleController({
    rippleCore: h1.sb.__agCsRippleCore,
    isDestroyed: () => false,
    isAllowed: () => true,
    isConvAllowed: () => true,
    getConvLevel: () => 'full',
    isConvRunning: () => false,
    isDarkTheme: () => true,
    motionReduced: () => false,
    getMinFrameGapMs: () => 0,
    getAmbientIntensity: () => 1,
    getAccentTone: () => 'follow',
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
  });
  ctl1.sync();
  h1.clock.advance(20, 16);
  const m1 = ctl1.getMount();
  assert.equal(typeof h1.sb.__agPrismSimReady, 'function');

  // Hide before Channel 17 arrives: must stay legacy while hidden
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'runtime', 'ripple-field-sim-worker.js'), 'utf8'), h1.sb);
  h1.doc.hidden = true;
  h1.sb.__agPrismSimReady?.();
  assert.equal(m1.field.selfDriven, undefined, 'Hidden document must defer Channel 17 upgrade');

  // Unhide: visibilitychange must upgrade to selfDriven worker cleanly
  h1.doc.hidden = false;
  h1.doc.dispatchEvent('visibilitychange');
  h1.clock.advance(20, 16);
  assert.equal(m1.field.selfDriven, true, 'Unhiding must upgrade legacy mount to selfDriven');

  // Reattach must send pointerLeave to sim worker
  const simW1 = h1.createdWorkers.at(-1);
  const msgsBeforeRe = simW1.msgs.length;
  m1.reattach();
  assert.ok(simW1.msgs.slice(msgsBeforeRe).includes('pointerLeave'), 'reattach must clear stale worker pointer');

  // Unmount must clear global upgrade hook and mark mount parked
  ctl1.unmount();
  assert.equal(m1.parked, true);
  assert.equal(h1.sb.__agPrismSimReady, null, 'unmount must clear __agPrismSimReady');

  // P1 #2 & P1 #3: pre-ready singleton coalescing, releaseBackingStore queue reset, and real WaveField on non-sim fallback
  const posted = [];
  let readyState = false;
  let fakeHooks = null;
  const fakeChan = {
    state: () => ({ ready: readyState, failed: false, disposed: false, contextLost: false }),
    post: (m) => { posted.push(m); return true; },
    start: () => true,
    dispose: () => {},
  };
  const cvDummy = h1.doc.createElement('canvas');
  h1.html.appendChild(cvDummy);
  const simField = h1.sb.__agPrismRippleSim.mountSimField(cvDummy, 20, 10, {
    dpr: 1,
    rippleCore: h1.sb.__agCsRippleCore,
    getMinGap: () => 0,
    checkProbe: () => true,
    mkChan: (_ext, _o, hooks) => { fakeHooks = hooks; return fakeChan; },
  });
  for (let i = 0; i < 40; i += 1) simField.waves.disturb(1 + (i % 5), 2);
  simField.resize(30, 15, null, 1.5);
  simField.resize(40, 20, null, 2);
  simField.draw(0, { ambientIntensity: 0.5 }, false);
  simField.draw(0, { ambientIntensity: 0.8 }, false);
  simField.onPtr(10, 10, true, 100);
  simField.onPtr(0, 0, false, 104);
  simField.onPtr(20, 20, true, 108);
  simField.setPaused(true);
  simField.setPaused(false);
  simField.setPaused(true);
  readyState = true;
  fakeHooks.onReady();
  assert.equal(posted.filter((m) => m.type === 'disturb').length, 32, 'Burst events must cap at 32 while preserving singletons');
  assert.equal(posted.filter((m) => m.type === 'resize').length, 1);
  assert.equal(posted.find((m) => m.type === 'resize').cols, 40, 'Coalesced resize must keep latest cols');
  assert.equal(posted.filter((m) => m.type === 'state').length, 1);
  assert.equal(posted.find((m) => m.type === 'state').amb, 0.8, 'Coalesced state must keep latest state');
  const pIdx = posted.findIndex((m) => m.type === 'pointer');
  const plIdx = posted.findIndex((m) => m.type === 'pointerLeave');
  assert.ok(pIdx > plIdx && plIdx >= 0, 'Coalesced pointer after pointerLeave must preserve chronological order');
  assert.equal(posted[pIdx].t, 108, 'Pointer message must forward m.t timestamp');
  assert.equal(posted.filter((m) => m.type === 'sleep').length, 1);
  assert.equal(posted.findIndex((m) => m.type === 'sleep') > posted.findIndex((m) => m.type === 'resume'), true);

  // P1 #3 + P1 #2: async slept generation token ignores stale slept packet & idempotent setPaused(false) keeps gen in sync
  simField.waves.disturb(4, 4);
  const g1 = posted.at(-1).g;
  simField.waves.disturb(6, 6);
  const g2 = posted.at(-1).g;
  assert.ok(g2 > g1);
  simField.setPaused(false);
  fakeHooks.onSlept({ gen: g1 });
  assert.equal(simField.isSettled(), false, 'Stale slept packet must NOT mark newer wake settled');
  fakeHooks.onSlept({ gen: g2 });
  assert.equal(simField.isSettled(), true, 'Idempotent setPaused(false) must NOT desync matching generation slept settle');

  readyState = false;
  posted.length = 0;
  simField.resize(50, 25, null, 1);
  simField.releaseBackingStore();
  readyState = true;
  fakeHooks.onReady();
  assert.deepEqual(posted.map((m) => m.type), ['release'], 'releaseBackingStore must flush prior queue and send release');
  simField.dispose();

  const fbField = h1.sb.__agPrismRippleWorker.mountManagedField({
    getCanvas: () => h1.doc.createElement('canvas'),
    cols: 12,
    rows: 8,
    waves: null,
    rippleCore: h1.sb.__agCsRippleCore,
    allowWorker: false,
  });
  assert.ok(fbField.waves?.height instanceof Float32Array, 'Non-sim fallback must allocate Float32Array waves.height');
  fbField.dispose?.();

  // P1 #1/#2/#3, P2 #1/#2, Option A: clearAura zeroes wave cells, releaseBackingStore keeps settled state on 0x0 calls, throttled onPtr leaves sleep intact, cold-boot skips main createWaveField, home reattach refreshes intro, conv streaming stays active
  const h2 = createHarness({ withSim: true });
  await h2.sb.__agPrismRippleWorker.probeWorkerWebGL2();
  let waveAllocCount = 0;
  const origCwf = h2.sb.__agCsRippleCore.createWaveField;
  h2.sb.__agCsRippleCore.createWaveField = (...args) => { waveAllocCount += 1; return origCwf(...args); };
  let runningStream = true;
  const ctl2 = h2.sb.__agPrismHomeRippleHost.createHomeRippleController({
    rippleCore: h2.sb.__agCsRippleCore,
    isDestroyed: () => false,
    isAllowed: () => true,
    isConvAllowed: () => true,
    getConvLevel: () => 'full',
    isConvRunning: () => runningStream,
    isDarkTheme: () => true,
    motionReduced: () => false,
    getMinFrameGapMs: () => 0,
    getAmbientIntensity: () => 1,
    getAccentTone: () => 'follow',
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
  });
  ctl2.sync();
  h2.clock.advance(20, 16);
  const m2 = ctl2.getMount();
  assert.equal(waveAllocCount, 0, 'Cold-boot layout in sim mode must NOT allocate a redundant main-thread WaveField');
  const simOs2 = h2.offscreens.find((c) => c._gl.stats.createProgram > 0);
  const simW2 = h2.createdWorkers.at(-1);

  // Move pointer rapidly (<16ms apart, 10ms apart) while streaming=true -> both delivered & Option A keeps animating
  const ptrBefore = simW2.msgs.filter((t) => t === 'pointer').length;
  m2.field.onPtr(100, 100, true, h2.clock.now + 10);
  m2.field.onPtr(180, 100, true, h2.clock.now + 20);
  assert.equal(simW2.msgs.filter((t) => t === 'pointer').length - ptrBefore, 2, 'Dynamic lim (~4ms when unlocked) must not drop 10ms pointer moves');
  assert.equal(m2.sleeping, false, 'Option A: streaming must NOT force ripple sleep');

  // Advance 1 worker frame so skimmer wave & aura are drawn, then setPaused(true, true) -> must draw 1 frame with ZERO wave/prism & zero aura
  h2.workerClock.advance(20, 16);
  const drawsBeforeClr = simOs2._gl.stats.drawArrays;
  m2.field.setPaused(true, true);
  assert.equal(simOs2._gl.stats.drawArrays, drawsBeforeClr + 1, 'clearAura on sleep must redraw 1 clean frame');
  const cells = simOs2._gl.stats.lastCells;
  assert.ok(cells && cells.length > 0);
  for (let i = 0; i < cells.length; i += 4) {
    assert.equal(cells[i + 2], 0, 'clearAura sleep frame must zero wave highlight channel');
    assert.equal(cells[i + 3], 0, 'clearAura sleep frame must zero prism channel');
  }
  assert.equal(simOs2._gl.stats.uniforms.aura?.[3], 0, 'clearAura sleep frame must zero aura strength uniform');

  // Releasing backing store (0x0) + disturbing/draw/onPtr must stay settled with 0 worker rAF, then resize synchronously redraws 1 frame
  m2.field.releaseBackingStore();
  m2.waves.disturb(5, 5);
  m2.field.draw(0, { ambientIntensity: 1, conv: true }, false);
  assert.equal(m2.field.onPtr(120, 120, true, h2.clock.now + 40), false);
  h2.workerClock.advance(40, 16);
  assert.equal(h2.workerClock.rafs.size, 0, '0x0 released backing store must not spin worker rAF');
  assert.equal(m2.field.isSettled(), true, '0x0 calls must leave isSettled() === true');
  assert.equal(m2.waves.active(), false, '0x0 calls must leave waves.active() === false');

  const drawsBeforeRes = simOs2._gl.stats.drawArrays;
  m2.field.resize(40, 20, null, 1);
  assert.equal(simOs2._gl.stats.drawArrays, drawsBeforeRes + 1, 'resize after release must synchronously render 1 anti-flicker frame');
  assert.equal(h2.workerClock.rafs.size, 0, 'resize after release while still paused must keep 0 rAF spin');

  // Parked home -> reattach home refreshes intro animation window (mAt)
  const convHost = m2.host;
  convHost.setAttribute('data-ripple-mode', 'home');
  m2.field.draw(0, { ambientIntensity: 0.5, dark: true }, false);
  assert.ok(h2.workerClock.rafs.size > 0, 'Transition to home must trigger intro animation frames');
  h2.workerClock.advance(1700, 32);
  assert.equal(h2.workerClock.rafs.size, 0, 'Home intro must settle to sleep after 1600ms');
  m2.field.invalidate(true);
  m2.field.draw(0, { ambientIntensity: 0.5, dark: true }, false);
  assert.ok(h2.workerClock.rafs.size > 0, 'Reattaching parked home mount (invalidate(true)) must refresh worker intro');

  // When ambientIntensity <= 0.001 in conv mode and slept, pointer moves must NOT wake worker or keep unslp on throttle
  convHost.setAttribute('data-ripple-mode', 'conv');
  m2.field.draw(0, { ambientIntensity: 0, dark: true, conv: true }, false);
  h2.workerClock.advance(100, 32);
  assert.equal(m2.sleeping, true);
  assert.equal(m2.host.getAttribute('data-ripple-sleep'), '1');
  const msgsBeforeZeroPtr = simW2.msgs.length;
  m2.field.onPtr(50, 50, true, h2.clock.now + 80);
  assert.equal(simW2.msgs.length, msgsBeforeZeroPtr, 'Zero ambient + slept must suppress pointer wake messages');
  // P2 #1: Palette/ambient state change without invalidate() still repaints within the same 500ms tick
  m2.field.draw(0, { ambientIntensity: 1, dark: true, conv: true }, false);
  h2.workerClock.advance(40, 16);
  const drawsBeforePal = simOs2._gl.stats.drawArrays;
  m2.field.draw(0, { ambientIntensity: 0.5, dark: false, conv: true }, false);
  h2.workerClock.advance(20, 16);
  assert.ok(simOs2._gl.stats.drawArrays > drawsBeforePal, 'Palette change without invalidate() must force worker repaint');

  // End-to-end host pointermove throttling (P2 #2): throttled move returns false and preserves data-ripple-sleep="1"
  h2.doc.querySelector = (s) => (s === '.agy-home' ? h2.seat : null);
  ctl2.sync();
  h2.clock.advance(32, 16);
  for (let t = 0; t < 2500 && !m2.sleeping; t += 32) { h2.clock.advance(32, 32); h2.workerClock.advance(32, 32); }
  assert.equal(m2.host.getAttribute('data-ripple-sleep'), '1');
  h2.clock.now += 20;
  h2.seat.dispatchEvent('pointermove', { clientX: 60, clientY: 60, target: h2.seat });
  assert.equal(m2.sleeping, false, 'Unthrottled pointermove must clear sleep');
  m2.sleeping = true;
  m2.host.setAttribute('data-ripple-sleep', '1');
  h2.clock.now += 2;
  h2.seat.dispatchEvent('pointermove', { clientX: 61, clientY: 61, target: h2.seat });
  assert.equal(m2.sleeping, true, 'Throttled host pointermove must NOT clear sleeping');
  assert.equal(m2.host.getAttribute('data-ripple-sleep'), '1', 'Throttled host pointermove must preserve data-ripple-sleep="1"');

  ctl2.unmount();
});

test('P2 boundaries: minified Channel 17 exec & hot-reload, blur clearAura, onVis unslp, target-fps sync, onPtr clock, tide reach reset & init-timeout fallback size', async () => {
  const h = createHarness({ withSim: false });
  h.doc.title = 'Antigravity';
  await h.sb.__agPrismRippleWorker.probeWorkerWebGL2();

  let minGap = 0;
  h.doc.querySelector = (s) => (s === '.agy-home' ? h.seat : null);
  const ctl = h.sb.__agPrismHomeRippleHost.createHomeRippleController({
    rippleCore: h.sb.__agCsRippleCore,
    isDestroyed: () => false,
    isAllowed: () => true,
    isConvAllowed: () => true,
    getConvLevel: () => 'full',
    isDarkTheme: () => true,
    motionReduced: () => false,
    getMinFrameGapMs: () => minGap,
    getAmbientIntensity: () => 1,
    getAccentTone: () => 'follow',
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
  });

  ctl.sync();
  h.clock.advance(20, 16);
  const m = ctl.getMount();
  assert.equal(m.field.selfDriven, undefined);

  // P2-8 + P2-6: Execute real minified Channel 17 expression in VM, verify reuse vs hot-reload
  const minExpr = cdp.buildRippleSimChannelExpression({ ...cdp.DEFAULT_CONFIG }, { noDiskCache: true });
  const r1 = vm.runInNewContext(minExpr, h.sb);
  assert.equal(r1.status, 'mounted');
  assert.equal(typeof h.sb.__agPrismRippleSim?.mountSimField, 'function');
  assert.doesNotThrow(() => new vm.Script(h.sb.__agPrismRippleSim.WORKER_SIM_SRC));
  assert.equal(m.field.selfDriven, true, 'Minified Channel 17 must upgrade legacy mount to selfDriven');

  const simCv1 = m.canvas;
  const simW1 = h.createdWorkers.at(-1);
  const simOs1 = h.offscreens.at(-1);

  // Same hash reuse calls __agPrismSimReady?.() without true -> keeps existing sim worker
  const r2 = vm.runInNewContext(minExpr, h.sb);
  assert.equal(r2.reused, true);
  assert.equal(m.canvas, simCv1, 'Same-hash reuse must NOT rebuild active sim worker');
  assert.equal(simW1.terminated, false);

  // Hash change hot-reloads active sim worker cleanly
  h.sb.__agPrismRippleSim.__prismCodeHash = 'stale-hash';
  const r3 = vm.runInNewContext(minExpr, h.sb);
  assert.equal(r3.status, 'mounted');
  assert.notEqual(m.canvas, simCv1, 'Hot reload with changed hash must swap canvas and remount sim');
  assert.equal(simW1.terminated, true, 'Hot reload must terminate previous sim worker');
  assert.equal(m.field.selfDriven, true);

  const simW2 = h.createdWorkers.at(-1);
  const simOs2 = h.offscreens.at(-1);

  // P2-1: blur pauses with clearAura=true -> zeros worker aura and wave/prism channels
  h.clock.now += 20;
  h.seat.dispatchEvent('pointermove', { clientX: 120, clientY: 120, target: h.seat });
  h.workerClock.advance(30, 16);
  const rawBeforeBlur = simW2.rawMsgs.length;
  h.dispatchWin('blur');
  const slpMsg = simW2.rawMsgs.slice(rawBeforeBlur).find((x) => x?.type === 'sleep');
  assert.equal(slpMsg?.clearAura, true, 'Blur pause must pass clearAura: true to sim worker');
  assert.equal(simOs2._gl.stats.uniforms.aura?.[3], 0, 'Blur pause must zero uploaded aura uniform');
  assert.ok(simOs2._gl.stats.lastCells && simOs2._gl.stats.lastCells.every((_, idx, a) => (idx % 4 < 2) || a[idx] === 0));
  assert.equal(m.host.getAttribute('data-ripple-sleep'), '1');

  // P2-4: hide (shrinks buffer) -> unhide + focus fast-path must clear data-ripple-sleep
  h.doc.hidden = true;
  h.doc.dispatchEvent('visibilitychange');
  h.doc.hidden = false;
  h.dispatchWin('focus');
  assert.notEqual(m.host.getAttribute('data-ripple-sleep'), '1', 'onVis fast-path wake must clear data-ripple-sleep');
  assert.equal(m.sleeping, false);

  // P2-5 (strict filter check): settle intro first so no background rAF masks observer filtering
  h.clock.advance(1700, 100);
  assert.equal(h.clock.rafs.size, 0, 'Main thread must be idle after intro finishes');
  minGap = 16;
  const rawBeforeFps = simW2.rawMsgs.length;
  h.fireAttr('data-unrelated-attr');
  h.clock.advance(20, 16);
  assert.equal(simW2.rawMsgs.slice(rawBeforeFps).some((x) => x?.type === 'state' && x.mg === 16), false, 'Unrelated attribute must NOT pass MutationObserver filter');
  h.fireAttr('data-ag-cs-target-fps');
  h.clock.advance(20, 16);
  assert.ok(simW2.rawMsgs.slice(rawBeforeFps).some((x) => x?.type === 'state' && x.mg === 16), 'target-fps attribute change must push updated mg to worker');

  // P2-9: onPtr omitting 4th arg defaults to performance.now(), not Date.now()
  h.clock.now = 5000;
  m.field.onPtr(10, 10, true);
  h.clock.now = 5025;
  assert.equal(m.field.onPtr(20, 20, true, h.clock.now), true, 'Omitting onPtr nowMs must use performance.now() clock domain');

  // P2-10: Tide swell followed by conv switch and return to home resets st.aura.reach to 0.47
  ctl.triggerTideSwell();
  assert.equal(m.aura.reach, 0.2);
  h.doc.querySelector = () => null;
  ctl.sync();
  h.doc.querySelector = (s) => (s === '.agy-home' ? h.seat : null);
  ctl.sync();
  h.clock.advance(20, 16);
  assert.equal(m.aura.reach, 0.47, 'Returning from conv mode must reset tide st.aura.reach to 0.47');
  assert.equal(m.aura.strength, 1);

  // Hidden-window Channel 17 hash change: deferred until window becomes visible again
  h.doc.hidden = true;
  h.doc.dispatchEvent('visibilitychange');
  const simCvBeforeHide = m.canvas;
  const simWBeforeHide = h.createdWorkers.findLast((w) => w.rawMsgs.some((x) => x?.type === 'init' && x.mode !== 'glow'));
  assert.ok(simWBeforeHide && !simWBeforeHide.terminated);
  h.sb.__agPrismRippleSim.__prismCodeHash = 'stale-hidden-hash';
  const rHidden = vm.runInNewContext(minExpr, h.sb);
  assert.equal(rHidden.status, 'mounted');
  assert.equal(m.canvas, simCvBeforeHide, 'Hidden window must defer sim hot-reload without swapping while hidden');
  assert.equal(simWBeforeHide.terminated, false);
  h.doc.hidden = false;
  h.doc.dispatchEvent('visibilitychange');
  assert.notEqual(m.canvas, simCvBeforeHide, 'Deferred sim hot-reload must execute as soon as window becomes visible');
  assert.equal(simWBeforeHide.terminated, true);
  assert.equal(m.field.selfDriven, true);

  // P2-2: Async init-timeout worker fallback sets fallback canvas width/height to real pw x ph (not 300x150)
  h.setDropInit(true);
  h.sb.__agPrismSimReady?.(true);
  h.clock.advance(850, 32);
  assert.equal(m.field.selfDriven, undefined, 'init-timeout must fall back to main-thread renderer');
  assert.equal(m.canvas.width, 700, 'Async fallback canvas width must match real container pw (700, not 300)');
  assert.equal(m.canvas.height, 450, 'Async fallback canvas height must match real container ph (450, not 150)');
  assert.ok(simOs1);

  ctl.unmount();

  // Same-hash reuse (and hot check) when probe failed must NOT interrupt main-thread webgl2 fallback canvas
  const hFb = createHarness({ withSim: true });
  hFb.doc.title = 'Antigravity';
  const OrigOff = hFb.sb.OffscreenCanvas;
  hFb.sb.OffscreenCanvas = class { getContext() { return null; } };
  await hFb.sb.__agPrismRippleWorker.probeWorkerWebGL2();
  hFb.sb.OffscreenCanvas = OrigOff;
  assert.equal(hFb.sb.__agPrismRippleWorker.getProbeStatus().ok, false);
  hFb.doc.querySelector = (s) => (s === '.agy-home' ? hFb.seat : null);
  const ctlFb = hFb.sb.__agPrismHomeRippleHost.createHomeRippleController({
    rippleCore: hFb.sb.__agCsRippleCore,
    isDestroyed: () => false,
    isAllowed: () => true,
    isConvAllowed: () => true,
    getConvLevel: () => 'full',
    isDarkTheme: () => true,
    motionReduced: () => false,
    getMinFrameGapMs: () => 0,
    getAmbientIntensity: () => 1,
    getAccentTone: () => 'follow',
    setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
  });
  ctlFb.sync();
  hFb.clock.advance(20, 16);
  const mFb = ctlFb.getMount();
  assert.equal(mFb.field.mode, 'webgl2');
  assert.equal(mFb.field.selfDriven, undefined);
  const fbCv = mFb.canvas;
  const rFb1 = vm.runInNewContext(minExpr, hFb.sb);
  assert.equal(rFb1.status, 'mounted');
  assert.equal(mFb.canvas, fbCv, 'Channel 17 mount with failed probe must NOT tear down main-thread webgl2 fallback canvas');
  const rFb2 = vm.runInNewContext(minExpr, hFb.sb);
  assert.equal(rFb2.reused, true);
  assert.equal(mFb.canvas, fbCv, 'Same-hash reuse must NOT interrupt main-thread webgl2 fallback canvas');
  ctlFb.unmount();
});
