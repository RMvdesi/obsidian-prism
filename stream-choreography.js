// Obsidian Prism — Route Choreography, Velvet Stream Feathering, Auto-Unfold & Lens Module (stream-choreography.js)
(function (root) {
  'use strict';
  const M = Math;
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  if (!G) return;

  const STREAM_BATCH_MS = 52;
  const STREAM_FADE_MS = 300;
  const STREAM_FADE_STEP_MS = 60;
  const MAX_FADE_RANGES = 48;
  const SIDEBAR_RUN_HOLD_MS = 450;
  const STOP_TID_RE = /(?:^|[^a-z])(?:stop|cancel|abort)(?:[^a-z]|$)/i;
  const STOP_CAMEL_RE = /(?:^|[^a-zA-Z])(?:stop|cancel|abort)(?=[A-Z])|(?:Stop|Cancel|Abort)(?:[A-Z0-9_-]|$)/;
  const STOP_LABEL_RE = /(?:^|\b)(?:stop|cancel|abort)(?:\b|$)|停止|取消|中止/i;
  const NON_STOP_RE =
    /取消置顶|取消固定|取消收藏|unpin|\b(?:pin|menu|more|options|delete|trash|archive|rename|close|dismiss)\b|置顶|固定|更多|菜单|选项|删除|归档|重命名/i;
  const HIGHLIGHT_NAMES = [0, 1, 2, 3, 4].map((i) => 'ag-stream-f' + i);
  const TABLE_TAGS = new Set('TABLE|THEAD|TBODY|TFOOT|TR|TH|TD'.split('|'));
  const INLINE_TAGS = new Set('SPAN|STRONG|EM|B|I|A|CODE|MARK|DEL|SUB|SUP'.split('|'));
  const K_PE = 'parentElement';
  const K_CL = 'classList';
  const K_IC = 'isConnected';

  const isEl = (n) => Boolean(n && (n.nodeType === 1 || (n.nodeType === undefined && typeof n.tagName === 'string')));
  const tagOf = (n) => String(n?.tagName || '').toUpperCase();
  const peOf = (n) => n?.[K_PE] || null;
  const clHas = (e, c) => Boolean(e?.[K_CL]?.contains?.(c));
  const clRm = (e, c) => e?.[K_CL]?.remove?.(c);
  const isConn = (e) => !!(e && e[K_IC] !== false);
  const ga = (e, k) => e?.getAttribute?.(k);
  const sa = (e, k, v) => e?.setAttribute?.(k, v);
  const ra = (e, k) => e?.removeAttribute?.(k);
  const ha = (e, k) => Boolean(e?.hasAttribute?.(k));
  const qs = (e, s) => e?.querySelector?.(s) || null;
  const qsa = (e, s) => e?.querySelectorAll?.(s) || [];
  const closestOf = (e, s) => e?.closest?.(s) || null;
  const rectOf = (e) => (typeof e?.getBoundingClientRect === 'function' ? e.getBoundingClientRect() : null);
  const setProp = (e, k, v) => e?.style?.setProperty?.(k, v);
  const docOf = () => (typeof document !== 'undefined' ? document : null);
  const nowOf = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());
  const rAF = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : 0);
  const cAF = (id) => {
    if (id && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
  };
  const ST = (fn, ms) => setTimeout(fn, ms);
  const CT = (id) => clearTimeout(id), AF = Array.from, isFin = Number.isFinite;
  const mkOwned = (d, t, c) => { const e = d.createElement(t); e.className = c; sa(e, 'aria-hidden', 'true'); sa(e, 'data-ag-no-i18n', ''); sa(e, 'data-ag-owned', '1'); return e; };

  const createStreamChoreographyController = ({
    motionEngine,
    isDestroyed: isD,
    isMotionStandardOrUltra: isMS,
    isMotionUltra: isMU,
    isConvRunning,
    isThoughtIsolatedNode: isTI,
    isThoughtMutationRecord,
    isManagedThoughtPanel: isMT,
    setAttrIfChanged: setA,
    runGuardedMut,
    cloneCachedSvgElement,
    buildBrandMarkSvg,
    applySingleHostIcon,
    rippleCtl,
    convAuraCtl,
    notifyMascot,
  }) => {
    let hydrateRaf = 0;
    let sparkQueue = [];
    let iconQueue = [];
    let unfoldQueue = [];
    let unfoldRaf = 0;
    let wfClickTimer = 0;
    let convEntryTimer = 0;
    let convEntryRaf = 0;
    let convEntrySeq = 0;
    const tTmr = new Set();

    const heroState = {
      routeInitialized: false,
      wasInHome: false,
      wasInFormalConv: false,
      lastModelSig: null,
      pendingModelShiftNotify: false,
      lastTriggerOrigin: null,
      lastGroupPress: null,
    };
    let lastHomeRect = null;
    let liftBubAt = 0;
    let supMotAt = 0;
    let runInit = false;
    let wasRunning = false;
    let runStartAt = 0;
    let lastVialHighNotifyAt = -600000;
    let fiberTimer = 0;
    let sbInit = false;
    let sbIndex = -1;
    let sbCid = '';
    let sbRect = null;
    let sbRunning = false;
    const runCidM = new Map();
    const runRowM = new WeakMap();
    let runHoldTimer = 0;

    const seenHeaders = new WeakSet();
    const seenOverlays = new WeakSet();

    let streamObs = null;
    const streamRoots = new Set();
    const paneRunState = new WeakMap();
    let streamMutating = false;
    let lastCodeAt = -1000;
    let scannedNodes = new WeakSet();
    let seenBlocks = new WeakSet();
    const textLenMap = new WeakMap();

    const fadeItems = [];
    let hlBuckets = null;
    let fadeRaf = 0;
    let fadeTimer = 0;
    let fdDue = 0;
    const spkCache = new WeakMap();

    const expCls = new Map();
    let sweepTimer = 0;

    const guardMut = (fn) => {
      const p = streamMutating;
      streamMutating = true;
      try { return typeof runGuardedMut === 'function' ? runGuardedMut(fn) : fn(); } finally {
        if (!p && streamObs?.takeRecords) try { streamObs.takeRecords(); } catch {}
        streamMutating = p;
      }
    };

    const canStreamMotion = () => {
      const d = docOf();
      if (ga(d?.documentElement, 'data-ag-cs-motion') === 'off') return false;
      return typeof isMS === 'function' ? Boolean(isMS()) : Boolean(isMU());
    };

    const getBkts = () => {
      const cssObj = typeof CSS !== 'undefined' ? CSS : G.CSS;
      const HlCtor = typeof Highlight === 'function' ? Highlight : G.Highlight;
      const d = docOf();
      if (!cssObj?.highlights?.set || typeof HlCtor !== 'function' || typeof d?.createRange !== 'function') return null;
      if (!hlBuckets) {
        hlBuckets = HIGHLIGHT_NAMES.map((n) => {
          const h = cssObj.highlights.get?.(n) || new HlCtor();
          cssObj.highlights.set(n, h);
          return h;
        });
      } else {
        for (let i = 0; i < 5; i++) {
          const n = HIGHLIGHT_NAMES[i];
          const cur = cssObj.highlights.get?.(n);
          if (cur && cur !== hlBuckets[i]) hlBuckets[i] = cur;
          else if (!cur) cssObj.highlights.set(n, hlBuckets[i]);
        }
      }
      return hlBuckets;
    };

    const dropBkt = (it) => {
      if (hlBuckets && it.b >= 0 && it.b < 5) {
        try {
          hlBuckets[it.b].delete(it.r);
        } catch {}
      }
      it.b = -1;
    };

    const clrFT = () => { if (fadeTimer) { CT(fadeTimer); fadeTimer = 0; } };
    const clearHighlightFade = () => { clrFT(); cAF(fadeRaf); fadeRaf = fdDue = 0; for (const it of fadeItems) dropBkt(it); fadeItems.length = 0; };
    const schedFd = (now, useT) => {
      if (isD() || !fadeItems.length || fadeRaf) return;
      if (docOf()?.hidden) return clearHighlightFade();
      const dl = fdDue > 0 ? fdDue - now : 0;
      if (useT && dl > 18 && typeof setTimeout === 'function') {
        if (fadeTimer) return;
        fadeTimer = ST(() => {
          fadeTimer = 0;
          if (isD() || !canStreamMotion() || !fadeItems.length || docOf()?.hidden) return clearHighlightFade();
          if (!fadeRaf && !(fadeRaf = rAF(stepHighlightFade))) clearHighlightFade();
        }, M.max(8, M.round(dl - 6)));
        return;
      }
      clrFT(); if (!(fadeRaf = rAF(stepHighlightFade))) clearHighlightFade();
    };
    function stepHighlightFade(ts) {
      clrFT(); fadeRaf = 0;
      if (isD() || !canStreamMotion() || !fadeItems.length || docOf()?.hidden) return clearHighlightFade();
      const now = typeof ts === 'number' && isFin(ts) ? ts : nowOf();
      if (fdDue > 0 && now < fdDue - 1) return schedFd(now, true);
      const bks = getBkts();
      if (!bks) return clearHighlightFade();
      let w = 0, minD = Infinity;
      for (const it of fadeItems) {
        const tn = it.n, val = tn ? tn.data ?? tn.nodeValue ?? '' : '', age = M.max(0, now - it.t);
        if (!isConn(tn) || val.length < it.e || age >= STREAM_FADE_MS) { dropBkt(it); continue; }
        const nb = M.min(4, (age / STREAM_FADE_STEP_MS) | 0);
        if (it.b !== nb) { dropBkt(it); try { bks[nb].add(it.r); it.b = nb; } catch { continue; } }
        const due = it.t + (it.b + 1) * STREAM_FADE_STEP_MS;
        if (due < minD) minD = due;
        fadeItems[w++] = it;
      }
      fadeItems.length = w;
      if (w) { fdDue = isFin(minD) ? minD : 0; schedFd(now, false); } else clearHighlightFade();
    }
    const enqFd = (tn, sO, eO, now) => {
      if (!tn || eO <= sO) return false;
      const d = docOf(), bks = d && !d.hidden ? getBkts() : null;
      if (!bks) return false;
      const raw = tn.data ?? tn.nodeValue ?? '';
      if (eO > raw.length || !/\S/.test(raw.slice(sO, eO))) return false;
      const prev = fadeItems[fadeItems.length - 1];
      if (prev && prev.n === tn && prev.e === sO && now - prev.t <= 64) { try { prev.r.setEnd(tn, eO); prev.e = eO; return true; } catch {} }
      if (fadeItems.length >= MAX_FADE_RANGES) { const o = fadeItems.shift(); if (o) dropBkt(o); }
      try {
        const r = d.createRange(); r.setStart(tn, sO); r.setEnd(tn, eO); bks[0].add(r);
        fadeItems.push({ n: tn, s: sO, e: eO, r, b: 0, t: now });
        const due = now + STREAM_FADE_STEP_MS;
        if (!fdDue || due < fdDue) { fdDue = due; clrFT(); }
        schedFd(now, false); return true;
      } catch { return false; }
    };

    const snapTextLens = (node, limit = 24) => {
      if (!node) return;
      let c = 0;
      const walk = (n) => {
        if (!n || c >= limit) return;
        if (n.nodeType === 3) {
          textLenMap.set(n, (n.data ?? n.nodeValue ?? '').length);
          c++;
          return;
        }
        const ks = n.childNodes;
        if (!ks) return;
        for (let i = ks.length - 1; i >= 0 && c < limit; i--) walk(ks[i]);
      };
      walk(node);
    };

    const flushExp = () => {
      sweepTimer = 0;
      if (expCls.size === 0) return;
      const now = Date.now();
      let nextDue = Infinity;
      guardMut(() => {
        for (const [el, map] of expCls.entries()) {
          for (const [cls, expAt] of map.entries()) {
            if (now >= expAt - 2) { clRm(el, cls); map.delete(cls); }
            else if (expAt < nextDue) nextDue = expAt;
          }
          if (map.size === 0) expCls.delete(el);
        }
      });
      if (!isD() && expCls.size > 0 && isFin(nextDue)) {
        sweepTimer = ST(flushExp, M.max(16, M.ceil(nextDue - Date.now())));
      }
    };

    const scheduleTransient = (fn, ms) => {
      const id = ST(() => {
        tTmr.delete(id);
        if (!isD()) try { guardMut(fn); } catch {}
      }, ms);
      tTmr.add(id);
      return id;
    };

    const VP_SEL = '[data-testid="autoscroll-viewport"]';
    let pV = null, pLV = null, pRo = null, pTm = 0, pEnd = 0, pOff = null, pUM = false;
    const vpMax = (v) => M.max(0, (v?.scrollHeight || 0) - (v?.clientHeight || 0));
    const isConvEntryPinActive = (v) => Boolean(pV && (!v || pV === v) && !pUM && !isD());
    const clrPin = () => { if (pTm) { CT(pTm); pTm = 0; } try { pRo?.disconnect(); pOff?.(); } catch {} pRo = pOff = pV = null; pEnd = 0; };
    const pinB = (v) => { const m = vpMax(v); if (v && isConn(v) && !pUM && !isD() && (v.scrollTop || 0) < m - 1) v.scrollTop = m; };
    const armQ = (ms = 320) => {
      if (!isConvEntryPinActive()) return;
      if (pTm) CT(pTm);
      const r = pEnd - nowOf();
      if (r <= 0) return clrPin();
      pTm = ST(() => { pTm = 0; if (isConvEntryPinActive() && unfoldQueue.length && nowOf() < pEnd) armQ(240); else clrPin(); }, M.min(ms, M.max(16, M.round(r))));
    };
    const armConvEntryBottomPin = (c) => {
      clrPin();
      const v = c ? (ga(c, 'data-testid') === 'autoscroll-viewport' ? c : qs(c, VP_SEL)) : null;
      if (!v || !isConn(v) || isD()) return false;
      const m = vpMax(v), st = v.scrollTop || 0;
      if (m > 240 && st > 40 && m - st > 220) return false;
      pV = pLV = v; pUM = false; pEnd = nowOf() + 1400;
      const ab = () => { pUM = true; clrPin(); }, setEv = (fn, op) => { for (const e of ['wheel', 'pointerdown', 'touchstart']) v[fn]?.(e, ab, op); };
      setEv('addEventListener', { passive: true, once: true }); pOff = () => setEv('removeEventListener');
      if (typeof ResizeObserver === 'function') try { pRo = new ResizeObserver(() => { if (!isConvEntryPinActive() || !isConn(pV)) clrPin(); else { pinB(pV); armQ(260); } }); pRo.observe(v.firstElementChild || v); } catch { pRo = null; }
      pinB(v); rAF(() => { if (isConvEntryPinActive(v)) pinB(v); }); armQ(680);
      return true;
    };

    const clearTransientTimers = () => {
      convEntrySeq++; clrPin();
      if (convEntryTimer) { CT(convEntryTimer); convEntryTimer = 0; }
      if (convEntryRaf) { cAF(convEntryRaf); convEntryRaf = 0; }
      if (wfClickTimer) { CT(wfClickTimer); wfClickTimer = 0; }
      if (sweepTimer) { CT(sweepTimer); sweepTimer = 0; }
      if (runHoldTimer) { CT(runHoldTimer); runHoldTimer = 0; }
      runCidM.clear(); expCls.clear();
      for (const id of tTmr) CT(id);
      tTmr.clear();
    };
    const cancelDeferredHydration = () => {
      convEntrySeq++; clrPin();
      if (convEntryTimer) { CT(convEntryTimer); convEntryTimer = 0; }
      if (convEntryRaf) { cAF(convEntryRaf); convEntryRaf = 0; }
      cAF(hydrateRaf); hydrateRaf = 0; cAF(unfoldRaf); unfoldRaf = 0;
      sparkQueue = []; iconQueue = []; unfoldQueue = [];
    };

    const setSpk = (trig, brand, st) => {
      const d = docOf();
      if (!d || !isConn(trig)) return;
      if (st === 'streaming') setA(trig, 'data-ag-cs-spark-streaming', '1');
      else if (ha(trig, 'data-ag-cs-spark-streaming')) ra(trig, 'data-ag-cs-spark-streaming');
      let spark = clHas(trig.firstElementChild, 'ag-cs-thinking-spark') ? trig.firstElementChild : qs(trig, '.ag-cs-thinking-spark');
      if (!spark) { spark = mkOwned(d, 'span', 'ag-cs-thinking-spark'); trig.insertBefore(spark, trig.firstChild); }
      const isMono = ga(d.documentElement, 'data-ag-cs-accent') === 'mono';
      const mv = isMono ? '1' : '0';
      if (ga(spark, 'data-brand') !== brand || ga(spark, 'data-state') !== st || ga(spark, 'data-mono') !== mv) {
        sa(spark, 'data-brand', brand);
        sa(spark, 'data-state', st);
        sa(spark, 'data-mono', mv);
        const c = cloneCachedSvgElement(`spark:${brand}:${mv}`, buildBrandMarkSvg(brand, 13, 'auto', isMono));
        if (c) (G.__agPrismSvgUtil ? G.__agPrismSvgUtil.mount(spark, c) : spark.replaceChildren?.(c));
      }
    };

    const stepHydration = () => {
      hydrateRaf = 0;
      if (isD()) return;
      guardMut(() => {
        let budget = 18;
        while (budget > 0 && sparkQueue.length > 0) {
          const it = sparkQueue.pop();
          setSpk(it.trig, it.brand, it.st);
          budget--;
        }
        while (budget > 0 && iconQueue.length > 0) {
          const it = iconQueue.pop();
          if (!ga(it.btn, 'data-ag-cs-icon-injected')) applySingleHostIcon(it.btn, it.iconName, it.origSvg, it.size);
          budget--;
        }
      });
      if (sparkQueue.length > 0 || iconQueue.length > 0) hydrateRaf = rAF(stepHydration);
    };

    const enqueueDeferredIcons = (items) => {
      iconQueue = items;
      if (!isD() && !hydrateRaf) hydrateRaf = rAF(stepHydration);
    };

    const STREAM_THOUGHT_RE = /(?:\.\.\.|…)\s*$|正在思考|思考中/i;
    const isStrmT = (trig, isLast) => {
      if (ga(trig, 'data-op-thought-state') === 'streaming') return true;
      if (!isLast) return false;
      return STREAM_THOUGHT_RE.test(String(trig.textContent || '').trim());
    };

    const resBrand = (sc, pmi, pmm) =>
      (pmm?.get?.(sc)?.brand) ||
      (sc && sc !== docOf() && ga(sc, 'data-ag-cs-pane-camp')) ||
      (sc?.closest && ga(sc.closest('[data-tiling-pane]'), 'data-ag-cs-pane-camp')) ||
      (sc && sc !== docOf() ? ga(qs(sc, '[data-testid="model-selector-trigger"] .ag-cs-model-glyph'), 'data-brand') : '') ||
      pmi?.brand || 'gemini';

    const syncThinkingSparks = (pmi, pmm = null) => {
      const d = docOf();
      if (isD() || !d) return;
      const vs = findFormalConvViews(), scs = vs.length ? vs : [d], mv = ga(d.documentElement, 'data-ag-cs-accent') === 'mono' ? '1' : '0', pend = [];
      for (const sc of scs) {
        const br = resBrand(sc, pmi, pmm), sig = `${br}:${mv}`, trs = qsa(sc, '[data-testid="thinking-collapsible-trigger"]'), n = trs.length;
        for (let i = 0; i < n; i++) {
          const tr = trs[i], last = i === n - 1, exp = ga(tr, 'data-op-thought-state') === 'streaming';
          if (!exp && !last && spkCache.get(tr) === sig) continue;
          const sp = clHas(tr.firstElementChild, 'ag-cs-thinking-spark') ? tr.firstElementChild : qs(tr, '.ag-cs-thinking-spark');
          const st = exp || isStrmT(tr, last) ? 'streaming' : 'done';
          if (sp && ga(sp, 'data-brand') === br && ga(sp, 'data-state') === st && ga(sp, 'data-mono') === mv && (st === 'streaming') === ha(tr, 'data-ag-cs-spark-streaming')) {
            if (st === 'done' && !last) spkCache.set(tr, sig); else spkCache.delete(tr);
            continue;
          }
          if (st !== 'done') spkCache.delete(tr);
          pend.push({ trig: tr, brand: br, st, isLast: last, sig });
        }
      }
      const runA = (it) => { setSpk(it.trig, it.brand, it.st); if (it.st === 'done' && !it.isLast) spkCache.set(it.trig, it.sig); };
      if (pend.length <= 16 || typeof requestAnimationFrame !== 'function') for (const it of pend) runA(it);
      else {
        const s0 = pend.length - 12;
        for (let i = s0; i < pend.length; i++) runA(pend[i]);
        sparkQueue = pend.slice(0, s0);
        if (!hydrateRaf) hydrateRaf = rAF(stepHydration);
      }
    };

    const clearWorkedForAutoUnfoldAttrs = () => {
      const d = docOf();
      if (!d) return;
      for (const el of qsa(d, '[data-ag-cs-auto-unfolded]')) ra(el, 'data-ag-cs-auto-unfolded');
      for (const el of qsa(d, '[data-ag-cs-outer-open]')) ra(el, 'data-ag-cs-outer-open');
    };

    const clkG = (bs) => {
      if (!bs?.length) return;
      const sn = new Map(), d = docOf(), pA = d?.activeElement;
      for (const b of bs) {
        if (!b || !isConn(b) || ga(b, 'aria-expanded') !== 'false') continue;
        const v = closestOf(b, VP_SEL);
        if (v && isConn(v)) {
          let s = sn.get(v);
          if (!s) { const pm = vpMax(v), pt = v.scrollTop || 0; s = { pm, pt, pin: isConvEntryPinActive(v) || pm - pt <= 140, vr: rectOf(v), ab: 0 }; sn.set(v, s); }
          const br = rectOf(b);
          if (s.vr?.height > 0 && br && br.top < s.vr.top + s.vr.height * 0.45) s.ab++;
        }
        try { b.click(); } catch {}
      }
      const cA = d?.activeElement;
      if (cA && cA !== pA && bs.includes(cA)) try { cA.blur?.(); } catch {}
      if (!sn.size) return;
      const rst = () => {
        if (isD()) return;
        for (const [v, s] of sn) if (isConn(v)) {
          const nm = vpMax(v), dl = nm - s.pm;
          if (s.pin && !(pUM && pLV === v)) { if ((v.scrollTop || 0) < nm - 1) v.scrollTop = nm; if (isConvEntryPinActive(v)) armQ(260); }
          else if (dl > 0 && s.ab > 0) v.scrollTop = s.pt + dl;
        }
      };
      rst(); if (typeof requestAnimationFrame === 'function') rAF(rst);
    };
    const pumpUnfoldQueue = () => {
      unfoldRaf = 0;
      if (isD() || !unfoldQueue.length) { unfoldQueue = []; return; }
      const b = [];
      while (unfoldQueue.length && b.length < 2) { const c = unfoldQueue.pop(); if (c && isConn(c) && ga(c, 'aria-expanded') === 'false' && typeof c.click === 'function') b.push(c); }
      if (b.length) clkG(b);
      if (unfoldQueue.length && !isD()) unfoldRaf = rAF(pumpUnfoldQueue);
    };
    const procWf = (btn, pendingClicks) => {
      if (!isConn(btn)) return;
      const expanded = ga(btn, 'aria-expanded') === 'true';
      let scope = btn.nextElementSibling;
      if (!scope) { let sib = btn.nextSibling; while (sib && sib.nodeType && sib.nodeType !== 1) sib = sib.nextSibling; scope = sib || null; }
      if (!scope) scope = peOf(btn);
      const innerBtns = qsa(scope, '[data-testid="tool-group-collapsible"]');
      if (expanded) {
        setA(btn, 'data-ag-cs-outer-open', '1');
        for (const cb of innerBtns) if (cb !== btn && ga(cb, 'data-ag-cs-auto-unfolded') !== '1') {
          sa(cb, 'data-ag-cs-auto-unfolded', '1');
          if (ga(cb, 'aria-expanded') === 'false' && typeof cb.click === 'function') pendingClicks.push(cb);
        }
      } else if (ga(btn, 'data-ag-cs-outer-open') === '1') {
        ra(btn, 'data-ag-cs-outer-open');
        for (const cb of innerBtns) ra(cb, 'data-ag-cs-auto-unfolded');
        const p = peOf(btn);
        if (p && p !== scope) for (const el of qsa(p, '[data-ag-cs-auto-unfolded]')) ra(el, 'data-ag-cs-auto-unfolded');
      }
    };
    const flushUnf = (pendingClicks) => {
      if (!pendingClicks.length) return;
      if (pendingClicks.length <= 2 || typeof requestAnimationFrame !== 'function') { clkG(pendingClicks); return; }
      const nb = [];
      for (let k = 0; k < 2 && pendingClicks.length; k++) nb.push(pendingClicks.pop());
      clkG(nb);
      unfoldQueue.push(...pendingClicks);
      if (!unfoldRaf && unfoldQueue.length) unfoldRaf = rAF(pumpUnfoldQueue);
    };

    const syncWorkedForAutoUnfold = (dirty = null) => {
      const d = docOf();
      if (isD()) return clearWorkedForAutoUnfoldAttrs();
      if (!d) return;
      const pc = [];
      if (dirty?.size) {
        const os = new Set();
        for (const n of dirty) {
          if (!isConn(n)) continue;
          if (ga(n, 'data-testid') === 'worked-for-collapsible') { os.add(n); continue; }
          const pv = n.previousElementSibling;
          if (pv && ga(pv, 'data-testid') === 'worked-for-collapsible') os.add(pv);
          for (const b of qsa(n, '[data-testid="worked-for-collapsible"]')) os.add(b);
          for (let c = peOf(n); c && c !== d.body; c = peOf(c)) {
            const s = c.previousElementSibling;
            if (s && ga(s, 'data-testid') === 'worked-for-collapsible') { os.add(s); break; }
          }
        }
        for (const b of os) procWf(b, pc);
      } else for (const b of qsa(d, '[data-testid="worked-for-collapsible"]')) procWf(b, pc);
      flushUnf(pc);
    };

    const scheduleWorkedForClickSync = () => {
      if (isD()) return;
      if (wfClickTimer) CT(wfClickTimer);
      wfClickTimer = ST(() => {
        wfClickTimer = 0;
        if (!isD()) syncWorkedForAutoUnfold();
      }, 28);
    };

    function findFormalConvViews() {
      const d = docOf(), out = [];
      for (const cv of qsa(d, '[data-testid="conversation-view"]')) {
        if (closestOf(cv, '[data-testid="subagent-tab-conversation"]')) continue;
        if (closestOf(cv, '.agy-home') || qs(cv, '.agy-home')) continue;
        if (cv.hidden === true || cv.style?.display === 'none') continue;
        out.push(cv);
      }
      return out;
    }

    function findFormalConvView() {
      const d = docOf(), views = findFormalConvViews();
      if (views.length <= 1) return views[0] || null;
      const actCv = closestOf(d?.activeElement, '[data-testid="conversation-view"]');
      return actCv && views.includes(actCv) ? actCv : views[0];
    }

    const sampleHomeComposerRect = () => {
      const home = qs(docOf(), '.agy-home');
      if (!home) return null;
      const r = rectOf(qs(home, '[data-testid="agent-input-box"]') || qs(home, '.surface-composer-card'));
      if (r && r.width > 0 && r.height > 0) {
        lastHomeRect = { left: r.left, top: r.top, width: r.width, height: r.height };
      }
      return lastHomeRect;
    };

    const triggerHomeLiftoffRippleBurst = () => {
      const home = qs(docOf(), '.agy-home');
      if (!home) return;
      const r = sampleHomeComposerRect();
      if (isMU() && rippleCtl) rippleCtl.triggerLiftoffBurst(r);
    };

    const mkLiftB = (c) => {
      const b = qs(c, '[data-testid="user-message-bubble"]');
      if (!b) return false;
      sa(b, 'data-ag-cs-liftoff-bubble', '1');
      scheduleTransient(() => { if (isConn(b)) ra(b, 'data-ag-cs-liftoff-bubble'); }, 500);
      return true;
    };
    const triggerHeroALiftoff = (fc, mr = null) => {
      const d = docOf();
      if (!isMU() || !fc || !d) return;
      const now = nowOf();
      for (const n of qsa(d, '.ag-cs-liftoff-veil')) n.remove();
      const v = mkOwned(d, 'div', 'ag-cs-liftoff-veil'), r = lastHomeRect;
      setProp(v, '--ag-lift-x', r?.width > 0 ? `${M.round(r.left + r.width / 2)}px` : '50%');
      setProp(v, '--ag-lift-y', r?.height > 0 ? `${M.round(r.top + r.height / 2)}px` : '58%');
      const rg = d.createElement('div'); rg.className = 'ag-cs-liftoff-ring'; v.appendChild(rg);
      d.body?.appendChild(v); scheduleTransient(() => v.remove(), 540);
      const ib = qs(fc, '[data-testid="agent-input-box"]') || qs(d, '[data-testid="agent-input-box"]');
      if (ib && typeof motionEngine?.spring === 'function') {
        const nr = mr || rectOf(ib), rd = r && nr ? M.round(r.top - nr.top) : -160;
        const hf = Boolean(closestOf(ib, '.animate-fade-in, .no-transitions') || closestOf(fc, '.no-transitions') || clHas(fc, 'no-transitions'));
        const dy = hf ? M.max(-24, M.min(0, rd === 0 ? -10 : M.round(rd * 0.08))) : M.max(-420, M.min(-24, rd === 0 ? -140 : rd));
        try { motionEngine.spring(ib, [{ transform: `translateY(${dy}px) scale(${hf ? 0.996 : 0.985})` }, { transform: 'translateY(0) scale(1)' }], { durationMs: hf ? 220 : 480, stiffness: hf ? 360 : 310, damping: hf ? 32 : 28, slot: 'liftoff-dock' }); } catch {}
      }
      liftBubAt = mkLiftB(fc) ? 0 : now + 900;
      convAuraCtl?.triggerLiftoffEbb?.(now);
    };
    const triggerHeroBHomeReturn = () => {
      const h = isMU() ? qs(docOf(), '.agy-home') : null;
      if (!h) return;
      rippleCtl?.triggerTideSwell?.();
      if (typeof motionEngine?.stagger === 'function') {
        const it = [qs(h, '[data-testid="home-greeting"]'), qs(h, '.ag-cs-home-panel'), qs(h, '[data-testid="agent-input-box"]')].filter(Boolean);
        if (it.length) try { motionEngine.stagger(it, [{ transform: 'translateY(8px)' }, { transform: 'translateY(0px)' }], { durationMs: 200, delayStep: 20, stepMs: 20, stiffness: 360, damping: 32, slot: 'home-return' }); } catch {}
      }
    };

    const sbOff = (d) => !d || ga(d.documentElement, 'data-ag-cs-sidebar') === 'off';
    const mkRun = (r, c, now) => { runRowM.set(r, now); if (c) runCidM.set(c, now); };
    const heldAt = (r, c) => M.max(c ? runCidM.get(c) || 0 : 0, runRowM.get(r) || 0);
    const setAttrSafe = (el, k, v) => (typeof setA === 'function' ? setA(el, k, v) : ga(el, k) !== v && sa(el, k, v));
    const rowCid = (r) => String(ga(r, 'data-cascade-id') || ga(qs(r, 'a[href]'), 'href') || ga(r, 'data-conversation-id') || '').trim();
    const isStopBtn = (b) => {
      if (!b || b.hidden === true || ga(b, 'aria-hidden') === 'true' || ga(b, 'aria-haspopup') || ga(b, 'role') === 'checkbox') return false;
      const tid = String(ga(b, 'data-testid') || '').trim(), lbl = String(ga(b, 'aria-label') || ga(b, 'title') || '').trim();
      return !NON_STOP_RE.test(tid + ' ' + lbl) && Boolean((tid && (STOP_TID_RE.test(tid) || STOP_CAMEL_RE.test(tid))) || (lbl && STOP_LABEL_RE.test(lbl)) || qs(b, '.lucide-square,.lucide-circle-stop'));
    };
    const isSidebarRowRunning = (r) => {
      if (!r) return false;
      if (qs(r, '[data-testid="status-loading-spinner"]')) return true;
      for (const b of typeof r.getElementsByTagName === 'function' ? [...r.getElementsByTagName('button'), ...qsa(r, '[role="button"]')] : qsa(r, 'button, [role="button"]')) if (isStopBtn(b)) return true;
      return false;
    };
    const pruneCid = (now) => {
      for (const [k, ts] of runCidM) if (now - ts > SIDEBAR_RUN_HOLD_MS) runCidM.delete(k);
      for (let n = runCidM.size - 256; n > 0; n--) runCidM.delete(runCidM.keys().next().value);
    };
    const schedRun = (ms) => {
      if (isD() || runHoldTimer) return;
      runHoldTimer = ST(() => {
        runHoldTimer = 0; const d = docOf();
        if (isD() || sbOff(d)) return;
        const now = nowOf(); pruneCid(now);
        let minR = Infinity;
        guardMut(() => {
          for (const r of qsa(d, '[data-testid="conversation-row-sidebar"]')) {
            const c = rowCid(r);
            if (isSidebarRowRunning(r)) { mkRun(r, c, now); setAttrSafe(r, 'data-ag-cs-row-running', '1'); continue; }
            const lt = heldAt(r, c), rm = lt > 0 ? SIDEBAR_RUN_HOLD_MS - (now - lt) : -1;
            if (rm > 0) { if (rm < minR) minR = rm; setAttrSafe(r, 'data-ag-cs-row-running', '1'); }
            else { if (c && runCidM.get(c) === lt) runCidM.delete(c); runRowM.delete(r); if (ha(r, 'data-ag-cs-row-running')) ra(r, 'data-ag-cs-row-running'); }
          }
        });
        if (isFin(minR)) schedRun(minR);
      }, M.max(24, M.min(SIDEBAR_RUN_HOLD_MS + 40, M.ceil(ms) + 16)));
    };
    const resSbRun = (r, domR, now) => {
      const c = rowCid(r);
      if (domR) { mkRun(r, c, now); return true; }
      const lt = heldAt(r, c);
      if (lt > 0) {
        const el = now - lt;
        if (el >= 0 && el <= SIDEBAR_RUN_HOLD_MS) { schedRun(SIDEBAR_RUN_HOLD_MS - el); return true; }
        if (c && runCidM.get(c) === lt) runCidM.delete(c);
        runRowM.delete(r);
      }
      return false;
    };
    const lockSidebarRowRunningOnPointerDown = (r) => {
      if (!r || sbOff(docOf())) return false;
      const now = nowOf(), c = rowCid(r), ht = heldAt(r, c);
      if (!ha(r, 'data-ag-cs-row-running') && !isSidebarRowRunning(r) && !(ht > 0 && now - ht <= SIDEBAR_RUN_HOLD_MS)) return false;
      mkRun(r, c, now); guardMut(() => setAttrSafe(r, 'data-ag-cs-row-running', '1')); schedRun(SIDEBAR_RUN_HOLD_MS);
      return true;
    };
    const stampSidebarRowRunningImmediate = (r) => {
      if (!r || sbOff(docOf())) return false;
      const run = resSbRun(r, isSidebarRowRunning(r), nowOf());
      if (run) guardMut(() => setAttrSafe(r, 'data-ag-cs-row-running', '1'));
      return run;
    };
    const measureSidebarSelectionSnapshot = () => {
      const rows = qsa(docOf(), '[data-testid="conversation-row-sidebar"]');
      if (!rows.length) return { e: true };
      const now = nowOf(); pruneCid(now);
      let selIdx = -1, selRow = null, selRun = false, batchRun = null;
      const states = [], listP = rows.length > 1 ? peOf(rows[0]) : null;
      if (listP && typeof listP.getElementsByTagName === 'function' && AF(rows).every((r) => peOf(r) === listP)) {
        batchRun = new Set();
        const mr = (n) => { const r = closestOf(n, '[data-testid="conversation-row-sidebar"]'); if (r) batchRun.add(r); };
        for (const sp of qsa(listP, '[data-testid="status-loading-spinner"]')) mr(sp);
        for (const b of [...listP.getElementsByTagName('button'), ...qsa(listP, '[role="button"]')]) if (isStopBtn(b)) mr(b);
      }
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i], run = resSbRun(r, batchRun ? batchRun.has(r) : isSidebarRowRunning(r), now);
        if (selIdx < 0 && ga(r, 'data-selected') === 'true') { selIdx = i; selRow = r; selRun = run; }
        states.push([r, run]);
      }
      if (!selRow) return { e: false, i: -1, cid: '', r: null, rn: false, s: null, l: null, t: 0, st: states };
      const curCid = rowCid(selRow);
      if ((sbInit && sbRect && (curCid && sbCid ? curCid === sbCid : selIdx === sbIndex)) || getBus()?.isSkipped?.(selRow)) return { e: false, i: selIdx, cid: curCid, r: selRow, rn: selRun, s: sbRect, st: states };
      const list = peOf(selRow), rr = rectOf(selRow), lr = rectOf(list), stTop = list ? list.scrollTop || 0 : 0;
      const snap = rr ? { left: rr.left, top: rr.top, width: rr.width, height: rr.height, ry: lr ? rr.top - lr.top + stTop : rr.top, rx: lr ? rr.left - lr.left : rr.left } : null;
      return { e: false, i: selIdx, cid: curCid, r: selRow, rn: selRun, s: snap, l: lr, t: stTop, st: states };
    };
    const rstSb = () => { sbInit = false; sbIndex = -1; sbCid = ''; sbRect = null; sbRunning = false; };
    const syncSidebarSelectionGlide = (snap) => {
      const d = docOf();
      if (!snap || !d) return;
      if (sbOff(d)) {
        for (const n of qsa(d, '.ag-cs-sidebar-glide-pill')) n.remove();
        if (snap.st) for (const [row] of snap.st) if (ha(row, 'data-ag-cs-row-running')) ra(row, 'data-ag-cs-row-running');
        if (runHoldTimer) { CT(runHoldTimer); runHoldTimer = 0; }
        runCidM.clear();
        return rstSb();
      }
      if (snap.st) for (const [row, run] of snap.st) { if (run) setAttrSafe(row, 'data-ag-cs-row-running', '1'); else if (ha(row, 'data-ag-cs-row-running')) ra(row, 'data-ag-cs-row-running'); }
      if (snap.e) return rstSb();
      const { i: selIdx, cid: curCid, r: selRow, rn: selRun, s: curSnap, l: listRect, t: scrollTop } = snap;
      if (!selRow) return;
      const targetRun = Boolean(selRun || ha(selRow, 'data-ag-cs-row-running'));
      if (!sbInit) { sbInit = true; sbIndex = selIdx; sbCid = curCid; sbRect = curSnap; sbRunning = targetRun; return; }
      const sessionChanged = curCid && sbCid ? curCid !== sbCid : selIdx !== sbIndex;
      if (sbIndex >= 0 && selIdx >= 0 && sessionChanged && sbRect && curSnap && !(supMotAt > nowOf())) {
        const fromRect = listRect ? { left: listRect.left + sbRect.rx, top: listRect.top + sbRect.ry - scrollTop, width: sbRect.width, height: sbRect.height } : sbRect;
        if (isMS()) {
          for (const n of qsa(d, '.ag-cs-sidebar-glide-pill')) n.remove();
          const pill = mkOwned(d, 'div', 'ag-cs-sidebar-glide-pill');
          if (targetRun) sa(pill, 'data-ag-cs-glide-running', '1'); else if (sbRunning) sa(pill, 'data-ag-cs-glide-from-running', '1');
          for (const s of `position:fixed|z-index:38|pointer-events:none|left:${M.round(curSnap.left)}px|top:${M.round(curSnap.top)}px|width:${M.round(curSnap.width)}px|height:${M.round(curSnap.height)}px`.split('|')) { const i = s.indexOf(':'); setProp(pill, s.slice(0, i), s.slice(i + 1)); }
          d.body?.appendChild(pill);
          try { motionEngine?.glideIndicator?.(pill, fromRect, curSnap, { durationMs: 240, stiffness: 390, damping: 32, mass: 0.9 }); } catch {}
          scheduleTransient(() => pill.remove(), 260);
        }
        if (isMU()) {
          const dir = selIdx < sbIndex ? 'down' : 'up';
          const vps = AF(qsa(d, '[data-testid="autoscroll-viewport"]')).filter((vp) => !closestOf(vp, '[data-testid="subagent-tab-conversation"]'));
          const matchedVp = curCid ? vps.find((vp) => ga(closestOf(vp, '[data-cascade-id]'), 'data-cascade-id') === curCid) : null;
          for (const vp of matchedVp ? [matchedVp] : vps) {
            sa(vp, 'data-ag-cs-stage-glide', dir);
            const kids = vp.children ? AF(vp.children) : [], glideKids = kids.slice(M.max(0, kids.length - 3));
            for (const ch of glideKids) sa(ch, 'data-ag-cs-glide-item', dir);
            scheduleTransient(() => {
              if (isConn(vp) && ga(vp, 'data-ag-cs-stage-glide') === dir) ra(vp, 'data-ag-cs-stage-glide');
              for (const ch of glideKids) if (isConn(ch) && ga(ch, 'data-ag-cs-glide-item') === dir) ra(ch, 'data-ag-cs-glide-item');
            }, 220);
          }
        }
      }
      sbIndex = selIdx; sbCid = curCid; sbRect = curSnap; sbRunning = targetRun;
    };

    const applyCaustic = (el) => {
      if (!el || !isMU()) return;
      sa(el, 'data-ag-cs-caustic', '1');
      scheduleTransient(() => {
        if (isConn(el)) ra(el, 'data-ag-cs-caustic');
      }, 920);
    };

    const getBus = () => G.__agDomBus || G.__agPrismDomBus || (typeof window !== 'undefined' && (window.__agDomBus || window.__agPrismDomBus)) || null;
    const measureVisibleChangedHeaders = () => {
      const out = [], bus = getBus();
      const vh = typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : 1080;
      for (const hdr of qsa(docOf(), '[data-testid="changed-files-card-header"]')) {
        if (seenHeaders.has(hdr) || bus?.isSkipped?.(hdr)) continue;
        const r = rectOf(hdr);
        if (!r || r.height <= 0 || (r.bottom > 0 && r.top < vh)) out.push(hdr);
      }
      return out;
    };

    const syncHeaderOpenStates = (scope = null) => {
      const root = scope || docOf();
      if (!root) return;
      for (const hdr of qsa(root, '[data-testid="changed-files-card-header"]')) {
        const next = hdr.nextElementSibling;
        if (next && tagOf(next) === 'DIV') setA(hdr, 'data-ag-cs-hdr-open', '1');
        else if (ha(hdr, 'data-ag-cs-hdr-open')) ra(hdr, 'data-ag-cs-hdr-open');
      }
    };

    const applyCausticHeaders = (list) => {
      let sawNew = false;
      for (const hdr of list) {
        if (seenHeaders.has(hdr)) continue;
        seenHeaders.add(hdr); sawNew = true;
        if (isMU()) applyCaustic(hdr);
      }
      if (sawNew) notifyMascot('files-changed');
    };

    const syncHeroCCaustics = (measuredHeaders) => {
      const d = docOf(), now = nowOf(), bus = getBus();
      syncHeaderOpenStates(d);
      if (measuredHeaders) applyCausticHeaders(measuredHeaders);
      else if (bus?.measure && bus?.mutate) {
        let mHdrs = null;
        bus.measure('sc:caustics-r', () => { mHdrs = measureVisibleChangedHeaders(); });
        bus.mutate('sc:caustics-w', () => { if (!isD() && mHdrs?.length) guardMut(() => applyCausticHeaders(mHdrs)); });
      } else applyCausticHeaders(measureVisibleChangedHeaders());

      const PANE_RUN_SEL = '[data-testid="input-cancel-button"],[data-testid="stop-button"],[data-testid="cancel-button"],[data-testid="agent-loading"],[data-testid="thinking-collapsible-trigger"][data-op-thought-state="streaming"]';
      const views = findFormalConvViews();
      let paneHit = false;
      if (views.length > 1) for (const cv of views) {
        const rp = Boolean(qs(cv, PANE_RUN_SEL)), ps = paneRunState.get(cv);
        if (!ps) paneRunState.set(cv, { w: rp, t: rp ? now : 0 });
        else if (rp && !ps.w) { ps.w = true; ps.t = now; }
        else if (!rp && ps.w) {
          ps.w = false; const dur = ps.t > 0 ? now - ps.t : 0; ps.t = 0;
          if (dur >= 6000 && isMU()) { const c = qs(cv, '[data-testid="agent-input-box"] .surface-composer-card'); if (c && !closestOf(c, '[data-testid="subagent-tab-conversation"]')) { applyCaustic(c); paneHit = true; } }
        }
      }
      const runNow = isConvRunning();
      if (!runInit) { runInit = true; wasRunning = runNow; runStartAt = runNow ? now : 0; }
      else if (runNow && !wasRunning) { wasRunning = true; runStartAt = now; }
      else if (!runNow && wasRunning) {
        wasRunning = false; const elapsed = runStartAt > 0 ? now - runStartAt : 0; runStartAt = 0;
        const ap = convAuraCtl?.getInstance?.()?.phase || '', errDom = qs(d, '[data-testid="conversation-view"] [data-testid="agent-error-banner"], [data-testid="conversation-view"] [data-testid="error-message"]');
        if (ap === 'error-halted' || errDom) { convAuraCtl?.triggerErrorHalted?.(now); notifyMascot('streamDone', { error: true, durationMs: elapsed }); }
        else {
          if (!paneHit && elapsed >= 6000 && isMU()) for (const c of qsa(d, '[data-testid="agent-input-box"] .surface-composer-card')) if (!closestOf(c, '[data-testid="subagent-tab-conversation"]')) applyCaustic(c);
          if (elapsed >= 15000) {
            convAuraCtl?.triggerLongTaskComplete?.(now);
            notifyMascot('aura-complete', { durationMs: elapsed });
          } else {
            notifyMascot('complete', { durationMs: elapsed });
          }
          const warnBar = qs(d, '[data-ag-prism-pulse-bar][data-pv-warn="1"], #ag-prism-pulse-bar[data-pv-warn="1"]');
          if (warnBar && now - lastVialHighNotifyAt >= 600000) {
            lastVialHighNotifyAt = now;
            notifyMascot('vial-high', { fraction: 0.8 });
          }
        }
      }
    };

    const triggerHeroDFiberPulse = (card, modelBtn, brand) => {
      if (!card || !isMU()) return;
      const camp = brand === 'antigravity' || brand === 'claude' || brand === 'openai' ? brand : 'gemini';
      if (fiberTimer) {
        CT(fiberTimer);
        tTmr.delete(fiberTimer);
        fiberTimer = 0;
      }
      sa(card, 'data-ag-cs-fiber-camp', camp);
      fiberTimer = scheduleTransient(() => {
        fiberTimer = 0;
        if (isConn(card)) ra(card, 'data-ag-cs-fiber-camp');
      }, 480);
      const glyph = qs(modelBtn, '.ag-cs-model-glyph');
      if (glyph && typeof motionEngine?.spring === 'function') {
        try {
          motionEngine.spring(
            glyph,
            [
              { transform: 'scale(0.84) rotate(-8deg)' },
              { transform: 'scale(1.12) rotate(3deg)' },
              { transform: 'scale(1) rotate(0deg)' },
            ],
            { stiffness: 420, damping: 22, slot: 'fiber-focus' }
          );
        } catch {}
      }
    };

    const triggerHeroESonar = (navTurn) => {
      if (!navTurn || !isMU()) return;
      const conv = closestOf(navTurn, '[data-testid="conversation-view"]') || findFormalConvView();
      if (!conv) return;
      let ts = qsa(conv, '[data-testid="user-input-step"]');
      if (!ts.length) ts = qsa(conv, '[data-testid="conversation-turn"]');
      if (!ts.length) ts = qsa(conv, '[data-testid="user-message-bubble"]');
      if (!ts.length) return;
      let ix = -1;
      const rw = ga(navTurn, 'data-turn-index') ?? ga(navTurn, 'data-index');
      if (rw != null && /^\d+$/.test(String(rw).trim())) ix = parseInt(String(rw).trim(), 10);
      else if (ga(navTurn, 'data-testid') === 'conversation-navigator-group') ix = 0;
      else {
        const nr = closestOf(navTurn, '[data-testid="conversation-navigator"]') || peOf(navTurn);
        if (nr) {
          const sb = AF(qsa(nr, '[data-testid="conversation-navigator-turn"]')), ri = sb.indexOf(navTurn);
          if (ri >= 0) ix = M.min(ts.length - 1, M.max(0, ts.length - sb.length) + ri);
        }
      }
      const tg = ix >= 0 && ix < ts.length ? ts[ix] : null;
      if (!tg) return;
      sa(tg, 'data-ag-cs-sonar', '1');
      scheduleTransient(() => { if (isConn(tg)) ra(tg, 'data-ag-cs-sonar'); }, 720);
    };

    const syncHeroRouteChoreography = (m) => {
      const d = docOf(), inH = m ? m.inHome : Boolean(qs(d, '.agy-home')), fc = m ? m.formalConv : !inH ? findFormalConvView() : null, inFc = Boolean(fc);
      if (inH) { const sh = closestOf(qs(d, '.agy-home'), '.agy-sheet'); if (sh) setA(sh, 'data-ag-cs-home-sheet', '1'); }
      for (const cv of !inH ? findFormalConvViews() : []) {
        const st = peOf(cv); if (st && tagOf(st) === 'DIV') setA(st, 'data-ag-cs-conv-seat', '1');
        const vpP = peOf(qs(cv, '[data-testid="autoscroll-viewport"]'));
        if (vpP && vpP !== cv) setA(vpP, 'data-ag-cs-vp-wrap', '1');
      }
      if (inH && !m?.homeComposerSampled) sampleHomeComposerRect();
      if (!heroState.routeInitialized) { heroState.routeInitialized = true; heroState.wasInHome = inH; heroState.wasInFormalConv = inFc; }
      else {
        if (!(supMotAt > nowOf())) {
          if (heroState.wasInHome && !inH && inFc) triggerHeroALiftoff(fc, m?.convInputRect || null);
          else if (heroState.wasInFormalConv && !heroState.wasInHome && inH) triggerHeroBHomeReturn();
        } else liftBubAt = 0;
        heroState.wasInHome = inH; heroState.wasInFormalConv = inFc;
      }
      if (liftBubAt > 0 && fc) { if (nowOf() <= liftBubAt) { if (mkLiftB(fc)) liftBubAt = 0; } else liftBubAt = 0; }
      if (m?.sidebarSnap) syncSidebarSelectionGlide(m.sidebarSnap);
      if (!m || m.checkCaustics !== false) syncHeroCCaustics(m?.visibleChangedHeaders);
    };

    const isBlockCode = (el, stopAt) => {
      if (!isEl(el)) return false;
      const t = tagOf(el);
      if (t === 'PRE' || clHas(el, 'code-block') || clHas(el, 'code-line')) return true;
      if (t === 'CODE') {
        let p = peOf(el);
        while (p && p !== stopAt) {
          if (tagOf(p) === 'PRE' || clHas(p, 'code-block')) return true;
          p = peOf(p);
        }
      }
      return false;
    };

    const insideCodeOrTable = (node, stopAt) => {
      let cur = isEl(node) ? node : peOf(node);
      while (cur && cur !== stopAt) {
        if (TABLE_TAGS.has(tagOf(cur)) || isBlockCode(cur, stopAt)) return cur;
        cur = peOf(cur);
      }
      return null;
    };

    const findRowAnc = (node, stopAt) => {
      let cur = isEl(node) ? node : peOf(node);
      while (cur && cur !== stopAt) {
        if (tagOf(cur) === 'TR') return cur;
        cur = peOf(cur);
      }
      return null;
    };

    const flushAllStreamArtifacts = (immediate = true) => {
      scannedNodes = new WeakSet(); seenBlocks = new WeakSet();
      const force = immediate || !canStreamMotion() || isD();
      if (force) { clearHighlightFade(); if (sweepTimer) { CT(sweepTimer); sweepTimer = 0; } }
      guardMut(() => {
        const d = docOf();
        if (force) {
          for (const [el, map] of expCls.entries()) for (const cls of map.keys()) clRm(el, cls);
          expCls.clear();
          if (d) for (const cls of ['ag-cs-stream-chunk', 'ag-cs-thought-chunk', 'ag-cs-code-scan']) for (const el of qsa(d, '.' + cls)) clRm(el, cls);
        }
        if (!d) return;
        for (const el of qsa(d, '[data-ag-cs-thought-streaming]')) ra(el, 'data-ag-cs-thought-streaming');
        if (!isMU()) {
          for (const el of qsa(d, '.ag-cs-liftoff-veil')) el.remove();
          for (const s of 'liftoff-bubble|caustic|fiber-camp|stage-glide|glide-item|sonar'.split('|')) for (const el of qsa(d, `[data-ag-cs-${s}]`)) ra(el, 'data-ag-cs-' + s);
        }
        if (!isMS()) for (const el of qsa(d, '.ag-cs-sidebar-glide-pill')) el.remove();
      });
    };

    const PROSE_SEL = '[data-testid="planner-response-text"],[data-testid="agent-response"] [data-markdown-root]';

    const findThB = (node) => {
      const body = docOf()?.body;
      let cur = isEl(node) ? node : peOf(node);
      while (cur && cur !== body) {
        if (ga(cur, 'data-ag-cs-thought-streaming') === '1') return cur;
        const tid = ga(cur, 'data-testid');
        if (
          tid === 'planner-response-text' ||
          tid === 'agent-response' ||
          tid === 'background-task-command' ||
          tid === 'tool-group-collapsible' ||
          tid === 'conversation-view' ||
          tid === 'autoscroll-viewport'
        ) {
          return null;
        }
        const prev = cur.previousElementSibling;
        if (prev && ga(prev, 'data-testid') === 'thinking-collapsible-trigger' && ga(prev, 'aria-expanded') === 'true') return cur;
        cur = peOf(cur);
      }
      return null;
    };

    const mkCls = (el, cls, dur = 300) => {
      if (!el?.[K_CL] || clHas(el, cls)) return false;
      guardMut(() => el[K_CL].add(cls));
      let m = expCls.get(el);
      if (!m) { m = new Map(); expCls.set(el, m); }
      m.set(cls, Date.now() + dur);
      if (!sweepTimer) sweepTimer = ST(flushExp, dur);
      return true;
    };

    const fadeLeaf = (node, now, max = 4) => {
      if (!node || isTI(node)) return;
      let c = 0;
      const walk = (cur) => {
        if (!cur || c >= max || isTI(cur)) return;
        if (cur.nodeType === 3) { const s = cur.data ?? cur.nodeValue ?? ''; textLenMap.set(cur, s.length); if (s.length) { enqFd(cur, 0, s.length, now); c++; } return; }
        if (isEl(cur) && cur.childNodes) for (let i = 0; i < cur.childNodes.length && c < max; i++) walk(cur.childNodes[i]);
      };
      walk(node);
    };

    const onStreamMutations = (mutations) => {
      if (isD() || streamMutating || !canStreamMotion()) return;
      const now = nowOf();
      let newB = 0;
      for (const m of mutations) {
        if (!m || isThoughtMutationRecord(m)) continue;
        const target = m.target;
        if (!target || isTI(target)) continue;
        const baseEl = isEl(target) ? target : peOf(target);
        if (!baseEl || getBus()?.isSkipped?.(baseEl) || closestOf(baseEl, '.ag-prism-thought-overlay, .ag-cs-smooth-caret, .ag-cs-crab, .ag-cs-conv-aura-host, [data-testid="agent-input-box"], script, style')) continue;
        if (m.type === 'characterData') {
          if (target.nodeType !== 3) continue;
          const nL = (target.data ?? target.nodeValue ?? '').length, pL = textLenMap.get(target);
          textLenMap.set(target, nL);
          if (pL !== undefined ? nL <= pL : nL <= 0 || nL > 28) continue;
          const tb = findThB(baseEl);
          if (tb) { if (isMT(tb)) continue; } else if (!closestOf(baseEl, PROSE_SEL)) continue;
          enqFd(target, pL !== undefined ? pL : 0, nL, now);
          continue;
        }
        if (m.type !== 'childList' || !m.addedNodes?.length) continue;
        const inA = Boolean(closestOf(baseEl, '.ag-cs-stream-chunk, .ag-cs-thought-chunk')), tb = findThB(target);
        if (tb) {
          if (isMT(tb)) continue;
          for (const a of m.addedNodes) {
            if (isTI(a)) continue;
            if (a.nodeType === 3) fadeLeaf(a, now, 1);
            else if (isEl(a)) {
              if (inA || INLINE_TAGS.has(tagOf(a))) fadeLeaf(a, now, 4);
              else if (!seenBlocks.has(a) && newB < 4) { seenBlocks.add(a); newB++; snapTextLens(a, 12); mkCls(a, 'ag-cs-thought-chunk', 290); }
            }
          }
          continue;
        }
        const pr = closestOf(baseEl, PROSE_SEL);
        if (!pr) continue;
        const ctx = insideCodeOrTable(target, pr), isTbl = ctx && TABLE_TAGS.has(tagOf(ctx));
        const mkC = (el, lim) => { scannedNodes.add(el); lastCodeAt = now; snapTextLens(el, lim); mkCls(el, 'ag-cs-code-scan', 240); };
        for (const a of m.addedNodes) {
          if (a.nodeType === 3) { fadeLeaf(a, now, 1); continue; }
          if (!isEl(a)) continue;
          const tg = tagOf(a);
          if (ctx) {
            if (isTbl) {
              const tr = tg === 'TR' ? a : findRowAnc(a, pr) || findRowAnc(ctx, pr);
              if (tr && !scannedNodes.has(tr) && now - lastCodeAt >= STREAM_BATCH_MS) mkC(tr, 12);
              else fadeLeaf(a, now, 3);
            } else if (tg === 'PRE' || clHas(a, 'code-block')) { if (!scannedNodes.has(a)) mkC(a, 16); }
            else {
              const ln = clHas(a, 'code-line') ? a : closestOf(a, '.code-line') || a;
              if (ln && ln !== pr && tagOf(ln) !== 'PRE' && !clHas(ln, 'code-block') && !scannedNodes.has(ln) && now - lastCodeAt >= STREAM_BATCH_MS) mkC(ln, 8);
              else fadeLeaf(a, now, 3);
            }
          } else if (tg === 'PRE' || tg === 'TABLE' || clHas(a, 'code-block') || clHas(a, 'md-table-host') || clHas(a, 'md-table-frame') || qs(a, 'pre, table, .code-block, .md-table-frame')) {
            if (!scannedNodes.has(a) && now - lastCodeAt >= STREAM_BATCH_MS) mkC(a, 16);
          } else if (inA || (INLINE_TAGS.has(tg) && baseEl !== pr)) fadeLeaf(a, now, 4);
          else if (!seenBlocks.has(a) && newB < 4) { seenBlocks.add(a); newB++; snapTextLens(a, 12); mkCls(a, 'ag-cs-stream-chunk', 310); }
          else fadeLeaf(a, now, 4);
        }
      }
    };
    const setStrmAt = (on) => {
      const h = docOf()?.documentElement;
      if (h) { if (on) { if (ga(h, 'data-ag-cs-stream-active') !== '1' && h.setAttribute) setA(h, 'data-ag-cs-stream-active', '1'); } else if (ha(h, 'data-ag-cs-stream-active') && h.removeAttribute) ra(h, 'data-ag-cs-stream-active'); }
      try { getBus()?.setStreaming?.(on); } catch {}
    };
    const syncDualStreamEngine = () => {
      const run = isConvRunning(), views = run ? findFormalConvViews() : [];
      setStrmAt(run && views.length > 0);
      if (!canStreamMotion() || !run || !views.length) {
        if (streamObs) { try { streamObs.disconnect(); } catch {} streamRoots.clear(); }
        getBus()?.cancelGroup?.('conv:stream'); flushAllStreamArtifacts(!canStreamMotion()); return;
      }
      const tbv = [];
      for (const conv of views) {
        const trs = qsa(conv, '[data-testid="thinking-collapsible-trigger"]');
        tbv.push([conv, trs]);
        for (let i = 0; i < trs.length; i++) {
          const t = trs[i], b = t.nextElementSibling;
          if (!b || tagOf(b) !== 'DIV') continue;
          if (ga(t, 'aria-expanded') === 'true' && isStrmT(t, i === trs.length - 1)) setA(b, 'data-ag-cs-thought-streaming', '1');
          else if (ha(b, 'data-ag-cs-thought-streaming')) ra(b, 'data-ag-cs-thought-streaming');
        }
      }
      if (!streamObs && typeof MutationObserver === 'function') streamObs = new MutationObserver(onStreamMutations);
      if (streamObs && (streamRoots.size !== views.length || views.some((v) => !streamRoots.has(v)))) {
        try {
          streamObs.disconnect(); streamRoots.clear();
          for (const [conv, trs] of tbv) {
            const rs = qsa(conv, PROSE_SEL); if (rs.length) snapTextLens(rs[rs.length - 1], 24);
            const lb = trs[trs.length - 1]?.nextElementSibling; if (lb && !isMT(lb)) snapTextLens(lb, 16);
            streamObs.observe(conv, { childList: true, characterData: true, subtree: true }); streamRoots.add(conv);
          }
        } catch {}
      }
    };
    const resTrig = (t) => {
      const age = t && isFin(t.at) ? nowOf() - t.at : -1;
      if (age < 0 || age > 900) return null;
      if (t.el && !t._measured) {
        t._measured = true;
        if (t.el.isConnected !== false) { const r = rectOf(t.el); if (r?.width > 0 && r.height > 0) { t.x = r.left + r.width / 2; t.y = r.top + r.height / 2; } }
        t.el = null;
      }
      return isFin(t.x) && isFin(t.y) ? t : null;
    };
    const measureNewLensOverlays = () => {
      const d = docOf();
      if (!isMS() || !d) return [];
      const cs = new Set(qsa(d, '.agy-overlay, .agy-fastpick, [data-testid="context-menu-popup"], [data-testid="context-menu-submenu-popup"]'));
      for (const el of qsa(d, '[data-testid="overview-panel"]')) { const p = peOf(el); if (p && tagOf(p) === 'DIV') cs.add(p); }
      const bus = getBus(), fn = [...cs].filter((ov) => !ha(ov, 'data-hover-card-popup') && !seenOverlays.has(ov) && !bus?.isSkipped?.(ov));
      if (!fn.length) return [];
      const t = resTrig(heroState.lastTriggerOrigin);
      return fn.map((ov) => ({ ov, rect: t ? rectOf(ov) : null }));
    };
    const appLens = (list) => {
      if (!list?.length) return;
      const t = resTrig(heroState.lastTriggerOrigin);
      for (const { ov, rect: r } of list) {
        if (seenOverlays.has(ov) || (t && r && (r.width <= 0 || r.height <= 0))) continue;
        seenOverlays.add(ov);
        if (t && r?.width > 0 && r.height > 0) {
          setProp(ov, '--ag-origin-x', `${M.round(M.max(-40, M.min(r.width + 40, t.x - r.left)))}px`);
          setProp(ov, '--ag-origin-y', `${M.round(M.max(-40, M.min(r.height + 40, t.y - r.top)))}px`);
        }
        let idx = 0;
        for (const it of qsa(ov, '[role="option"], [role="menuitem"], [data-testid]')) {
          const rl = ga(it, 'role'), tid = ga(it, 'data-testid') || '';
          if (rl === 'option' || rl === 'menuitem' || tid.startsWith('overview-panel-row-') || tid === 'subagent-node' || tid === 'artifact-row') {
            setProp(it, '--ag-row-i', String(idx++)); setA(it, 'data-ag-row-stagger', '1');
            if (idx >= 12) break;
          }
        }
      }
    };
    const syncLensOverlayOrigins = (mOv) => {
      const d = docOf(); if (!d) return;
      for (const el of qsa(d, '[data-testid="overview-panel"]')) {
        const p = peOf(el);
        if (p && tagOf(p) === 'DIV') { setA(p, 'data-ag-cs-overview-shell', '1'); setA(p, 'data-ag-cs-prism-box', '1'); setA(p, 'data-ag-cs-prism-mirror', '1'); }
      }
      if (!isMS()) return;
      if (mOv) return appLens(mOv);
      const bus = getBus();
      if (bus?.measure && bus?.mutate) {
        let ml = null;
        bus.measure('sc:lens-r', () => { ml = measureNewLensOverlays(); });
        bus.mutate('sc:lens-w', () => { if (!isD() && ml?.length) guardMut(() => appLens(ml)); });
        return;
      }
      appLens(measureNewLensOverlays());
    };
    const scheduleDeferredConvEntry = (fn, ms = 65, f2 = null) => {
      const seq = ++convEntrySeq;
      if (convEntryTimer) CT(convEntryTimer);
      if (convEntryRaf) { cAF(convEntryRaf); convEntryRaf = 0; }
      convEntryTimer = ST(() => {
        convEntryTimer = 0;
        if (isD() || seq !== convEntrySeq) return;
        if (fn() !== false && seq === convEntrySeq && typeof f2 === 'function') convEntryRaf = rAF(() => { convEntryRaf = 0; if (!isD() && seq === convEntrySeq) f2(); });
      }, ms);
    };
    const disconnectStreamObserver = () => {
      setStrmAt(false);
      if (streamObs) { try { streamObs.disconnect(); } catch {} streamObs = null; streamRoots.clear(); }
      flushAllStreamArtifacts(true);
    };
