import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
const rippleCore = require(path.join(ROOT, 'ripple-core.js'));
require(path.join(ROOT, 'conv-aura.js'));
const convAuraMod = globalThis.__agPrismConvAura;
const cdp = require(path.join(ROOT, 'cdp.js'));
const settingsPanel = require(path.join(ROOT, 'settings-panel.js'));
const i18nExt = require(path.join(ROOT, 'src/runtime/i18n-ext-beta4.js'));
import { createSettingsMiniDom } from './helpers/mini-dom.mjs';

test('HORIZON_FRAGMENT_SHADER uses highp gradient/linear-light blend and 3-channel TPDF dither', () => {
  const fs = rippleCore.HORIZON_FRAGMENT_SHADER;
  assert.ok(fs.includes('precision mediump float;'));
  assert.ok(fs.includes('highp vec3 lmix('), 'linear-light blend prevents dark violet-blue midpoint dip');
  assert.ok(fs.includes('if(uPre1.x>.5){'), 'silky mist horizon branch eliminates conversation rainbow stripes & halftone bands');
  assert.ok(fs.includes('highp vec3 d3=vec3('), '3-channel decorrelated TPDF dither breaks color steps');
  const huMist = rippleCore.computeHorizonUniforms(true, 1, 0.5, 0, 1, 0, 0, 1);
  const huHome = rippleCore.computeHorizonUniforms(true, 1, 0.5, 0, 1, 0, 0, 0);
  assert.equal(huMist.pre1[0], 1, 'mist flag activates silky mist horizon path');
  assert.equal(huHome.pre1[0], 0, 'home path leaves mist flag off');
});

test('convAura modes (breathe / static / off) control continuous flow, single-frame sleep, and unmount', () => {
  const dom = createSettingsMiniDom();
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const prevRaf = globalThis.requestAnimationFrame;
  const prevCaf = globalThis.cancelAnimationFrame;
  dom.doc.addEventListener = () => {};
  dom.doc.removeEventListener = () => {};
  globalThis.document = dom.doc;
  globalThis.window = { devicePixelRatio: 2, addEventListener() {}, removeEventListener() {} };
  let rafId = 0;
  globalThis.requestAnimationFrame = () => ++rafId;
  globalThis.cancelAnimationFrame = () => {};
  try {
    const seat = dom.doc.createElement('div');
    seat.clientWidth = 800; seat.clientHeight = 600;
    seat.insertBefore = (n) => { seat.appendChild(n); return n; };
    const origCreate = dom.doc.createElement.bind(dom.doc);
    dom.doc.createElement = (tag) => {
      const el = origCreate(tag);
      el.style = el.style || {};
      el.style.setProperty = (k, v) => { el.style[k] = v; };
      return el;
    };
    const view = dom.doc.createElement('div');
    view.setAttribute('data-testid', 'conversation-view');
    view.clientWidth = 800; view.clientHeight = 600;
    seat.appendChild(view);
    dom.doc.body.appendChild(seat);

    let mode = 'breathe';
    const ctl = convAuraMod.createConvAuraController({
      isDestroyed: () => false,
      isHomeRippleEnabled: () => mode !== 'off',
      getConvAuraMode: () => mode,
      isMotionStandardOrUltra: () => true,
      isDarkTheme: () => true,
      getMinFrameGapMs: () => 16,
      getAmbientIntensity: () => 1,
      getSpectrumMode: () => 'follow',
      isWindowFocused: () => true,
      rippleCore: {
        mountBrandHorizonGlow: () => ({ mode: 'webgl2', resize() {}, clear() {}, draw() {}, drawStaticSnapshot() {}, dispose() {}, invalidate() {} }),
      },
      setAttrIfChanged: (el, k, v) => el.setAttribute(k, v),
      runGuardedMut: (fn) => fn(),
    });
    ctl.sync();
    const inst = ctl.getInstance();
    assert.ok(inst, 'breathe mode mounts conv-aura');
    assert.equal(inst.sleeping, false, 'breathe mode stays alive without 1.2s freeze');
    assert.equal(inst.dpr, 1.5, 'balanced DPR cap stays crisp at 1.5x on 2x display');

    mode = 'static';
    ctl.sync();
    assert.equal(inst.sleeping, true, 'static mode draws single frame and enters 0fps sleep');
    assert.equal(inst.sleepReason, 'aura-static');

    mode = 'off';
    ctl.sync();
    assert.equal(ctl.getInstance(), null, 'off mode unmounts conv-aura completely');
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
    globalThis.requestAnimationFrame = prevRaf;
    globalThis.cancelAnimationFrame = prevCaf;
  }
});

test('convAura schema & 9-locale i18n are aligned with 0 CJK leaks', () => {
  assert.ok(cdp.CONFIG_SCHEMA.convAura && settingsPanel.PRISM_SETTINGS_SCHEMA.convAura);
  const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/;
  for (const loc of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'tr']) {
    const s = i18nExt.getStrings(loc);
    for (const k of ['setConvAuraTitle', 'setConvAuraDesc', 'optConvAuraBreathe', 'optConvAuraStatic', 'optConvAuraOff']) {
      assert.ok(typeof s[k] === 'string' && s[k].trim().length > 0, `Missing ${k} for ${loc}`);
      if (!['zh-CN', 'zh-TW', 'ja'].includes(loc)) assert.equal(CJK_RE.test(s[k]), false);
    }
  }
});
