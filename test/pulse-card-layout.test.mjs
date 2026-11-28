import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const layoutMod = require(path.join(ROOT, 'src', 'runtime', 'pulse-card-layout.js'));

function createMockShadowEnv() {
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const winLs = new Map();
  const win = {
    addEventListener(t, fn) { (winLs.get(t) || winLs.set(t, new Set()).get(t)).add(fn); },
    removeEventListener(t, fn) { winLs.get(t)?.delete(fn); },
    dispatch(t, ev) { for (const fn of [...(winLs.get(t) || [])]) fn(ev); },
  };
  const mk = (tag) => {
    const attrs = new Map(), ls = new Map();
    const el = {
      tagName: String(tag).toUpperCase(),
      children: [], parentNode: null, hidden: false, disabled: false, textContent: '',
      style: {
        setProperty(k, v) { this[k] = String(v); },
        removeProperty(k) { delete this[k]; },
      },
      _rect: { top: 0, height: 80 },
      getBoundingClientRect() {
        const dy = parseFloat(this.style['--pvl-dy'] || '0') || 0;
        const ord = parseInt(this.style.order || '0', 10) || 0;
        const baseTop = this.getAttribute('data-pvl-blk') ? ord * 100 : this._rect.top;
        return { top: baseTop + dy, bottom: baseTop + dy + 80, height: 80 };
      },
      get className() { return attrs.get('class') || ''; },
      set className(v) { attrs.set('class', String(v || '')); },
      get id() { return attrs.get('id') || ''; },
      set id(v) { if (v) attrs.set('id', String(v)); else attrs.delete('id'); },
      get firstChild() { return el.children[0] || null; },
      get nextSibling() { const p = el.parentNode; if (!p) return null; const i = p.children.indexOf(el); return i >= 0 ? (p.children[i + 1] || null) : null; },
      setAttribute(k, v) { attrs.set(k, String(v)); },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      removeAttribute(k) { attrs.delete(k); },
      appendChild(c) { if (c.parentNode) c.remove(); c.parentNode = el; el.children.push(c); return c; },
      insertBefore(c, ref) { if (!ref) return el.appendChild(c); const i = el.children.indexOf(ref); if (i < 0) return el.appendChild(c); if (c.parentNode) c.remove(); c.parentNode = el; el.children.splice(i, 0, c); return c; },
      remove() { if (!el.parentNode) return; const i = el.parentNode.children.indexOf(el); if (i >= 0) el.parentNode.children.splice(i, 1); el.parentNode = null; },
      addEventListener(t, fn) { (ls.get(t) || ls.set(t, new Set()).get(t)).add(fn); },
      removeEventListener(t, fn) { ls.get(t)?.delete(fn); },
      dispatch(t, ev) { for (const fn of [...(ls.get(t) || [])]) fn(ev); },
      click() { el.dispatch('click', { preventDefault() {}, stopPropagation() {} }); },
      matches(sel) {
        return String(sel).split(',').some((raw) => {
          let r = raw.trim();
          if (!r || r.includes(' ') || r.includes('>')) return false;
          const tm = r.match(/^[a-zA-Z0-9-]+/);
          if (tm) { if (el.tagName !== tm[0].toUpperCase()) return false; r = r.slice(tm[0].length); }
          for (const m of r.matchAll(/\.([a-zA-Z0-9_-]+)/g)) if (!(el.getAttribute('class') || '').split(/\s+/).includes(m[1])) return false;
          for (const m of r.matchAll(/\[([a-zA-Z0-9_-]+)(?:=["']?([^"'\]\s]+)["']?)?\]/g)) {
            if (!attrs.has(m[1])) return false;
            if (m[2] !== undefined && attrs.get(m[1]) !== m[2]) return false;
          }
          return true;
        });
      },
      closest(sel) { let c = el; while (c) { if (c.matches(sel)) return c; c = c.parentNode; } return null; },
      querySelectorAll(sel) { const o = []; const w = (n) => { for (const c of n.children) { if (c.matches(sel)) o.push(c); w(c); } }; w(el); return o; },
      querySelector(sel) { return el.querySelectorAll(sel)[0] || null; },
      getElementById(id) { let hit = null; const w = (n) => { for (const c of n.children) { if (!hit && c.id === id) hit = c; w(c); } }; w(el); return hit; },
    };
    return el;
  };
  const doc = { createElement: mk, createElementNS: (_ns, t) => mk(t) };
  const sr = mk('#shadow-root');
  const cacheRate = mk('strong'); cacheRate.id = 'cache-rate'; cacheRate.textContent = '97.7%';
  sr.appendChild(cacheRate);
  const cd = mk('section'); cd.id = 'context-card';
  const hd = mk('div'); hd.className = 'heading';
  const acts = mk('span'); acts.className = 'pv-acts';
  const modeBtn = mk('button'); modeBtn.className = 'pv-btn';
  acts.appendChild(modeBtn); hd.appendChild(acts); cd.appendChild(hd);
  const bw = mk('div'); bw.className = 'pv-bw'; cd.appendChild(bw);
  const qE = mk('section'); qE.className = 'pv-qt'; qE.hidden = false; cd.appendChild(qE);
  const qSw = mk('button'); qSw.className = 'pv-qbtn'; qE.appendChild(qSw);
  const qK = mk('div'); qK.className = 'pv-qtask'; qE.appendChild(qK);
  const rE = mk('div'); rE.className = 'pv-ft'; cd.appendChild(rE);
  sr.appendChild(cd);
  return { doc, win, sr, cd, hd, bw, qE, qSw, qK, rE, storage, store };
}

