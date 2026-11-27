// prism-rim-canvas 模块域单测：问答卡全周棱镜边缘光 vs 排队卡底边反射
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const { createPrismRimCanvasController } = require(path.join(ROOT, 'prism-rim-canvas.js'));

function createMockRimDom() {
  const attrsOf = new WeakMap();
  const makeStyle = () => {
    const map = new Map();
    return {
      setProperty(k, v) { map.set(k, String(v)); },
      getPropertyValue(k) { return map.get(k) || ''; },
      removeProperty(k) { map.delete(k); },
    };
  };
  const makeCtx = () => {
    const ops = [];
    return {
      ops,
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      lineWidth: 1,
      strokeStyle: '',
      fillStyle: '',
      clearRect(...a) { ops.push(['clearRect', ...a]); },
      beginPath() {},
      moveTo() {},
      arcTo() {},
      closePath() {},
      save() { ops.push(['save']); },
      restore() { ops.push(['restore']); },
      clip() { ops.push(['clip']); },
      translate(...a) { ops.push(['translate', ...a]); },
      fillRect(...a) { ops.push(['fillRect', ...a]); },
      stroke() { ops.push(['stroke', this.lineWidth, this.globalAlpha, this.globalCompositeOperation]); },
      createRadialGradient(...a) {
        ops.push(['radial', ...a]);
        return { addColorStop() {} };
      },
      createLinearGradient(...a) {
        ops.push(['linear', ...a]);
        return { addColorStop() {} };
      },
    };
  };
  const boxes = [];
  const makeEl = (tag, attrs = {}, rect = { left: 100, top: 200, width: 400, height: 120, right: 500, bottom: 320 }) => {
    const am = new Map(Object.entries(attrs));
    const cls = new Set(String(attrs.class || '').split(/\s+/).filter(Boolean));
    const kids = [];
    const ctx = tag === 'canvas' ? makeCtx() : null;
    const el = {
      tagName: tag.toUpperCase(),
      nodeType: 1,
      isConnected: true,
      width: 0,
      height: 0,
      style: makeStyle(),
      children: kids,
      parentElement: null,
      classList: {
        contains: (c) => cls.has(c),
        add: (...a) => a.forEach((c) => cls.add(c)),
        remove: (...a) => a.forEach((c) => cls.delete(c)),
      },
      getAttribute: (k) => (am.has(k) ? am.get(k) : null),
      setAttribute: (k, v) => {
        am.set(k, String(v));
        if (k === 'class') { cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => cls.add(c)); }
      },
      removeAttribute: (k) => am.delete(k),
      hasAttribute: (k) => am.has(k),
      get firstElementChild() { return kids[0] || null; },
      get nextElementSibling() {
        const p = el.parentElement;
        if (!p) return null;
        const i = p.children.indexOf(el);
        return i >= 0 ? p.children[i + 1] || null : null;
      },
      appendChild(c) { c.parentElement = el; kids.push(c); return c; },
      remove() { el.isConnected = false; if (el.parentElement) { const i = el.parentElement.children.indexOf(el); if (i >= 0) el.parentElement.children.splice(i, 1); } },
      querySelector: (s) => (s === '.ag-cs-prism-rim-cv' ? kids.find((k) => k.className === 'ag-cs-prism-rim-cv') || null : null),
      getBoundingClientRect: () => rect,
      getContext: () => ctx,
      _ctx: ctx,
    };
    Object.defineProperty(el, 'className', {
      get: () => Array.from(cls).join(' '),
      set: (v) => { cls.clear(); String(v || '').split(/\s+/).filter(Boolean).forEach((c) => cls.add(c)); },
    });
    attrsOf.set(el, am);
    return el;
  };
  const html = makeEl('html', { 'data-ag-cs-ambient': '1', 'data-ag-cs-motion': 'ultra', 'data-ag-cs-theme': 'dark' });
  const doc = {
    hidden: false,
    documentElement: html,
    createElement: (tag) => makeEl(tag),
    getElementById: () => null,
    querySelectorAll: (sel) => {
      if (sel.includes('data-ag-cs-prism-box="1"')) return boxes.filter((b) => b.getAttribute('data-ag-cs-prism-box') === '1');
      if (sel.includes('.ag-cs-prism-rim-cv')) return boxes.map((b) => b.querySelector('.ag-cs-prism-rim-cv')).filter(Boolean);
      return [];
    },
    addEventListener() {},
    removeEventListener() {},
  };
  return { doc, html, boxes, makeEl };
}