return {
heroState,
scheduleTransient,
clearTransientTimers,
cancelDeferredHydration,
enqueueDeferredIcons,
syncThinkingSparks,
clearWorkedForAutoUnfoldAttrs,
syncWorkedForAutoUnfold,
scheduleWorkedForClickSync,
armConvEntryBottomPin,
isConvEntryPinActive,
findFormalConvView,
findFormalConvViews,
sampleHomeComposerRect,
triggerHomeLiftoffRippleBurst,
triggerHeroDFiberPulse,
triggerHeroESonar,
isSidebarRowRunning,
lockSidebarRowRunningOnPointerDown,
stampSidebarRowRunningImmediate,
measureSidebarSelectionSnapshot,
syncSidebarSelectionGlide,
measureVisibleChangedHeaders,
syncHeaderOpenStates,
syncHeroCCaustics,
syncHeroRouteChoreography,
flushAllStreamArtifacts,
onStreamMutations,
syncDualStreamEngine,
disconnectStreamObserver,
measureNewLensOverlays,
syncLensOverlayOrigins,
scheduleDeferredConvEntry,
suppressEntryMotion(ms) {
supMotAt = M.max(supMotAt, nowOf() + M.max(120, Number(ms) || 900));
liftBubAt = 0;
const d = docOf();
if (d) for (const n of qsa(d, '.ag-cs-liftoff-veil,.ag-cs-sidebar-glide-pill')) n.remove();
},
isEntryMotionSuppressed: () => supMotAt > nowOf(),
isStreamMutating: () => streamMutating,
hasStreamObserver: () => !!(streamObs && streamRoots.size > 0),
stepHighlightFade,
clearHighlightFade,
getHighlightFadeState: () => ({
activeCount: fadeItems.length,
rafActive: !!(fadeRaf || fadeTimer),
buckets: hlBuckets ? hlBuckets.map((h) => h.size ?? 0) : [],
}),
};
};
  const api = { STREAM_BATCH_MS, STREAM_FADE_MS, SIDEBAR_RUN_HOLD_MS, HIGHLIGHT_NAMES, createStreamChoreographyController };
  if (typeof module === 'object' && module.exports) module.exports = api;
  G.__agPrismStreamChoreography = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
