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

const rippleCore = require(path.join(ROOT, 'ripple-core.js'));

test('165Hz beat-frequency aliasing fix: nebulaFrameMs <= 30 keeps every 36.36ms WebGL2 idle frame uploading smoothly', () => {
  assert.ok(
    rippleCore.RIPPLE.nebulaFrameMs > 15 && rippleCore.RIPPLE.nebulaFrameMs <= 30,
    `Expected nebulaFrameMs in (15, 30], got ${rippleCore.RIPPLE.nebulaFrameMs}`
  );

  let uploads = 0;
  const gl = {
    VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632, COMPILE_STATUS: 35713, LINK_STATUS: 35714,
    COLOR_BUFFER_BIT: 16384, TRIANGLES: 4, TEXTURE_2D: 3553, TEXTURE0: 33984, TEXTURE1: 33985,
    RGBA: 6408, RGBA8: 32856, UNSIGNED_BYTE: 5121, LINEAR: 9729, NEAREST: 9728, CLAMP_TO_EDGE: 33071,
    TEXTURE_MIN_FILTER: 10241, TEXTURE_MAG_FILTER: 10240, TEXTURE_WRAP_S: 10242, TEXTURE_WRAP_T: 10243,
    isContextLost: () => false,
    createShader: () => ({}), shaderSource() {}, compileShader() {}, getShaderParameter: () => true,
    getShaderInfoLog: () => '', deleteShader() {}, createProgram: () => ({}), attachShader() {},
    linkProgram() {}, getProgramParameter: () => true, getProgramInfoLog: () => '', useProgram() {},
    deleteProgram() {}, getUniformLocation: (_p, n) => ({ n }), createTexture: () => ({}),
    deleteTexture() {}, activeTexture() {}, bindTexture() {}, texParameteri() {}, texStorage2D() {},
    texImage2D() {}, texSubImage2D() { uploads += 1; }, viewport() {},
    uniform1i() {}, uniform1f() {}, uniform2f() {}, uniform3f() {}, uniform4f() {},
    clearColor() {}, clear() {}, drawArrays() {}, getExtension: () => null,
  };
  const atlasCtx = { setTransform() {}, clearRect() {}, fillText() {}, font: '', fillStyle: '', textAlign: '', textBaseline: '' };
  const canvas = {
    width: 280, height: 150,
    ownerDocument: { hidden: false, createElement: () => ({ width: 1, height: 1, getContext: () => atlasCtx }) },
    getContext: (t) => (t === 'webgl2' ? gl : null),
  };
  const waves = rippleCore.createWaveField(40, 10, () => 0.5);
  const field = rippleCore.createGlyphField(canvas, 40, 10, waves);
  assert.equal(field.mode, 'webgl2');

  const pal = { dark: true, ink: [146, 148, 156], wave: [214, 218, 228], aura: null };
  let t = 1000;
  field.draw(t, pal, false);
  const baseUploads = uploads;
  for (let i = 0; i < 10; i++) {
    t += 36.36;
    field.draw(t, pal, false);
  }
  assert.equal(uploads - baseUploads, 10, 'Every 36.36ms frame at 165Hz must upload without beat-frequency frame skipping');
  field.dispose();
});

test('mountBrandHorizonGlow honors explicit { width: 0, height: 0 } without reading clientWidth/clientHeight', () => {
  let layoutReads = 0;
  const cv = {
    width: 0, height: 0,
    get clientWidth() { layoutReads++; return 800; },
    get clientHeight() { layoutReads++; return 400; },
    getContext: () => null,
  };
  const glow = rippleCore.mountBrandHorizonGlow(cv, { width: 0, height: 0 });
  assert.equal(layoutReads, 0, 'mountBrandHorizonGlow must not read clientWidth/clientHeight when explicit 0 dimensions are passed');
  glow.dispose();
});