test('pulse-card-layout renders slim visibility strip (0 arrow rows), supports direct long-press drag reorder with anti-accidental-touch guards, speed-vial sync, reset & persistence', async () => {
  const env = createMockShadowEnv();
  const ctx = {
    sr: env.sr, cd: env.cd, hd: env.hd, bw: env.bw, qE: env.qE, qK: env.qK, rE: env.rE,
    doc: env.doc, win: env.win, storage: env.storage, lang: 'zh-CN',
    st: { f: 0.363, u: 186000, mx: 512000, m: 'Gemini 4 Neon (High)', t: 71.3, l: 106.5, tf: 9.2, hs: -1, rt: [0.05, 0.24, 0.07], cs: ['#1b49b2', '#3186ff', '#5cc6fc'], tu: { subagents: 1 } },
    kS: (n) => `${Math.round(n / 1000)}k`,
    fS: (s) => `${s.toFixed(2)}s`,
    T: (i) => ['', '', '系统与规则', '对话消息', '工具输出'][i] || '',
  };

  layoutMod.sync(ctx);
  assert.equal(env.cd.getAttribute('data-pvl'), '1');
  assert.equal(layoutMod.getCardWidth(env.sr, 'vial'), 436);
  assert.equal(layoutMod.getCardWidth(env.sr, 'bar'), 324);

  // Unified speed = latest 106.5 tok/s, TTFT = 9.20s, Cache = 97.7%
  assert.equal(env.sr.querySelector('[data-pvl-kpi="speed"]').querySelector('.pvl-kv').children[0].textContent, '106.5');
  assert.equal(env.sr.querySelector('[data-pvl-kpi="ttft"]').querySelector('.pvl-kv').children[0].textContent, '9.20');
  assert.equal(env.sr.querySelector('[data-pvl-kpi="cache"]').querySelector('.pvl-kv').children[0].textContent, '97.7%');
  assert.equal(env.rE.hidden, false);

  // Open slim visibility strip -> must contain 0 legacy arrow rows, show drag hint, and use unified accordion + blur-scale motion
  const editEl = env.sr.querySelector('[data-pvl-edit="1"]');
  assert.equal(editEl.hidden, true);
  assert.equal(editEl.getAttribute('aria-hidden'), 'true');
  assert.equal(editEl.inert, true);
  assert.ok(editEl.querySelector('.pvl-edit-in')?.querySelector('.pvl-edit-box'), 'edit strip must use .pvl-edit-in > .pvl-edit-box accordion wrapper');
  const cssTxt = env.sr.querySelector('style[data-ag-cs-pulse-layout-style="1"]')?.textContent || '';
  assert.ok(cssTxt.includes('grid-template-rows:0fr') && cssTxt.includes('filter:blur(4px)') && cssTxt.includes('var(--ls') && cssTxt.includes('data-pv-motion="subtle"') && cssTxt.includes('data-pv-motion="off"'), 'edit strip CSS must match #context-card blur-scale + motion tiers');

  env.sr.querySelector('[data-pvl-cfg="1"]').click();
  assert.equal(editEl.hidden, false);
  assert.equal(editEl.getAttribute('aria-hidden'), 'false');
  assert.equal(editEl.inert, false);
  assert.equal(env.sr.querySelectorAll('[data-pvl-move]').length, 0, 'Bulky arrow reorder rows must be removed');
  assert.ok(env.sr.querySelector('[data-pvl-hint="1"]').textContent.includes('长按'));

  const qBlk = env.sr.querySelector('[data-pvl-blk="quota"]');
  const cBlk = env.sr.querySelector('[data-pvl-blk="ctx"]');

  // Guard 1: Pressing on interactive button inside quota block must NOT arm drag
  qBlk.dispatch('pointerdown', { button: 0, clientX: 20, clientY: 240, pointerId: 1, target: env.qSw });
  assert.equal(qBlk.getAttribute('data-pvl-arm'), null, 'Interactive button press must not arm drag');

  // Guard 2: Moving > 6px before hold delay cancels arm cleanly
  qBlk.dispatch('pointerdown', { button: 0, clientX: 20, clientY: 240, pointerId: 2, target: qBlk });
  assert.equal(qBlk.getAttribute('data-pvl-arm'), '1');
  env.win.dispatch('pointermove', { clientX: 35, clientY: 240 });
  assert.equal(qBlk.getAttribute('data-pvl-arm'), null, 'Slip > 6px before hold must cancel arm');

  // Real long-press (>= HOLD_MS) on quota block -> lifts and live-reorders to top on drag up
  qBlk.dispatch('pointerdown', { button: 0, clientX: 20, clientY: 240, pointerId: 3, target: qBlk });
  await new Promise((r) => setTimeout(r, layoutMod.HOLD_MS + 40));
  assert.equal(qBlk.getAttribute('data-pvl-drag'), '1', 'Long press must lift block into drag state');
  env.win.dispatch('pointermove', { clientX: 20, clientY: 120, preventDefault() {} }); // crosses perf (140)
  env.win.dispatch('pointermove', { clientX: 20, clientY: 10, preventDefault() {} }); // crosses ctx (40)
  env.win.dispatch('pointerup', { clientX: 20, clientY: 10 });

  assert.equal(qBlk.getAttribute('data-pvl-drag'), null);
  assert.equal(qBlk.style.order, '0');
  assert.equal(cBlk.style.order, '1');
  assert.equal(cBlk.getAttribute('data-sep'), '1', 'separator must appear between Quota (top) and Context');

  // Toggle speed off -> hides KPI cell & left vial bottom rate
  env.sr.querySelector('[data-pvl-toggle-item="speed"]').click();
  assert.equal(env.sr.querySelector('[data-pvl-kpi="speed"]').hidden, true);
  assert.equal(env.rE.hidden, true, 'left vial bottom rate must hide when speed is toggled off');

  // Persisted to localStorage
  const saved = JSON.parse(env.storage.getItem(layoutMod.STORAGE_KEY));
  assert.deepEqual(saved.order, ['quota', 'ctx', 'perf']);
  assert.equal(saved.items.speed, false);

  // Reset restores defaults
  env.sr.querySelector('[data-pvl-reset="1"]').click();
  assert.equal(cBlk.style.order, '0');
  assert.equal(env.sr.querySelector('[data-pvl-kpi="speed"]').hidden, false);
  assert.equal(env.rE.hidden, false);

  // Detach cleans up cleanly
  layoutMod.detach(env.sr);
  assert.equal(env.cd.getAttribute('data-pvl'), null);
  assert.equal(env.sr.querySelector('.pvl-deck'), null);
});

test('pulse-card-layout yields to external Pulse plugin cards and has 9-locale coverage with 0 CJK leaks', () => {
  const env = createMockShadowEnv();
  const extDl = env.doc.createElement('dl');
  extDl.className = 'stats-grid';
  env.cd.appendChild(extDl);
  assert.equal(layoutMod.attach({ sr: env.sr, cd: env.cd, hd: env.hd, doc: env.doc, storage: env.storage }), null);
  assert.equal(layoutMod.getCardWidth(env.sr, 'vial'), 396);

  const cjkRe = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/;
  for (const [k, row] of Object.entries(layoutMod.LOCALES_TABLE)) {
    assert.equal(row.length, 9, `9 locales expected for ${k}`);
    for (let i = 0; i < 9; i++) {
      assert.ok(row[i].trim().length > 0, `empty translation for ${k}[${i}]`);
      if (i !== 0 && i !== 1 && i !== 3 && i !== 4) {
        assert.equal(cjkRe.test(row[i]), false, `CJK leak in ${k}[${i}]: ${row[i]}`);
      }
    }
  }
});