test('interaction-takeover-card 与 .agy-takeover-frame 使用全周 prism rim（非底边裁切），queued-messages-card 保持底边反射', () => {
  const { doc, boxes, makeEl } = createMockRimDom();
  const prevDoc = globalThis.document;
  const prevRaf = globalThis.requestAnimationFrame;
  const prevCancel = globalThis.cancelAnimationFrame;
  const prevPerf = globalThis.performance;
  const rafs = [];
  let now = 100;

  globalThis.document = doc;
  globalThis.requestAnimationFrame = (cb) => { rafs.push(cb); return rafs.length; };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.performance = { now: () => now };

  const tkCard = makeEl(
    'div',
    { 'data-testid': 'interaction-takeover-card', class: 'agy-takeover-frame', 'data-ag-cs-prism-box': '1' },
    { left: 100, top: 100, width: 420, height: 140, right: 520, bottom: 240 }
  );
  const queuedCard = makeEl(
    'div',
    { 'data-testid': 'queued-messages-card', 'data-ag-cs-prism-box': '1', 'data-ag-cs-prism-reflect': 'bottom' },
    { left: 100, top: 300, width: 420, height: 60, right: 520, bottom: 360 }
  );
  boxes.push(tkCard, queuedCard);

  const ctl = createPrismRimCanvasController({
    isDestroyed: () => false,
    isDarkTheme: () => true,
    motionReduced: () => false,
    getMinFrameGapMs: () => 0,
    getAmbientIntensity: () => 1,
    getAccentTone: () => 'default',
    canMountRealCanvas: () => true,
    setAttrIfChanged: (el, k, v) => { if (el.getAttribute(k) !== v) el.setAttribute(k, v); },
    runGuardedMut: (fn) => fn(),
  });

  try {
    ctl.mountNewBoxes();
    // 鼠标停留在问答卡顶部边缘（y=106）-> 全周光框应全强度绘制，且不触发 destination-in 裁切
    ctl.onPointerMove({ clientX: 260, clientY: 106, target: tkCard });
    while (rafs.length) rafs.shift()(now += 16);

    const tkCv = tkCard.querySelector('.ag-cs-prism-rim-cv');
    const qCv = queuedCard.querySelector('.ag-cs-prism-rim-cv');
    assert.ok(tkCv && qCv, '问答卡与排队卡均应挂载 prism rim canvas');

    const tkOps = tkCv._ctx.ops;
    const tkStroke = tkOps.find((op) => op[0] === 'stroke');
    assert.ok(tkStroke, '鼠标在问答卡顶边时必须绘制全周棱镜边框 stroke');
    assert.equal(tkStroke[1], 1.45, '全周棱镜边框线宽应为 1.45');
    assert.equal(tkStroke[2], 1, '全周棱镜边框不应被底边反射 0.46x 衰减');
    assert.equal(tkOps.some((op) => op[0] === 'linear'), false, '问答卡全周光框不得套用 destination-in 底边渐变裁切');

    // 鼠标移动到排队卡底边 -> 排队卡仍走底边反射（lineWidth 1.15 + destination-in 线性渐变裁切）
    qCv._ctx.ops.length = 0;
    ctl.onPointerMove({ clientX: 260, clientY: 358, target: queuedCard });
    while (rafs.length) rafs.shift()(now += 16);
    const qStroke = qCv._ctx.ops.find((op) => op[0] === 'stroke');
    assert.ok(qStroke, '排队卡应正常绘制底边反射 stroke');
    assert.equal(qStroke[1], 1.15, '排队卡底边反射线宽应保持 1.15');
    assert.equal(qCv._ctx.ops.some((op) => op[0] === 'linear'), true, '排队卡应保留底边反射 destination-in 线性裁切');
  } finally {
    ctl.teardown();
    globalThis.document = prevDoc;
    globalThis.requestAnimationFrame = prevRaf;
    globalThis.cancelAnimationFrame = prevCancel;
    globalThis.performance = prevPerf;
  }

  // style.css 问答卡全周 canvas 样式与暗/浅双主题边缘质感契约
  const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  assert.ok(
    css.includes('& :is([data-testid="interaction-takeover-card"],.agy-takeover-frame)>.ag-cs-prism-rim-cv,'),
    'style.css 必须为问答卡挂载全周 .ag-cs-prism-rim-cv 定位样式'
  );
  assert.ok(
    css.includes('& :is([data-testid="interaction-takeover-card"],.agy-takeover-frame){border-color:var(--border,var(--ag-cs-border-2))!important}'),
    'style.css 必须赋予暗色问答卡与输入框呼应的边缘质感'
  );
  assert.ok(
    css.includes('border-color:rgba(15,23,42,.11)!important;box-shadow:var(--_sp),0 1px 3px rgba(15,23,42,.06)'),
    'style.css 必须赋予浅色问答卡清晰的边缘高光与质感'
  );
});