test('home-ripple-host pause-safe clock prevents time-teleport on wake and smoothly fades cursor aura before 0fps sleep', () => {
  const src = fs.readFileSync(path.join(ROOT, 'home-ripple-host.js'), 'utf8');
  let now = 5000;
  let rafSeq = 1;
  const rafs = new Map();
  const fieldTimestamps = [];
  const auraStrengths = [];
  const glowTimestamps = [];

  const fakeCanvas = {
    width: 1280, height: 720, style: {}, isConnected: true,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    getContext: () => null, setAttribute() {},
  };
  const fakeHome = {
    isConnected: true, style: {}, clientWidth: 1280, clientHeight: 720,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    insertBefore() {}, appendChild() {}, addEventListener() {}, removeEventListener() {},
    querySelector: () => null, setAttribute() {}, removeAttribute() {},
  };
  const makeHostEl = () => {
    const attrs = new Map();
    return {
      style: {}, isConnected: true, className: '', children: [],
      setAttribute(k, v) { attrs.set(k, String(v)); },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      hasAttribute(k) { return attrs.has(k); },
      removeAttribute(k) { attrs.delete(k); },
      appendChild(c) { this.children.push(c); return c; },
      insertBefore(c) { this.children.unshift(c); return c; },
      remove() { this.isConnected = false; },
    };
  };
  const fakeDoc = {
    hidden: false,
    documentElement: { getAttribute: () => 'obsidian', classList: { contains: () => false } },
    body: { classList: { contains: () => false } },
    createElement(tag) { return tag === 'canvas' ? { ...fakeCanvas } : makeHostEl(); },
    querySelector: (sel) => (sel.includes('agy-home') ? fakeHome : null),
    querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
  };
  const sb = {
    window: null, document: fakeDoc, performance: { now: () => now },
    requestAnimationFrame(cb) { const id = rafSeq++; rafs.set(id, cb); return id; },
    cancelAnimationFrame(id) { rafs.delete(id); },
    getComputedStyle: () => ({ color: 'rgb(220,220,220)', backgroundColor: 'rgb(14,15,20)', fontFamily: 'monospace', getPropertyValue: () => '' }),
    ResizeObserver: class { observe() {} disconnect() {} },
    setTimeout: () => 0, clearTimeout() {}, Math, Number, String, Boolean, Array, Object, Map, Set,
  };
  sb.window = sb; sb.globalThis = sb;
  vm.runInNewContext(src, sb);

  const ctl = sb.__agPrismHomeRippleHost.createHomeRippleController({
    rippleCore: {
      RIPPLE: { cellWidth: 16, cellHeight: 24 },
      parseCssColorToRgb: () => null,
      createWaveField: () => ({ advance() {}, active: () => false, disturb() {}, skimmer() {}, clear() {} }),
      createGlyphField: () => ({
        mode: 'webgl2', busy: () => false, needsDraw: () => false,
        draw(ts, pal) { fieldTimestamps.push(ts); auraStrengths.push(pal?.aura?.strength ?? 0); },
        invalidate() {}, setCalmZones() {}, dispose() {},
      }),
      mountBrandHorizonGlow: () => ({
        mode: 'webgl2', resize() {},
        draw(ts) { glowTimestamps.push(ts); },
        clear() {}, invalidate() {}, dispose() {},
      }),
    },
    isDestroyed: () => false, isAllowed: () => true, isDarkTheme: () => true, motionReduced: () => false,
    getMinFrameGapMs: () => 0, getAmbientIntensity: () => 1, getAccentTone: () => 'cobalt',
    setAttrIfChanged() {}, onPointerPressMascot() {},
  });

  const flush = () => {
    const cbs = [...rafs.values()];
    rafs.clear();
    for (const cb of cbs) cb(now);
  };

  ctl.sync(fakeHome);
  flush();
  now = 8000;
  ctl.getMount().onMove({ clientX: 400, clientY: 300, pointerType: 'mouse' });
  for (let i = 0; i < 80; i++) {
    now += 16.67;
    flush();
  }
  assert.equal(ctl.getMount().sleeping, true, 'Must sleep after 1200ms stationary pointer');
  assert.equal(auraStrengths[auraStrengths.length - 1], 0, 'Final resting frame before sleep must fade cursor aura smoothly to 0');
  assert.equal(auraStrengths.some((s) => s > 0.05 && s < 0.95), true, 'Cursor aura must fade smoothly instead of hard-snapping off');

  const tsBeforeSleep = fieldTimestamps[fieldTimestamps.length - 1];
  const glowBeforeSleep = glowTimestamps[glowTimestamps.length - 1];

  now += 12000;
  ctl.getMount().onMove({ clientX: 440, clientY: 320, pointerType: 'mouse' });
  now += 16;
  flush();

  const tsAfterWake = fieldTimestamps[fieldTimestamps.length - 1];
  const glowAfterWake = glowTimestamps[glowTimestamps.length - 1];
  assert.ok(tsAfterWake - tsBeforeSleep <= 20, `Glyph field animation clock must not teleport on wake (delta=${tsAfterWake - tsBeforeSleep}ms)`);
  assert.ok(glowAfterWake - glowBeforeSleep <= 20, `Horizon glow animation clock must not teleport on wake (delta=${glowAfterWake - glowBeforeSleep}ms)`);
  ctl.unmount();
});

