// Obsidian Prism DOM 观察总线、三档调度器、零回流观察与双拍 Batcher
(function (root, factory) {
  const api = factory(root);
  if (root) { root.__agPrismDomBus = root.__agDomBus = api; root.__agPrismPerfCaps = api.getPerfCaps; }
  if (typeof window !== 'undefined' && window && window !== root) { window.__agPrismDomBus = window.__agDomBus = api; window.__agPrismPerfCaps = api.getPerfCaps; }
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (G) {
  'use strict';
  const BUSY_ATTR = 'data-ag-perf-busy', PERF_MODE_ATTR = 'data-ag-cs-perf-mode', STREAM_ATTR = 'data-ag-cs-stream-active';
  const PERF_CHANGE_EVENT = 'ag-prism-perf-mode-change', CV_EV = 'contentvisibilityautostatechange', BM_EV = 'beforematch';
  const SCROLL_HOLD_MS = 200, LOW_STREAM_THROTTLE_MS = 180, DEFAULT_IO_MARGIN = '250px 0px';
  const PASSIVE_CAP = Object.freeze({ capture: true, passive: true }), PASSIVE_OPT = Object.freeze({ passive: true });
  const OFF_P = 'html[data-ag-cs-style][data-ag-cs-motion="off"] :is(';
  const OFF_PS = '[data-testid="status-loading-spinner"],[data-testid="input-cancel-button"],[data-ag-cs-row-running="1"],[data-ag-sub-running="1"],[data-ag-overview-running="1"],[data-ag-sp-running="1"],[data-ag-cs-caustic="1"],[data-ag-cs-fiber-camp],[data-ag-cs-thought-streaming="1"],.ag-cs-sidebar-glide-pill,.agy-scroll-bottom';
  const MOTION_OFF_SCOPED_CSS =
    OFF_P + 'button,[role="button"],[role="menuitem"],[role="option"],[role="tab"],[role="switch"],div[role="dialog"],.agy-overlay,.agy-overlay-item,.agy-fastpick,.agy-selection-pill,.agy-toast,.surface-composer-card,.agy-composer-footer,.ag-cs-home-panel,.ag-cs-ctx-menu,.ag-cs-ctx-toast,.ag-cs-model-glyph,.ag-cs-thinking-spark,.ag-cs-smooth-caret,.ag-cs-stream-chunk,.ag-cs-thought-chunk,.ag-cs-code-scan,.ag-prism-thought-chunk,.ag-cs-liftoff-veil,.ag-cs-liftoff-ring,[data-testid="conversation-row-sidebar"],[data-testid="conversation-row-history"],[data-testid="step-plan"],[data-testid="step-plan-item"],[data-testid="queued-messages-card"],[data-testid="interaction-takeover-card"],[data-ag-cs-overview-shell="1"],[data-ag-row-stagger="1"],[data-ag-cs-sonar="1"],' + OFF_PS + '),' +
    OFF_P + OFF_PS + ')::before,' + OFF_P + OFF_PS + ')::after{animation:none!important;transition:none!important}';
  const PERF_CAPS_TABLE = Object.freeze({
    performance: Object.freeze({ mode: 'performance', maxFps: 60, minFrameGapMs: 15.2, maxDpr: 1, disableHeavyBlur: true, lowPriorityThrottleMs: 200, chunkBudgetMs: 2.5 }),
    balanced: Object.freeze({ mode: 'balanced', maxFps: 180, minFrameGapMs: 0, maxDpr: 1.5, disableHeavyBlur: false, lowPriorityThrottleMs: 180, chunkBudgetMs: 3.5 }),
    quality: Object.freeze({ mode: 'quality', maxFps: 0, minFrameGapMs: 0, maxDpr: 2, disableHeavyBlur: false, lowPriorityThrottleMs: 160, chunkBudgetMs: 4.5 }),
  });
  const normalizePerformanceMode = (raw) => {
    if (typeof raw !== 'string') return 'balanced';
    const l = raw.trim().toLowerCase();
    return l === 'performance' || l === 'eco' ? 'performance' : l === 'quality' ? 'quality' : 'balanced';
  };
  const normPri = (p) => (p === 'user-blocking' || p === 'background' ? p : 'user-visible');
  const nowMs = () => (typeof performance !== 'undefined' && performance?.now ? performance.now() : Date.now());
  const isF = (v) => typeof v === 'function', isO = (v) => Boolean(v && typeof v === 'object'), isA = Array.isArray, isFin = Number.isFinite;
  const T = (f) => { try { return f(); } catch {} }, noop = () => {};
  function readBoxSize(entry) {
    if (!entry) return null;
    for (const k of ['borderBoxSize', 'contentBoxSize']) {
      const bx = isA(entry[k]) ? entry[k][0] : entry[k];
      if (bx && isFin(bx.inlineSize) && isFin(bx.blockSize)) return { width: bx.inlineSize, height: bx.blockSize, source: k, entry };
    }
    const cr = entry.contentRect;
    return cr && isFin(cr.width) && isFin(cr.height) ? { width: cr.width, height: cr.height, source: 'contentRect', entry } : null;
  }

  function createDomBus(envDoc, envWin) {
    let bDoc = envDoc || null, bWin = envWin || null, rootMo = null, obsTgt = null, obsKey = '', subSeq = 0;
    const subs = new Map(), mQ = new Map(), wQ = new Map(), tasks = new Map(), szCbs = new Map(), vMap = new Map(), ioPools = new Map();
    let szCache = new WeakMap(), skEls = new WeakSet(), ioSkEls = new WeakSet();
    let szRo = null, dvOn = false, dvTgt = null, lastVEv = null;
    let bSeq = 0, tSeq = 0, bSched = false, bRaf = 0, bTmr = 0, bFlush = false;
    let scBusy = false, scTmr = 0, stBusy = false, mUntil = 0, mTmr = 0;
    let lsOn = false, curPerf = '', chkEp = 0, mc = null;
    const mcQ = [];

    const getDoc = (o) => o || bDoc || (typeof document !== 'undefined' ? document : null);
    const getWin = (o, d) => o || bWin || d?.defaultView || (typeof window !== 'undefined' ? window : G);
    const getHtml = (o) => getDoc(o)?.documentElement || null;
    const gFn = (k, w) => { const win = w || getWin(); return (isF(win?.[k]) && win[k]) || (isF(G?.[k]) && G[k]) || null; };
    const setA = (h, k, v) => h && T(() => { if (isF(h.setAttribute) && (!isF(h.getAttribute) || h.getAttribute(k) !== v)) h.setAttribute(k, v); });
    const rmA = (h, k) => h && T(() => { if (isF(h.removeAttribute) && (!isF(h.hasAttribute) || h.hasAttribute(k))) h.removeAttribute(k); });
    const cancelBRaf = (wo) => { if (!bRaf) return; T(() => gFn('cancelAnimationFrame', getWin(wo))?.(bRaf)); bRaf = 0; };
    const evPair = (tg, add, e1, f1, e2, f2, opt) => {
      const m = add ? 'addEventListener' : 'removeEventListener';
      if (!isF(tg?.[m])) return false;
      return Boolean(T(() => { tg[m](e1, f1, opt); tg[m](e2, f2, opt); return true; }));
    };

    const isStreaming = (o) => stBusy || Boolean(getHtml(o)?.getAttribute?.(STREAM_ATTR) === '1');
    const syncBusy = (o) => { const h = getHtml(o); if (h) { if (scBusy || stBusy || mUntil > nowMs()) setA(h, BUSY_ATTR, '1'); else rmA(h, BUSY_ATTR); } };
    function bumpScrollBusy(ms) {
      const d = typeof ms === 'number' && ms >= 0 ? ms : SCROLL_HOLD_MS;
      scBusy = true; syncBusy();
      if (scTmr) clearTimeout(scTmr);
      scTmr = setTimeout(() => { scTmr = 0; scBusy = false; syncBusy(); }, d);
    }
    const onScroll = () => bumpScrollBusy(SCROLL_HOLD_MS);
    function toggleLs(on, dO, wO) {
      if (on) { if (dO) bDoc = dO; if (wO) bWin = wO; }
      if (on === lsOn) return;
      const d = getDoc(), w = getWin(null, d), m = on ? 'addEventListener' : 'removeEventListener', tg = isF(w?.[m]) ? w : d;
      if (evPair(tg, on, 'scroll', onScroll, 'wheel', onScroll, PASSIVE_CAP)) lsOn = on;
      else if (!on) lsOn = false;
    }
    const attach = (d, w) => { toggleLs(true, d, w); attachDv(d); };
    const detach = () => { toggleLs(false); detachDv(); };
    const setStreaming = (a) => { stBusy = Boolean(a); syncBusy(); };
    function bumpBusy(ms) {
      const d = typeof ms === 'number' && ms > 0 ? ms : SCROLL_HOLD_MS, u = nowMs() + d;
      if (u > mUntil) mUntil = u;
      syncBusy();
      if (mTmr) clearTimeout(mTmr);
      mTmr = setTimeout(() => { mTmr = 0; if (nowMs() >= mUntil) { mUntil = 0; syncBusy(); } }, d + 4);
    }
    const isBusy = () => scBusy || isStreaming() || mUntil > nowMs();

    function calcMoOpts() {
      let cL = false, sb = false, at = false, cd = false, allF = true;
      const as = new Set();
      for (const s of subs.values()) {
        const o = s.o;
        if (o.childList !== false) cL = true;
        if (o.subtree !== false) sb = true;
        if (o.attributes) {
          at = true;
          if (isA(o.attributeFilter) && o.attributeFilter.length) for (const a of o.attributeFilter) as.add(a);
          else allF = false;
        }
        if (o.characterData) cd = true;
      }
      const m = { childList: cL, subtree: sb };
      if (at) { m.attributes = true; if (allF && as.size) m.attributeFilter = Array.from(as).sort(); }
      if (cd) m.characterData = true;
      return m;
    }
    function matchRec(s, m) {
      if (!m) return false;
      const t = m.type;
      if (t === 'childList' ? !s.wC : t === 'characterData' ? !s.wD : t === 'attributes' && (!s.wA || (s.aS && m.attributeName && !s.aS.has(m.attributeName)))) return false;
      if (s.rO && m.target && obsTgt && m.target !== obsTgt) return false;
      return s.f ? Boolean(s.f(m)) : true;
    }
    function flushSub(s) {
      if (s.tm) { clearTimeout(s.tm); s.tm = 0; }
      if (!s.q.length) return;
      const b = s.q.splice(0, s.q.length);
      s.at = nowMs();
      T(() => s.h(b));
    }
    function dispatchMo(muts) {
      if (!muts?.length || !subs.size) return;
      const hi = isStreaming() || scBusy, caps = getPerfCaps(), now = nowMs();
      for (const s of subs.values()) {
        let hit = null;
        if (s.pa) hit = muts;
        else for (let i = 0; i < muts.length; i++) if (matchRec(s, muts[i])) (hit || (hit = [])).push(muts[i]);
        if (!hit?.length) continue;
        if (s.p === 'low' && (hi || s.th > 0)) {
          const wMs = hi ? Math.max(s.th || 0, caps.lowPriorityThrottleMs || LOW_STREAM_THROTTLE_MS) : s.th;
          s.q.push(...hit);
          const el = now - s.at;
          if (el >= wMs && !s.tm) flushSub(s);
          else if (!s.tm) s.tm = setTimeout(() => flushSub(s), Math.max(16, wMs - el));
        } else if (s.q.length) { s.q.push(...hit); flushSub(s); }
        else { s.at = now; T(() => s.h(hit)); }
      }
    }
    function drainMutations() {
      if (!isF(rootMo?.takeRecords)) return [];
      const r = T(() => rootMo.takeRecords() || []) || [];
      if (r.length) dispatchMo(r);
      return r;
    }
    function reconcileMo() {
      if (!subs.size) { if (rootMo) { T(() => rootMo.disconnect()); rootMo = null; } obsTgt = null; obsKey = ''; return; }
      const d = getDoc(), w = getWin(null, d), tg = getHtml(d) || d?.body || null, MO = gFn('MutationObserver', w);
      if (!tg || !MO) return;
      const opts = calcMoOpts(), key = JSON.stringify(opts);
      if (rootMo && obsTgt === tg && obsKey === key) return;
      if (rootMo) T(() => rootMo.disconnect());
      rootMo = new MO(dispatchMo); obsTgt = tg; obsKey = key;
      T(() => rootMo.observe(tg, opts));
    }
    function subscribe(a1, a2, a3) {
      let id = '', h = null, o = {};
      if (isF(a1)) { h = a1; o = isO(a2) ? a2 : {}; }
      else if (typeof a1 === 'string' && isF(a2)) { id = a1; h = a2; o = isO(a3) ? a3 : {}; }
      else if (isO(a1) && isF(a2)) { o = a1; h = a2; }
      if (!isF(h)) return noop;
      id = id || o.id || 'sub-' + ++subSeq;
      if (o.doc) bDoc = o.doc;
      if (o.win) bWin = o.win;
      const pv = subs.get(id);
      if (pv?.tm) clearTimeout(pv.tm);
      const mo = isO(o.observeOptions) ? o.observeOptions : { childList: true, subtree: true, attributes: Boolean(o.attributes), attributeFilter: o.attributeFilter };
      const wC = mo.childList !== false, wD = Boolean(mo.characterData), wA = Boolean(mo.attributes);
      const aS = wA && isA(mo.attributeFilter) && mo.attributeFilter.length ? new Set(mo.attributeFilter) : null;
      const rO = mo.subtree === false, f = isF(o.filter) ? o.filter : null;
      const en = { id, h, p: o.priority === 'high' || o.priority === 'low' ? o.priority : 'normal', f, th: typeof o.throttleMs === 'number' && o.throttleMs > 0 ? o.throttleMs : 0, o: mo, wC, wD, wA, aS, rO, pa: !f && !rO && wC && wD && wA && !aS, q: [], tm: 0, at: 0 };
      subs.set(id, en);
      attach(); reconcileMo();
      return () => { const c = subs.get(id); if (c !== en) return; if (c.tm) { clearTimeout(c.tm); c.tm = 0; } c.q.length = 0; subs.delete(id); reconcileMo(); };
    }

    function flushBatch() {
      bSched = false; bRaf = bTmr = 0;
      if (bFlush) return;
      bFlush = true;
      try {
        for (const q of [mQ, wQ]) { const ls = Array.from(q.values()); q.clear(); for (let i = 0; i < ls.length; i++) T(ls[i]); }
      } finally { bFlush = false; if (mQ.size || wQ.size) schedBatch(); }
    }
    function schedBatch() {
      if (bSched) return;
      bSched = true;
      const raf = gFn('requestAnimationFrame');
      if (raf) bRaf = raf(flushBatch); else bTmr = setTimeout(flushBatch, 0);
    }
    const enq = (q, pf, k, fn) => { const cb = isF(k) ? k : fn; if (!isF(cb)) return; q.set(isF(k) || !k ? pf + ++bSeq : k, cb); schedBatch(); };
    const measure = (k, f) => enq(mQ, '__m_', k, f), mutate = (k, f) => enq(wQ, '__w_', k, f);
    const flushNow = () => { cancelBRaf(); if (bTmr) { clearTimeout(bTmr); bTmr = 0; } flushBatch(); };

    function postMc(cb) {
      const MC = gFn('MessageChannel');
      return Boolean(MC && T(() => {
        if (!mc) { mc = new MC(); mc.port1.onmessage = () => { const f = mcQ.shift(); if (f) f(); }; }
        mcQ.push(cb); mc.port2.postMessage(null); return true;
      }));
    }
    function yieldSlice() {
      const sc = getWin()?.scheduler || (typeof scheduler !== 'undefined' ? scheduler : null);
      if (isF(sc?.yield)) { const p = T(() => sc.yield()); if (p) return p; }
      return new Promise((r) => { if (!postMc(r)) setTimeout(r, 0); });
    }

    function clrFb(r) {
      if (r.t) { clearTimeout(r.t); r.t = 0; }
      if (r.i) { T(() => gFn('cancelIdleCallback')?.(r.i)); r.i = 0; }
      r.g++;
    }
    const finT = (r) => { if (tasks.get(r.k) === r) tasks.delete(r.k); r.d = true; };
    function runFb(r) {
      if (r.x || r.d || r.c?.signal?.aborted) { finT(r); r.rs(undefined); return; }
      finT(r);
      try { r.rs(r.f()); } catch (e) { r.rj(e); }
    }
    function armFb(r, ms) {
      clrFb(r);
      if (r.x || r.d) return;
      const setT = (fn, d) => { r.t = setTimeout(() => { r.t = 0; fn(); }, d); r.t?.unref?.(); };
      if (ms > 0) { setT(() => armFb(r, 0), ms); return; }
      const g = r.g;
      if (r.p === 'user-blocking') { if (!postMc(() => { if (r.g === g) runFb(r); })) setT(() => runFb(r), 0); }
      else if (r.p === 'background') {
        const ric = gFn('requestIdleCallback');
        if (ric && T(() => { r.i = ric(() => { r.i = 0; runFb(r); }, { timeout: 250 }); return true; })) return;
        setT(() => runFb(r), 16);
      } else setT(() => runFb(r), 0);
    }
    function cancelTask(k) {
      const r = tasks.get(k);
      if (!r) return false;
      r.x = true; finT(r); clrFb(r);
      T(() => r.c?.abort?.()); T(() => r.rs?.(undefined));
      return true;
    }
    function cancelGroup(pf) {
      if (typeof pf !== 'string' || !pf) return 0;
      const ks = [];
      for (const k of tasks.keys()) if (k === pf || k.startsWith(pf)) ks.push(k);
      for (let i = 0; i < ks.length; i++) cancelTask(ks[i]);
      return ks.length;
    }
    function reprioritizeTask(k, np) {
      const r = tasks.get(k);
      if (!r || r.x || r.d) return false;
      const nm = normPri(np); r.p = nm;
      if (isF(r.c?.setPriority) && T(() => { r.c.setPriority(nm); return true; })) return true;
      if (r.m === 'fb') { armFb(r, 0); return true; }
      return false;
    }
    function scheduleTask(a1, a2, a3) {
      let k = '', f = null, o = {};
      if (isF(a1)) { f = a1; o = isO(a2) ? a2 : {}; }
      else { k = String(a1 || ''); f = a2; o = isO(a3) ? a3 : {}; }
      if (!isF(f)) return Promise.resolve(undefined);
      k = k || 'task-' + ++tSeq;
      cancelTask(k);
      const p = normPri(o.priority), dl = typeof o.delay === 'number' && o.delay > 0 ? o.delay : 0;
      const w = getWin(), sc = w?.scheduler || (typeof scheduler !== 'undefined' ? scheduler : null);
      const TC = gFn('TaskController', w), AC = gFn('AbortController', w);
      let rs, rj;
      const pr = new Promise((a, b) => { rs = a; rj = b; });
      const r = { k, f, p, x: false, d: false, m: 'fb', c: null, t: 0, i: 0, g: 0, rs, rj };
      tasks.set(k, r);
      const bind = () => { pr.cancel = () => cancelTask(k); pr.reprioritize = (np) => reprioritizeTask(k, np); return pr; };
      if (isF(sc?.postTask)) {
        const ok = T(() => {
          r.m = 'nt';
          const po = dl > 0 ? { delay: dl } : {};
          if (TC) { r.c = new TC({ priority: p }); po.signal = r.c.signal; }
          else { po.priority = p; if (AC) { r.c = new AC(); po.signal = r.c.signal; } }
          Promise.resolve(sc.postTask(() => { if (r.x || r.d || r.c?.signal?.aborted) { finT(r); return undefined; } finT(r); return r.f(); }, po)).then(
            (v) => { finT(r); rs(v); },
            (e) => { finT(r); if (r.x || r.c?.signal?.aborted || e?.name === 'AbortError') rs(undefined); else rj(e); }
          );
          return true;
        });
        if (ok) return bind();
        r.m = 'fb';
      }
      r.c = AC ? new AC() : { signal: { aborted: false }, abort() { this.signal.aborted = true; } };
      armFb(r, dl);
      return bind();
    }
    async function runChunked(items, fn, o) {
      const ls = items ? (isA(items) ? items : Array.from(items)) : [];
      if (!ls.length || !isF(fn)) return { processed: 0, slices: 0, aborted: false };
      const cfg = isO(o) ? o : {}, bud = typeof cfg.budgetMs === 'number' && cfg.budgetMs > 0 ? cfg.budgetMs : getPerfCaps().chunkBudgetMs || 3.5;
      const sig = cfg.signal || null, ep = chkEp;
      let processed = 0, slices = 1, st = nowMs();
      for (let i = 0; i < ls.length; i++) {
        if (ep !== chkEp || sig?.aborted) return { processed, slices, aborted: true };
        fn(ls[i], i); processed++;
        if (i + 1 < ls.length && nowMs() - st >= bud) {
          await yieldSlice();
          if (ep !== chkEp || sig?.aborted) return { processed, slices, aborted: true };
          slices++; st = nowMs();
        }
      }
      return { processed, slices, aborted: false };
    }

    function ensureRo() {
      if (szRo) return szRo;
      const RO = gFn('ResizeObserver');
      if (!RO) return null;
      szRo = T(() => new RO((es) => {
        for (let i = 0; es && i < es.length; i++) {
          const en = es[i], el = en?.target, sz = el ? readBoxSize(en) : null;
          if (!sz) continue;
          szCache.set(el, sz);
          const st = szCbs.get(el);
          if (st) for (const cb of st) T(() => cb(sz, en));
        }
      })) || null;
      return szRo;
    }
    function observeSize(el, cb) {
      if (!el || !isF(cb)) return noop;
      let st = szCbs.get(el); const nw = !st;
      if (!st) { st = new Set(); szCbs.set(el, st); }
      st.add(cb);
      if (nw) T(() => ensureRo()?.observe(el));
      return () => {
        const c = szCbs.get(el);
        if (!c) return;
        c.delete(cb);
        if (!c.size) {
          szCbs.delete(el);
          if (szRo) { T(() => szRo.unobserve(el)); if (!szCbs.size) { T(() => szRo.disconnect()); szRo = null; } }
        }
      };
    }
    const getSize = (el) => (el ? szCache.get(el) || null : null);

    function emitVis(el, vis, source, detail) {
      const r = vMap.get(el);
      if (!r?.cbs.size) return;
      const info = { visible: Boolean(vis), skipped: !vis, isIntersecting: Boolean(vis), source, detail };
      for (const cb of r.cbs) T(() => cb(info));
    }
    const handleVis = (ev, bm) => {
      if (ev && ev === lastVEv) return;
      lastVEv = ev || null;
      const t = ev?.target;
      if (!t || (t.nodeType !== undefined && t.nodeType !== 1)) return;
      if (bm) { skEls.delete(t); ioSkEls.delete(t); emitVis(t, true, BM_EV, ev); }
      else { const sk = Boolean(ev.skipped); if (sk) skEls.add(t); else skEls.delete(t); emitVis(t, !sk, 'content-visibility', ev); }
    };
    const onCv = (ev) => handleVis(ev, false), onBm = (ev) => handleVis(ev, true);
    function attachDv(dO) {
      if (dvOn) return;
      const d = getDoc(dO);
      if (evPair(d, true, CV_EV, onCv, BM_EV, onBm, PASSIVE_CAP)) { dvOn = true; dvTgt = d; }
    }
    function detachDv() {
      if (!dvOn) return;
      evPair(dvTgt || getDoc(), false, CV_EV, onCv, BM_EV, onBm, PASSIVE_CAP);
      dvOn = false; dvTgt = null;
    }
    function ensureIo(rm) {
      const k = typeof rm === 'string' && rm ? rm : DEFAULT_IO_MARGIN;
      let pl = ioPools.get(k);
      if (pl) return pl;
      const IO = gFn('IntersectionObserver');
      if (!IO) return null;
      return T(() => {
        const io = new IO((es) => {
          for (let i = 0; es && i < es.length; i++) {
            const en = es[i], t = en?.target;
            if (!t) continue;
            if (en.isIntersecting) ioSkEls.delete(t); else ioSkEls.add(t);
            emitVis(t, Boolean(en.isIntersecting) && !skEls.has(t), 'io', en);
          }
        }, { rootMargin: k });
        pl = { io, els: new Set(), k }; ioPools.set(k, pl); return pl;
      }) || null;
    }
    function observeVisibility(el, cb, o) {
      if (!el || !isF(cb)) return noop;
      const cfg = isO(o) ? o : {};
      attachDv(cfg.doc);
      let r = vMap.get(el);
      if (!r) {
        let u = null;
        const eCv = (e) => onCv(e?.target ? e : { target: el, skipped: Boolean(e?.skipped) });
        const eBm = (e) => onBm(e?.target ? e : { target: el });
        if (evPair(el, true, CV_EV, eCv, BM_EV, eBm, PASSIVE_OPT)) u = () => evPair(el, false, CV_EV, eCv, BM_EV, eBm, PASSIVE_OPT);
        let pl = null;
        if (cfg.io !== false) { pl = ensureIo(cfg.rootMargin); if (pl && !T(() => { pl.io.observe(el); pl.els.add(el); return true; })) pl = null; }
        r = { cbs: new Set(), u, pl }; vMap.set(el, r);
      }
      r.cbs.add(cb);
      return () => {
        const c = vMap.get(el);
        if (!c) return;
        c.cbs.delete(cb);
        if (!c.cbs.size) {
          vMap.delete(el);
          if (c.u) T(c.u);
          if (c.pl) {
            T(() => c.pl.io.unobserve(el));
            c.pl.els.delete(el);
            if (!c.pl.els.size) { T(() => c.pl.io.disconnect()); ioPools.delete(c.pl.k); }
          }
          ioSkEls.delete(el);
        }
      };
    }
    function isSkipped(el) {
      if (!el) return false;
      if (ioSkEls.has(el) || skEls.has(el)) return true;
      for (let c = el.parentElement, n = 0; c && n < 12; c = c.parentElement, n++) if (skEls.has(c)) return true;
      return false;
    }

    function applyPerformanceMode(mode, dO, wO) {
      const nm = normalizePerformanceMode(mode), d = getDoc(dO), w = getWin(wO, d), h = getHtml(d);
      const pv = curPerf || h?.getAttribute?.(PERF_MODE_ATTR) || '';
      curPerf = nm;
      if (h) { T(() => { if (h.dataset) h.dataset.agCsPerfMode = nm; }); setA(h, PERF_MODE_ATTR, nm); }
      if (pv && pv !== nm && isF(w?.dispatchEvent)) T(() => {
        const CE = gFn('CustomEvent', w), detail = { mode: nm, caps: PERF_CAPS_TABLE[nm] };
        w.dispatchEvent(CE ? new CE(PERF_CHANGE_EVENT, { detail }) : { type: PERF_CHANGE_EVENT, detail });
      });
      return nm;
    }
    function getPerfCaps(mO, dO) {
      if (typeof mO === 'string' && mO) return PERF_CAPS_TABLE[normalizePerformanceMode(mO)];
      const h = getHtml(dO), raw = (h && T(() => h.dataset?.agCsPerfMode || h.getAttribute?.(PERF_MODE_ATTR))) || '';
      return PERF_CAPS_TABLE[normalizePerformanceMode(raw || curPerf || 'balanced')];
    }

    function dispose(dO, wO) {
      chkEp++;
      for (const k of Array.from(tasks.keys())) cancelTask(k);
      tasks.clear();
      for (const s of subs.values()) { if (s.tm) clearTimeout(s.tm); s.q.length = 0; }
      subs.clear();
      if (rootMo) { T(() => rootMo.disconnect()); rootMo = null; }
      obsTgt = null; obsKey = '';
      if (szRo) { T(() => szRo.disconnect()); szRo = null; }
      szCbs.clear(); szCache = new WeakMap();
      for (const r of vMap.values()) if (r.u) T(r.u);
      vMap.clear();
      for (const pl of ioPools.values()) { T(() => pl.io.disconnect()); pl.els.clear(); }
      ioPools.clear();
      skEls = new WeakSet(); ioSkEls = new WeakSet(); lastVEv = null;
      cancelBRaf(wO);
      if (bTmr) { clearTimeout(bTmr); bTmr = 0; }
      bSched = false; mQ.clear(); wQ.clear();
      if (scTmr) { clearTimeout(scTmr); scTmr = 0; }
      if (mTmr) { clearTimeout(mTmr); mTmr = 0; }
      scBusy = stBusy = false; mUntil = 0; curPerf = '';
      detach();
      while (mcQ.length) T(() => mcQ.shift()());
      if (mc) { T(() => { mc.port1.onmessage = null; mc.port1.close?.(); mc.port2.close?.(); }); mc = null; }
      const h = getHtml(dO);
      if (h) { rmA(h, BUSY_ATTR); rmA(h, PERF_MODE_ATTR); T(() => { if (h.dataset && 'agCsPerfMode' in h.dataset) delete h.dataset.agCsPerfMode; }); }
    }

    return {
      BUSY_ATTR, PERF_MODE_ATTR, STREAM_ATTR, MOTION_OFF_SCOPED_CSS, PERF_CAPS_TABLE,
      attach, subscribe, drainMutations, measure, mutate, flushNow,
      scheduleTask, cancelTask, cancelGroup, reprioritizeTask, yieldSlice, runChunked,
      observeSize, getSize, readBoxSize, observeVisibility, isSkipped,
      setStreaming, bumpBusy, bumpScrollBusy, isBusy, isStreaming,
      normalizePerformanceMode, applyPerformanceMode, getPerfCaps,
      getDebugState: () => ({
        subscriberCount: subs.size, observing: Boolean(rootMo), listenersAttached: lsOn,
        scrollBusy: scBusy, streamBusy: stBusy, busy: isBusy(), perfMode: getPerfCaps().mode,
        pendingMeasures: mQ.size, pendingMutates: wQ.size, pendingTasks: tasks.size,
        sizeObservedCount: szCbs.size, visibilityObservedCount: vMap.size,
      }),
      dispose, destroy: dispose, createInstance: createDomBus,
    };
  }
  return createDomBus(null, null);
});