test('sidebar resize flicker fix (#97): WebGL2 preserves drawing buffer, home-ripple-host debounces continuous resize and repaints same-frame', () => {
  // 1) Verify both WebGL2 contexts request preserveDrawingBuffer: true
  const glyphCtxOpts = [];
  const glowCtxOpts = [];
  const fakeGl = {
    VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632, COMPILE_STATUS: 35713, LINK_STATUS: 35714,
    COLOR_BUFFER_BIT: 16384, TRIANGLES: 4, TEXTURE_2D: 3553, TEXTURE0: 33984, TEXTURE1: 33985,
    RGBA: 6408, RGBA8: 32856, UNSIGNED_BYTE: 5121, LINEAR: 9729, NEAREST: 9728, CLAMP_TO_EDGE: 33071,
    TEXTURE_MIN_FILTER: 10241, TEXTURE_MAG_FILTER: 10240, TEXTURE_WRAP_S: 10242, TEXTURE_WRAP_T: 10243,
    isContextLost: () => false,
    createShader: () => ({}), shaderSource() {}, compileShader() {}, getShaderParameter: () => true,
    getShaderInfoLog: () => '', deleteShader() {}, createProgram: () => ({}), attachShader() {},
    linkProgram() {}, getProgramParameter: () => true, getProgramInfoLog: () => '', useProgram() {},
    deleteProgram() {}, getUniformLocation: (_p, n) => ({ n }), createTexture: () => ({}),
    deleteTexture() {}, activeTexture() {}, bindTexture() {}, texParameteri() {}, texStorage2D() {},
    texImage2D() {}, texSubImage2D() {}, viewport() {},
    uniform1i() {}, uniform1f() {}, uniform2f() {}, uniform3f() {}, uniform4f() {},
    clearColor() {}, clear() {}, drawArrays() {}, getExtension: () => null,
  };
  const atlasCtx = { setTransform() {}, clearRect() {}, fillText() {}, font: '', fillStyle: '', textAlign: '', textBaseline: '' };
  const glyphCv = {
    width: 160, height: 120,
    ownerDocument: { hidden: false, createElement: () => ({ width: 1, height: 1, getContext: () => atlasCtx }) },
    getContext: (t, opts) => { if (t === 'webgl2') { glyphCtxOpts.push(opts); return fakeGl; } return null; },
  };
  const glowCv = {
    width: 160, height: 120,
    ownerDocument: { hidden: false },
    getContext: (t, opts) => { if (t === 'webgl2') { glowCtxOpts.push(opts); return fakeGl; } return null; },
  };
  const waves = rippleCore.createWaveField(10, 5, () => 0.5);
  const f = rippleCore.createGlyphField(glyphCv, 10, 5, waves);
  const g = rippleCore.mountBrandHorizonGlow(glowCv, { width: 160, height: 120 });
  assert.equal(glyphCtxOpts[0]?.preserveDrawingBuffer, true, 'Glyph WebGL2 context must enable preserveDrawingBuffer');
  assert.equal(glowCtxOpts[0]?.preserveDrawingBuffer, true, 'Brand horizon glow WebGL2 context must enable preserveDrawingBuffer');
  f.dispose();
  g.dispose();

  // 2) Verify home-ripple-host same-frame repaint on resize/reattach + 120ms debounce on continuous sidebar animation
  const src = fs.readFileSync(path.join(ROOT, 'home-ripple-host.js'), 'utf8');
  let now = 5000;
  let rafSeq = 1;
  let tmSeq = 1;
  const rafs = new Map();
  const timers = new Map();
  let fieldCreates = 0;
  let fieldDraws = 0;
  let glowDraws = 0;
  let roCb = null;
  let htmlResizing = null;

  const makeHostEl = () => {
    const attrs = new Map();
    return {
      style: {}, isConnected: true, className: '', children: [],
      setAttribute(k, v) { attrs.set(k, String(v)); },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      hasAttribute(k) { return attrs.has(k); },
      removeAttribute(k) { attrs.delete(k); },
      appendChild(c) { this.children.push(c); return c; },
      insertBefore(c) { this.children.unshift(c); return c; },
      remove() { this.isConnected = false; },
    };
  };
  const fakeHome = {
    isConnected: true, style: {}, clientWidth: 1000, clientHeight: 700,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: fakeHome.clientWidth, height: fakeHome.clientHeight }),
    insertBefore() {}, appendChild() {}, addEventListener() {}, removeEventListener() {},
    querySelector: () => null, setAttribute() {}, removeAttribute() {},
  };
  const fakeDoc = {
    hidden: false,
    documentElement: {
      getAttribute: (k) => (k === 'data-ag-cs-resizing' ? htmlResizing : 'obsidian'),
      classList: { contains: () => false },
    },
    body: { classList: { contains: () => false } },
    createElement(tag) {
      if (tag === 'canvas') {
        return {
          width: 0, height: 0, style: {}, isConnected: true,
          getBoundingClientRect: () => ({ left: 0, top: 0, width: fakeHome.clientWidth, height: fakeHome.clientHeight }),
          getContext: () => null, setAttribute() {}, remove() {},
        };
      }
      return makeHostEl();
    },
    querySelector: (sel) => (sel.includes('agy-home') ? fakeHome : null),
    querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
  };
  const sb = {
    window: null, document: fakeDoc, performance: { now: () => now },
    requestAnimationFrame(cb) { const id = rafSeq++; rafs.set(id, cb); return id; },
    cancelAnimationFrame(id) { rafs.delete(id); },
    setTimeout(cb, ms) { const id = tmSeq++; timers.set(id, { cb, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    getComputedStyle: () => ({ color: 'rgb(220,220,220)', backgroundColor: 'rgb(14,15,20)', fontFamily: 'monospace', getPropertyValue: () => '' }),
    ResizeObserver: class { constructor(cb) { roCb = cb; } observe() {} disconnect() {} },
    Math, Number, String, Boolean, Array, Object, Map, Set,
  };
  sb.window = sb; sb.globalThis = sb;
  vm.runInNewContext(src, sb);

  const ctl = sb.__agPrismHomeRippleHost.createHomeRippleController({
    rippleCore: {
      RIPPLE: { cellWidth: 16, cellHeight: 24 },
      parseCssColorToRgb: () => null,
      createWaveField: () => ({ advance() {}, active: () => false, disturb() {}, skimmer() {}, clear() {} }),
      createGlyphField: () => {
        fieldCreates += 1;
        return {
          mode: 'webgl2', busy: () => false, needsDraw: () => false,
          draw() { fieldDraws += 1; }, invalidate() {}, setCalmZones() {}, dispose() {},
        };
      },
      mountBrandHorizonGlow: () => ({
        mode: 'webgl2', resize() {}, draw() { glowDraws += 1; }, clear() {}, invalidate() {}, dispose() {},
      }),
    },
    isDestroyed: () => false, isAllowed: () => true, isDarkTheme: () => false, motionReduced: () => false,
    getMinFrameGapMs: () => 0, getAmbientIntensity: () => 1, getAccentTone: () => 'follow',
    setAttrIfChanged() {}, onPointerPressMascot() {},
  });

  const flushRafs = () => {
    const entries = [...rafs.entries()];
    rafs.clear();
    for (const [, cb] of entries) cb(now);
  };

  ctl.sync();
  flushRafs();
  // Advance past intro so mount enters 0fps idle sleep
  now += 2000;
  flushRafs();
  assert.equal(ctl.getMount().sleeping, true, 'Mount should settle to idle sleep before resize test');

  // Single resize: must layout and synchronously repaint in the same rAF (0 blank frames)
  const drawsBeforeSingle = fieldDraws;
  const glowBeforeSingle = glowDraws;
  const createsBeforeSingle = fieldCreates;
  fakeHome.clientWidth = 880;
  roCb([]);
  flushRafs();
  assert.equal(fieldCreates, createsBeforeSingle + 1, 'First resize must layout once');
  assert.equal(fieldDraws, drawsBeforeSingle + 1, 'First resize must repaint glyph field in the same frame');
  assert.equal(glowDraws, glowBeforeSingle + 1, 'First resize must repaint horizon glow in the same frame');

  // Continuous sidebar transition ticks within 180ms burst window: must debounce without recreating WebGL2 per frame
  const createsBeforeBurst = fieldCreates;
  const drawsBeforeBurst = fieldDraws;
  for (const w of [860, 840, 820, 800]) {
    now += 16;
    fakeHome.clientWidth = w;
    roCb([]);
    flushRafs();
  }
  assert.equal(fieldCreates, createsBeforeBurst, 'Continuous sidebar transition must defer WebGL2 field recreation');
  assert.equal(fieldDraws, drawsBeforeBurst, 'Deferred transition ticks must not flash/redraw mid-burst');
  assert.equal(timers.size, 1, 'Debounced resize must schedule trailing 120ms flush timer');

  // Trailing debounce fires -> single layout + synchronous same-frame repaint
  now += 120;
  const pendingTimers = [...timers.values()];
  timers.clear();
  for (const t of pendingTimers) t.cb();
  assert.equal(fieldCreates, createsBeforeBurst + 1, 'Trailing debounce must rebuild field exactly once');
  assert.equal(fieldDraws, drawsBeforeBurst + 1, 'Trailing debounce must repaint synchronously in the same frame');

  // Park & reattach must also repaint synchronously without waiting an extra frame
  ctl.park();
  const drawsBeforeReattach = fieldDraws;
  const glowBeforeReattach = glowDraws;
  ctl.sync();
  assert.equal(fieldDraws, drawsBeforeReattach + 1, 'Reattach from parked state must repaint glyph field synchronously');
  assert.equal(glowDraws, glowBeforeReattach + 1, 'Reattach from parked state must repaint horizon glow synchronously');
  ctl.unmount();
});
