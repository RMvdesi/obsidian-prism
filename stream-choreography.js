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
  const isFn = (v) => typeof v === 'function', isTxt = (n) => n?.nodeType === 3, txtOf = (n) => n?.data ?? n?.nodeValue ?? '';
  const rmAll = (d, s) => { if (d) for (const n of qsa(d, s)) n.remove(); };
  const raAll = (d, a) => { if (d) for (const n of qsa(d, `[${a}]`)) ra(n, a); };
  const mkTag = (d, tag, cls) => { const el = d.createElement(tag); el.className = cls; sa(el, 'aria-hidden', 'true'); sa(el, 'data-ag-no-i18n', ''); sa(el, 'data-ag-owned', '1'); return el; };
  const isSub = (e) => !!closestOf(e, '[data-testid="subagent-tab-conversation"]');
  const TH_STOP = new Set('planner-response-text|agent-response|background-task-command|tool-group-collapsible|conversation-view|autoscroll-viewport'.split('|'));
  const rectOf = (e) => (isFn(e?.getBoundingClientRect) ? e.getBoundingClientRect() : null);
  const setProp = (e, k, v) => e?.style?.setProperty?.(k, v);
  const docOf = () => (typeof document !== 'undefined' ? document : null), deOf = () => docOf()?.documentElement;
  const nowOf = () => (typeof performance !== 'undefined' && isFn(performance.now) ? performance.now() : Date.now());
  const rAF = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : 0);
  const cAF = (id) => { if (id && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id); };
  const ST = (fn, ms) => setTimeout(fn, ms), CT = (id) => clearTimeout(id), AF = Array.from, isFin = Number.isFinite;
  const clrT = (id) => (id && CT(id), 0), clrF = (id) => (id && cAF(id), 0);

  const createStreamChoreographyController = ({
    motionEngine,
    isDestroyed,
    isMotionStandardOrUltra,
    isMotionUltra,
    isConvRunning,
    isThoughtIsolatedNode,
    isThoughtMutationRecord,
    isManagedThoughtPanel,
    setAttrIfChanged,
    runGuardedMut,
    cloneCachedSvgElement,
    buildBrandMarkSvg,
    applySingleHostIcon,
    rippleCtl,
    convAuraCtl,
    notifyMascot,
  }) => {
    let hydrateRaf = 0, sparkQueue = [], iconQueue = [], unfoldQueue = [], unfoldRaf = 0, wfClickTimer = 0, convEntryTimer = 0, convEntryRaf = 0, convEntrySeq = 0;
    const transientTimers = new Set();
    const heroState = { routeInitialized: false, wasInHome: false, wasInFormalConv: false, lastModelSig: null, pendingModelShiftNotify: false, lastTriggerOrigin: null, lastGroupPress: null };
    let lastHomeRect = null, liftoffBubbleUntil = 0, sentBubbleUntil = 0, seenSentBubbles = new WeakSet(), suppressEntryMotionUntil = 0, convDipEl = null, convSwapSeq = 0, convSwapExitTm = 0;
    const swapAnims = [], splitAnims = [];
    const clrAnims = (arr) => { while (arr.length) { try { arr.pop()?.cancel?.(); } catch {} } };
    const trackA = (arr, a) => { if (a) arr.push(a); return a; };
    let runInit = false, wasRunning = false, runStartAt = 0, lastVialHighNotifyAt = -600000, fiberTimer = 0, sbInit = false, sbIndex = -1, sbCid = '', sbRect = null, sbRunning = false, runHoldTimer = 0;
    const runningCidMap = new Map(), runningRowMap = new WeakMap(), seenHeaders = new WeakSet(), seenOverlays = new WeakSet(), streamRoots = new Set(), paneRunState = new WeakMap(), textLenMap = new WeakMap(), fadeItems = [], doneSparkCache = new WeakMap(), expirableClasses = new Map();
    let streamObs = null, streamMutating = false, lastCodeAt = -1000, scannedNodes = new WeakSet(), seenBlocks = new WeakSet(), hlBuckets = null, fadeRaf = 0, fadeTimer = 0, nextFadeDueAt = 0, sweepTimer = 0;

const guardMut = (fn) => {
  const p = streamMutating;
  streamMutating = true;
  try { return isFn(runGuardedMut) ? runGuardedMut(fn) : fn(); } finally {
    if (!p && streamObs?.takeRecords) try { streamObs.takeRecords(); } catch {}
    streamMutating = p;
  }
};
const canStreamMotion = () => ga(docOf()?.documentElement, 'data-ag-cs-motion') !== 'off' && Boolean(isFn(isMotionStandardOrUltra) ? isMotionStandardOrUltra() : isMotionUltra());
const getHlBuckets = () => {
  const cssObj = typeof CSS !== 'undefined' ? CSS : G.CSS, HlCtor = typeof Highlight === 'function' ? Highlight : G.Highlight, d = docOf();
  if (!cssObj?.highlights?.set || !isFn(HlCtor) || !isFn(d?.createRange)) return null;
  if (!hlBuckets) hlBuckets = HIGHLIGHT_NAMES.map((n) => { const h = cssObj.highlights.get?.(n) || new HlCtor(); cssObj.highlights.set(n, h); return h; });
  else for (let i = 0; i < 5; i++) { const n = HIGHLIGHT_NAMES[i], cur = cssObj.highlights.get?.(n); if (cur && cur !== hlBuckets[i]) hlBuckets[i] = cur; else if (!cur) cssObj.highlights.set(n, hlBuckets[i]); }
  return hlBuckets;
};
const dropBucketItem = (it) => { if (hlBuckets && it.b >= 0 && it.b < 5) try { hlBuckets[it.b].delete(it.r); } catch {} it.b = -1; };
const clearFadeTimer = () => { fadeTimer = clrT(fadeTimer); };
const clearHighlightFade = () => {
  clearFadeTimer(); fadeRaf = clrF(fadeRaf); nextFadeDueAt = 0;
  for (let i = 0; i < fadeItems.length; i++) dropBucketItem(fadeItems[i]);
  fadeItems.length = 0;
};
const scheduleFadeStep = (now, useTimer) => {
  if (isDestroyed() || !fadeItems.length) return;
  if (docOf()?.hidden) return clearHighlightFade();
  if (fadeRaf) return;
  const delay = nextFadeDueAt > 0 ? nextFadeDueAt - now : 0;
  if (useTimer && delay > 18 && typeof setTimeout === 'function') {
    if (fadeTimer) return;
    fadeTimer = ST(() => {
      fadeTimer = 0;
      if (isDestroyed() || !canStreamMotion() || !fadeItems.length || docOf()?.hidden) return clearHighlightFade();
      if (!fadeRaf && !(fadeRaf = rAF(stepHighlightFade))) clearHighlightFade();
    }, M.max(8, M.round(delay - 6)));
    return;
  }
  clearFadeTimer();
  if (!(fadeRaf = rAF(stepHighlightFade))) clearHighlightFade();
};

function stepHighlightFade(ts) {
  clearFadeTimer(); fadeRaf = 0;
  if (isDestroyed() || !canStreamMotion() || !fadeItems.length || docOf()?.hidden) return clearHighlightFade();
  const now = typeof ts === 'number' && isFin(ts) ? ts : nowOf();
  if (nextFadeDueAt > 0 && now < nextFadeDueAt - 1) return scheduleFadeStep(now, true);
  const buckets = getHlBuckets();
  if (!buckets) return clearHighlightFade();
  let w = 0, earliestDue = Infinity;
  for (let i = 0; i < fadeItems.length; i++) {
    const it = fadeItems[i], tn = it.n, age = M.max(0, now - it.t);
    if (!isConn(tn) || txtOf(tn).length < it.e || age >= STREAM_FADE_MS) { dropBucketItem(it); continue; }
    const nb = M.min(4, (age / STREAM_FADE_STEP_MS) | 0);
    if (it.b !== nb) { dropBucketItem(it); try { buckets[nb].add(it.r); it.b = nb; } catch { continue; } }
    const due = it.t + (it.b + 1) * STREAM_FADE_STEP_MS;
    if (due < earliestDue) earliestDue = due;
    fadeItems[w++] = it;
  }
  fadeItems.length = w;
  if (w > 0) { nextFadeDueAt = isFin(earliestDue) ? earliestDue : 0; scheduleFadeStep(now, false); }
  else clearHighlightFade();
}
const enqueueFadeRange = (tn, sOff, eOff, now) => {
  const d = docOf();
  if (!tn || eOff <= sOff || !d || d.hidden) return false;
  const buckets = getHlBuckets(), raw = txtOf(tn);
  if (!buckets || eOff > raw.length || !/\S/.test(raw.slice(sOff, eOff))) return false;
  const prev = fadeItems[fadeItems.length - 1];
  if (prev && prev.n === tn && prev.e === sOff && now - prev.t <= 64) { try { prev.r.setEnd(tn, eOff); prev.e = eOff; return true; } catch {} }
  if (fadeItems.length >= MAX_FADE_RANGES) { const old = fadeItems.shift(); if (old) dropBucketItem(old); }
  try {
    const r = d.createRange(); r.setStart(tn, sOff); r.setEnd(tn, eOff); buckets[0].add(r);
    fadeItems.push({ n: tn, s: sOff, e: eOff, r, b: 0, t: now });
    const due = now + STREAM_FADE_STEP_MS;
    if (!nextFadeDueAt || due < nextFadeDueAt) { nextFadeDueAt = due; clearFadeTimer(); }
    scheduleFadeStep(now, false);
    return true;
  } catch { return false; }
};
const snapTextLens = (node, limit = 24) => {
  if (!node) return;
  let c = 0;
  const walk = (n) => {
    if (!n || c >= limit) return;
    if (n.nodeType === 3) { textLenMap.set(n, txtOf(n).length); c++; return; }
    const ks = n.childNodes;
    if (ks) for (let i = ks.length - 1; i >= 0 && c < limit; i--) walk(ks[i]);
  };
  walk(node);
};

    const flushExpiredClasses = () => {
      sweepTimer = 0;
      if (expirableClasses.size === 0) return;
      const now = Date.now();
      let nextDue = Infinity;
      guardMut(() => {
        for (const [el, map] of expirableClasses.entries()) {
          for (const [cls, expAt] of map.entries()) {
            if (now >= expAt - 2) { clRm(el, cls); map.delete(cls); }
            else if (expAt < nextDue) nextDue = expAt;
          }
          if (map.size === 0) expirableClasses.delete(el);
        }
      });
      if (!isDestroyed() && expirableClasses.size > 0 && isFin(nextDue)) {
        sweepTimer = ST(flushExpiredClasses, M.max(16, M.ceil(nextDue - Date.now())));
      }
    };

    const scheduleTransient = (fn, ms) => {
      const id = ST(() => {
        transientTimers.delete(id);
        if (!isDestroyed()) try { guardMut(fn); } catch {}
      }, ms);
      transientTimers.add(id);
      return id;
    };

const clearTransientTimers = () => {
  convEntrySeq++; convSwapSeq++;
  convEntryTimer = clrT(convEntryTimer); convEntryRaf = clrF(convEntryRaf);
  wfClickTimer = clrT(wfClickTimer); sweepTimer = clrT(sweepTimer); runHoldTimer = clrT(runHoldTimer);
  convSwapExitTm = clrT(convSwapExitTm); convDipEl = null; clrAnims(swapAnims); clrAnims(splitAnims);
  runningCidMap.clear(); expirableClasses.clear();
  for (const id of transientTimers) CT(id);
  transientTimers.clear();
};
const cancelDeferredHydration = () => {
  convEntrySeq++;
  convEntryTimer = clrT(convEntryTimer); convEntryRaf = clrF(convEntryRaf);
  hydrateRaf = clrF(hydrateRaf); unfoldRaf = clrF(unfoldRaf);
  sparkQueue = []; iconQueue = []; unfoldQueue = [];
};

const tgAttr = (el, a, on) => (on ? (isFn(setAttrIfChanged) ? setAttrIfChanged(el, a, '1') : ga(el, a) !== '1' && sa(el, a, '1')) : ha(el, a) && ra(el, a));
const applySingleSpark = (trig, brand, st) => {
  const d = docOf();
  if (!d || !isConn(trig)) return;
  tgAttr(trig, 'data-ag-cs-spark-streaming', st === 'streaming');
  let spark = clHas(trig.firstElementChild, 'ag-cs-thinking-spark') ? trig.firstElementChild : qs(trig, '.ag-cs-thinking-spark');
  if (!spark) trig.insertBefore((spark = mkTag(d, 'span', 'ag-cs-thinking-spark')), trig.firstChild);
  const isMono = ga(deOf(), 'data-ag-cs-accent') === 'mono', mv = isMono ? '1' : '0';
  if (ga(spark, 'data-brand') !== brand || ga(spark, 'data-state') !== st || ga(spark, 'data-mono') !== mv) {
    sa(spark, 'data-brand', brand); sa(spark, 'data-state', st); sa(spark, 'data-mono', mv);
    const c = cloneCachedSvgElement(`spark:${brand}:${mv}`, buildBrandMarkSvg(brand, 13, 'auto', isMono));
    if (c) (G.__agPrismSvgUtil ? G.__agPrismSvgUtil.mount(spark, c) : spark.replaceChildren?.(c));
  }
};
const stepHydration = () => {
  hydrateRaf = 0;
  if (isDestroyed()) return;
  guardMut(() => {
    let b = 18;
    for (; b > 0 && sparkQueue.length; b--) { const it = sparkQueue.pop(); applySingleSpark(it.trig, it.brand, it.st); }
    for (; b > 0 && iconQueue.length; b--) { const it = iconQueue.pop(); if (!ga(it.btn, 'data-ag-cs-icon-injected')) applySingleHostIcon(it.btn, it.iconName, it.origSvg, it.size); }
  });
  if (sparkQueue.length || iconQueue.length) hydrateRaf = rAF(stepHydration);
};

    const enqueueDeferredIcons = (items) => {
      iconQueue = items;
      if (!isDestroyed() && !hydrateRaf) hydrateRaf = rAF(stepHydration);
    };

    const STREAM_THOUGHT_RE = /(?:\.\.\.|…)\s*$|正在思考|思考中/i;
    const isStreamingThoughtTrigger = (trig, isLast) => {
      if (ga(trig, 'data-op-thought-state') === 'streaming') return true;
      if (!isLast) return false;
      return STREAM_THOUGHT_RE.test(String(trig.textContent || '').trim());
    };

const resolveScopeBrand = (scope, primaryModelInfo, paneModelMap) =>
  (isFn(paneModelMap?.get) && paneModelMap.get(scope)?.brand) ||
  (scope && scope !== docOf() && (ga(scope, 'data-ag-cs-pane-camp') || (isFn(scope.closest) && ga(scope.closest('[data-tiling-pane]'), 'data-ag-cs-pane-camp')) || ga(qs(scope, '[data-testid="model-selector-trigger"] .ag-cs-model-glyph'), 'data-brand'))) ||
  primaryModelInfo?.brand || 'gemini';
const syncThinkingSparks = (primaryModelInfo, paneModelMap = null) => {
  const d = docOf();
  if (isDestroyed() || !d) return;
  const views = findFormalConvViews(), scopes = views.length ? views : [d], mv = ga(deOf(), 'data-ag-cs-accent') === 'mono' ? '1' : '0', pending = [];
  for (const scope of scopes) {
    const brand = resolveScopeBrand(scope, primaryModelInfo, paneModelMap), cacheSig = `${brand}:${mv}`, triggers = qsa(scope, '[data-testid="thinking-collapsible-trigger"]'), len = triggers.length;
    for (let i = 0; i < len; i++) {
      const trig = triggers[i], isLast = i === len - 1, expSt = ga(trig, 'data-op-thought-state') === 'streaming';
      if (!expSt && !isLast && doneSparkCache.get(trig) === cacheSig) continue;
      const spark = clHas(trig.firstElementChild, 'ag-cs-thinking-spark') ? trig.firstElementChild : qs(trig, '.ag-cs-thinking-spark');
      const st = expSt || isStreamingThoughtTrigger(trig, isLast) ? 'streaming' : 'done';
      if (spark && ga(spark, 'data-brand') === brand && ga(spark, 'data-state') === st && ga(spark, 'data-mono') === mv && (st === 'streaming') === ha(trig, 'data-ag-cs-spark-streaming')) {
        if (st === 'done' && !isLast) doneSparkCache.set(trig, cacheSig); else doneSparkCache.delete(trig);
        continue;
      }
      if (st !== 'done') doneSparkCache.delete(trig);
      pending.push({ trig, brand, st, isLast, cacheSig });
    }
  }
  const runApply = (it) => { applySingleSpark(it.trig, it.brand, it.st); if (it.st === 'done' && !it.isLast) doneSparkCache.set(it.trig, it.cacheSig); };
  for (const it of pending) runApply(it);
};
const clearWorkedForAutoUnfoldAttrs = () => { const d = docOf(); raAll(d, 'data-ag-cs-auto-unfolded'); raAll(d, 'data-ag-cs-outer-open'); };
const clickClosed = (cb) => {
  if (!cb || !isConn(cb) || ga(cb, 'aria-expanded') !== 'false' || !isFn(cb.click)) return false;
  try { cb.click(); } catch {}
  return true;
};
const pumpUnfoldQueue = () => {
  unfoldRaf = 0;
  if (isDestroyed() || !unfoldQueue.length) { unfoldQueue = []; return; }
  for (let b = 2; unfoldQueue.length && b > 0;) if (clickClosed(unfoldQueue.pop())) b--;
  if (unfoldQueue.length && !isDestroyed()) unfoldRaf = rAF(pumpUnfoldQueue);
};
const processOuterWf = (btn, pendingClicks) => {
  if (!isConn(btn)) return;
  const expanded = ga(btn, 'aria-expanded') === 'true';
  let scope = btn.nextElementSibling;
  if (!scope) { let sib = btn.nextSibling; while (sib && sib.nodeType && sib.nodeType !== 1) sib = sib.nextSibling; scope = sib || null; }
  if (!scope) scope = peOf(btn);
  const innerBtns = qsa(scope, '[data-testid="tool-group-collapsible"]');
  if (expanded) {
    setAttrIfChanged(btn, 'data-ag-cs-outer-open', '1');
    for (const cb of innerBtns) if (cb !== btn && ga(cb, 'data-ag-cs-auto-unfolded') !== '1') {
      sa(cb, 'data-ag-cs-auto-unfolded', '1');
      if (ga(cb, 'aria-expanded') === 'false' && isFn(cb.click)) pendingClicks.push(cb);
    }
  } else if (ga(btn, 'data-ag-cs-outer-open') === '1') {
    ra(btn, 'data-ag-cs-outer-open');
    for (const cb of innerBtns) ra(cb, 'data-ag-cs-auto-unfolded');
    const p = peOf(btn);
    if (p && p !== scope) for (const el of qsa(p, '[data-ag-cs-auto-unfolded]')) ra(el, 'data-ag-cs-auto-unfolded');
  }
};
const flushPendingUnfoldClicks = (pendingClicks) => {
  if (!pendingClicks.length) return;
  if (pendingClicks.length <= 2 || typeof requestAnimationFrame !== 'function') { for (const cb of pendingClicks) clickClosed(cb); return; }
  for (let k = 0; k < 2 && pendingClicks.length; k++) clickClosed(pendingClicks.pop());
  unfoldQueue.push(...pendingClicks);
  if (!unfoldRaf && unfoldQueue.length) unfoldRaf = rAF(pumpUnfoldQueue);
};
const syncWorkedForAutoUnfold = (dirtyTargets = null) => {
  const d = docOf();
  if (isDestroyed()) return clearWorkedForAutoUnfoldAttrs();
  if (!d) return;
  const pendingClicks = [];
  if (dirtyTargets?.size > 0) {
    const outers = new Set();
    for (const node of dirtyTargets) {
      if (!isConn(node)) continue;
      if (ga(node, 'data-testid') === 'worked-for-collapsible') { outers.add(node); continue; }
      const prev = node.previousElementSibling;
      if (prev && ga(prev, 'data-testid') === 'worked-for-collapsible') outers.add(prev);
      for (const b of qsa(node, '[data-testid="worked-for-collapsible"]')) outers.add(b);
      for (let cur = peOf(node); cur && cur !== d.body; cur = peOf(cur)) {
        const sib = cur.previousElementSibling;
        if (sib && ga(sib, 'data-testid') === 'worked-for-collapsible') { outers.add(sib); break; }
      }
    }
    for (const btn of outers) processOuterWf(btn, pendingClicks);
    return flushPendingUnfoldClicks(pendingClicks);
  }
  for (const btn of qsa(d, '[data-testid="worked-for-collapsible"]')) processOuterWf(btn, pendingClicks);
  flushPendingUnfoldClicks(pendingClicks);
};
const scheduleWorkedForClickSync = () => {
  if (isDestroyed()) return;
  wfClickTimer = clrT(wfClickTimer);
  wfClickTimer = ST(() => { wfClickTimer = 0; if (!isDestroyed()) syncWorkedForAutoUnfold(); }, 28);
};
function findFormalConvViews() {
  const out = [];
  for (const cv of qsa(docOf(), '[data-testid="conversation-view"]')) {
    if (!isSub(cv) && !closestOf(cv, '.agy-home') && !qs(cv, '.agy-home') && cv.hidden !== true && cv.style?.display !== 'none') out.push(cv);
  }
  return out;
}
function findFormalConvView() {
  const views = findFormalConvViews();
  if (views.length <= 1) return views[0] || null;
  const actCv = closestOf(docOf()?.activeElement, '[data-testid="conversation-view"]');
  return actCv && views.includes(actCv) ? actCv : views[0];
}
const sampleHomeComposerRect = () => {
  const home = qs(docOf(), '.agy-home');
  if (!home) return null;
  const r = rectOf(qs(home, '[data-testid="agent-input-box"]') || qs(home, '.surface-composer-card'));
  if (r && r.width > 0 && r.height > 0) lastHomeRect = { left: r.left, top: r.top, width: r.width, height: r.height };
  return lastHomeRect;
};
const triggerHomeLiftoffRippleBurst = () => {
  if (!qs(docOf(), '.agy-home')) return;
  const r = sampleHomeComposerRect();
  if (isMotionUltra() && rippleCtl) rippleCtl.triggerLiftoffBurst(r);
};
const markLiftoffBubble = (conv) => {
  const b = qs(conv, '[data-testid="user-message-bubble"]');
  if (!b) return false;
  sa(b, 'data-ag-cs-liftoff-bubble', '1');
  scheduleTransient(() => { if (isConn(b)) ra(b, 'data-ag-cs-liftoff-bubble'); }, 500);
  return true;
};
const triggerHeroALiftoff = (formalConv, measuredRect = null) => {
  const d = docOf();
  if (!isMotionUltra() || !formalConv || !d) return;
  const now = nowOf(), r = lastHomeRect;
  rmAll(d, '.ag-cs-liftoff-veil');
  const veil = mkTag(d, 'div', 'ag-cs-liftoff-veil');
  setProp(veil, '--ag-lift-x', r?.width > 0 ? `${M.round(r.left + r.width / 2)}px` : '50%');
  setProp(veil, '--ag-lift-y', r?.height > 0 ? `${M.round(r.top + r.height / 2)}px` : '58%');
  const ring = d.createElement('div'); ring.className = 'ag-cs-liftoff-ring';
  veil.appendChild(ring); d.body?.appendChild(veil);
  scheduleTransient(() => veil.remove(), 540);
  const inputBox = qs(formalConv, '[data-testid="agent-input-box"]') || qs(d, '[data-testid="agent-input-box"]');
  if (inputBox && isFn(motionEngine?.spring)) {
    const nr = measuredRect || rectOf(inputBox), rawDelta = r && nr ? M.round(r.top - nr.top) : -160;
    const hostFade = !!(closestOf(inputBox, '.animate-fade-in, .no-transitions') || closestOf(formalConv, '.no-transitions') || clHas(formalConv, 'no-transitions'));
    const dy = hostFade ? M.max(-24, M.min(0, rawDelta === 0 ? -10 : M.round(rawDelta * 0.08))) : M.max(-420, M.min(-24, rawDelta === 0 ? -140 : rawDelta));
    try { motionEngine.spring(inputBox, [{ transform: `translateY(${dy}px) scale(${hostFade ? 0.996 : 0.985})` }, { transform: 'translateY(0) scale(1)' }], { durationMs: hostFade ? 220 : 480, stiffness: hostFade ? 360 : 310, damping: hostFade ? 32 : 28, slot: 'liftoff-dock' }); } catch {}
  }
  liftoffBubbleUntil = markLiftoffBubble(formalConv) ? 0 : now + 900;
  convAuraCtl?.triggerLiftoffEbb?.(now);
};
const triggerHeroBHomeReturn = () => {
  const home = isMotionUltra() ? qs(docOf(), '.agy-home') : null;
  if (!home) return;
  rippleCtl?.triggerTideSwell?.();
  if (isFn(motionEngine?.stagger)) {
    const items = [qs(home, '[data-testid="home-greeting"]'), qs(home, '.ag-cs-home-panel'), qs(home, '[data-testid="agent-input-box"]')].filter(Boolean);
    if (items.length) try { motionEngine.stagger(items, [{ transform: 'translateY(8px)' }, { transform: 'translateY(0px)' }], { durationMs: 200, delayStep: 20, stepMs: 20, stiffness: 360, damping: 32, slot: 'home-return' }); } catch {}
  }
};
const getSidebarRowCid = (row) => String(ga(row, 'data-cascade-id') || ga(qs(row, 'a[href]'), 'href') || ga(row, 'data-conversation-id') || '').trim();
const isStopBtn = (b) => {
  if (!b || b.hidden === true || ga(b, 'aria-hidden') === 'true' || ga(b, 'aria-haspopup') || ga(b, 'role') === 'checkbox') return false;
  const tid = String(ga(b, 'data-testid') || '').trim(), lbl = String(ga(b, 'aria-label') || ga(b, 'title') || '').trim();
  return !NON_STOP_RE.test(tid + ' ' + lbl) && !!((tid && (STOP_TID_RE.test(tid) || STOP_CAMEL_RE.test(tid))) || (lbl && STOP_LABEL_RE.test(lbl)) || qs(b, '.lucide-square,.lucide-circle-stop'));
};
const isSidebarRowRunning = (row) => {
  if (!row) return false;
  if (qs(row, '[data-testid="status-loading-spinner"]')) return true;
  if (isFn(row.getElementsByTagName)) {
    for (const b of row.getElementsByTagName('button')) if (isStopBtn(b)) return true;
    for (const b of qsa(row, '[role="button"]')) if (isStopBtn(b)) return true;
    return false;
  }
  for (const b of qsa(row, 'button, [role="button"]')) if (isStopBtn(b)) return true;
  return false;
};

    const pruneRunningCidMap = (now) => {
      for (const [k, ts] of runningCidMap) {
        if (now - ts > SIDEBAR_RUN_HOLD_MS) runningCidMap.delete(k);
      }
      if (runningCidMap.size > 256) {
        let drop = runningCidMap.size - 256;
        for (const k of runningCidMap.keys()) {
          runningCidMap.delete(k);
          if (--drop <= 0) break;
        }
      }
    };

const isSbOff = () => ga(deOf(), 'data-ag-cs-sidebar') === 'off';
const heldAtOf = (r, cid) => M.max(cid ? runningCidMap.get(cid) || 0 : 0, runningRowMap.get(r) || 0);
const markRun = (r, cid, now) => { runningRowMap.set(r, now); if (cid) runningCidMap.set(cid, now); };
const scheduleRunningHoldExpiry = (delayMs) => {
  if (isDestroyed() || runHoldTimer) return;
  runHoldTimer = ST(() => {
    runHoldTimer = 0;
    const d = docOf();
    if (isDestroyed() || !d || isSbOff()) return;
    const now = nowOf();
    pruneRunningCidMap(now);
    let minRem = Infinity;
    guardMut(() => {
      for (const r of qsa(d, '[data-testid="conversation-row-sidebar"]')) {
        const cid = getSidebarRowCid(r);
        if (isSidebarRowRunning(r)) { markRun(r, cid, now); tgAttr(r, 'data-ag-cs-row-running', true); continue; }
        const lastAt = heldAtOf(r, cid), rem = lastAt > 0 ? SIDEBAR_RUN_HOLD_MS - (now - lastAt) : -1;
        if (rem > 0) { if (rem < minRem) minRem = rem; tgAttr(r, 'data-ag-cs-row-running', true); }
        else { if (cid && runningCidMap.get(cid) === lastAt) runningCidMap.delete(cid); runningRowMap.delete(r); tgAttr(r, 'data-ag-cs-row-running', false); }
      }
    });
    if (isFin(minRem)) scheduleRunningHoldExpiry(minRem);
  }, M.max(24, M.min(SIDEBAR_RUN_HOLD_MS + 40, M.ceil(delayMs) + 16)));
};
const resolveSidebarRowRunning = (row, domRunning, now) => {
  const cid = getSidebarRowCid(row);
  if (domRunning) { markRun(row, cid, now); return true; }
  const lastAt = heldAtOf(row, cid);
  if (lastAt > 0) {
    const elapsed = now - lastAt;
    if (elapsed >= 0 && elapsed <= SIDEBAR_RUN_HOLD_MS) { scheduleRunningHoldExpiry(SIDEBAR_RUN_HOLD_MS - elapsed); return true; }
    if (cid && runningCidMap.get(cid) === lastAt) runningCidMap.delete(cid);
    runningRowMap.delete(row);
  }
  return false;
};
const lockSidebarRowRunningOnPointerDown = (row) => {
  if (!row || !docOf() || isSbOff()) return false;
  const now = nowOf(), cid = getSidebarRowCid(row), heldAt = heldAtOf(row, cid);
  if (!ha(row, 'data-ag-cs-row-running') && !isSidebarRowRunning(row) && !(heldAt > 0 && now - heldAt <= SIDEBAR_RUN_HOLD_MS)) return false;
  markRun(row, cid, now);
  guardMut(() => tgAttr(row, 'data-ag-cs-row-running', true));
  scheduleRunningHoldExpiry(SIDEBAR_RUN_HOLD_MS);
  return true;
};
const stampSidebarRowRunningImmediate = (row) => {
  if (!row || !docOf() || isSbOff()) return false;
  const run = resolveSidebarRowRunning(row, isSidebarRowRunning(row), nowOf());
  if (run) guardMut(() => tgAttr(row, 'data-ag-cs-row-running', true));
  return run;
};

const measureSidebarSelectionSnapshot = () => {
const rows = qsa(docOf(), '[data-testid="conversation-row-sidebar"]');
if (!rows.length) return { e: true };
const now = nowOf();
pruneRunningCidMap(now);
let selIdx = -1, selRow = null, selRun = false, batchRun = null;
const states = [], listP = rows.length > 1 ? peOf(rows[0]) : null;
if (listP && isFn(listP.getElementsByTagName) && AF(rows).every((r) => peOf(r) === listP)) {
batchRun = new Set();
const mr = (n) => { const r = closestOf(n, '[data-testid="conversation-row-sidebar"]'); if (r) batchRun.add(r); };
for (const sp of qsa(listP, '[data-testid="status-loading-spinner"]')) mr(sp);
for (const b of listP.getElementsByTagName('button')) if (isStopBtn(b)) mr(b);
for (const rb of qsa(listP, '[role="button"]')) if (isStopBtn(rb)) mr(rb);
}
for (let i = 0; i < rows.length; i++) {
const r = rows[i], run = resolveSidebarRowRunning(r, batchRun ? batchRun.has(r) : isSidebarRowRunning(r), now);
if (selIdx < 0 && ga(r, 'data-selected') === 'true') { selIdx = i; selRow = r; selRun = run; }
states.push([r, run]);
}
if (!selRow) return { e: false, i: -1, cid: '', r: null, rn: false, s: null, l: null, t: 0, st: states };
const curCid = getSidebarRowCid(selRow);
if ((sbInit && sbRect && (curCid && sbCid ? curCid === sbCid : selIdx === sbIndex)) || getBus()?.isSkipped?.(selRow)) return { e: false, i: selIdx, cid: curCid, r: selRow, rn: selRun, s: sbRect, st: states };
const list = peOf(selRow), rr = rectOf(selRow), lr = rectOf(list), stTop = list?.scrollTop || 0;
const snap = rr ? { left: rr.left, top: rr.top, width: rr.width, height: rr.height, ry: lr ? rr.top - lr.top + stTop : rr.top, rx: lr ? rr.left - lr.left : rr.left } : null;
return { e: false, i: selIdx, cid: curCid, r: selRow, rn: selRun, s: snap, l: lr, t: stTop, st: states };
};

const SP = 'cubic-bezier(.22,1,.36,1)';
const kf = (x, y, s, o) => {
  const r = { transform: s === 1 ? `translate3d(${x}px,${y}px,0)` : `translate3d(${x}px,${y}px,0) scale(${s})` };
  if (o != null) r.opacity = o;
  return r;
};
const K0 = kf(0, 0, 1), K1 = kf(0, 0, 1, 1);
const wa = (el, k, d, e = SP, f = 'none', dl = 0) => {
  try { return isFn(el?.animate) ? el.animate(k, { duration: d, easing: e, fill: f, delay: dl }) : null; } catch { return null; }
};
const wO = (el, d, dl = 0) => wa(el, [{ opacity: 0 }, { opacity: 1 }], d, 'ease-out', 'backwards', dl);
const deferPlay = (hs, onPlay) => {
  const list = hs.filter(Boolean);
  if (!list.length) return onPlay?.();
  for (const a of list) try { a.pause(); } catch {}
  let done = false;
  const go = () => {
    if (done) return;
    done = true; onPlay?.();
    if (!isDestroyed()) for (const a of list) try { a.play(); } catch {}
  };
  if (!rAF(go)) go(); else scheduleTransient(go, 120);
};
const clearSwapGuards = () => { clrAnims(swapAnims); };
const activeVp = (row) => {
  if (!row || !isMotionStandardOrUltra() || ga(row, 'data-selected') === 'true') return null;
  const cv = findFormalConvView();
  if (!cv) return null;
  const vp = qs(cv, '[data-testid="autoscroll-viewport"]'), i = AF(qsa(docOf(), '[data-testid="conversation-row-sidebar"]')).indexOf(row);
  return { vp, wrap: vp || cv, dir: sbIndex >= 0 && i >= 0 && i < sbIndex ? -1 : 1 };
};
const prepareConvPressDip = (row) => {
  if (!row) {
    const el = convDipEl; convDipEl = null; clrAnims(swapAnims);
    if (el && isConn(el)) wa(el, [kf(0, 0, .985, .86), K1], 110);
    return;
  }
  if (!isMotionStandardOrUltra() || ga(row, 'data-selected') === 'true') return;
  clrAnims(swapAnims);
  trackA(swapAnims, wa((convDipEl = row), [K1, kf(0, 0, .985, .86)], 90, SP, 'forwards'));
};
const prepareConvSwitchExit = (row) => {
  const cur = activeVp(row);
  if (!cur) return;
  convDipEl = null; clrAnims(swapAnims);
  const seq = ++convSwapSeq, y = cur.dir * -14;
  convSwapExitTm = clrT(convSwapExitTm);
  trackA(swapAnims, wa(cur.wrap, [kf(0, 0, 1, .85), kf(0, y, 1, .08)], 115, 'cubic-bezier(.4,0,1,1)', 'forwards'));
  convSwapExitTm = ST(() => {
    convSwapExitTm = 0;
    if (seq !== convSwapSeq || isDestroyed()) return;
    clrAnims(swapAnims);
    if (isConn(cur.wrap)) wa(cur.wrap, [{ opacity: .08 }, K1], 140, 'ease-out');
  }, 380);
};
const triggerSplitTransition = (splitEl, toDual) => {
  const ks = splitEl?.children, n = ks?.length || 0;
  if (n < 2 || !isMotionStandardOrUltra() || suppressEntryMotionUntil > nowOf()) return;
  clrAnims(splitAnims);
  if (!toDual) return;
  const l = ks[0], r = ks[n - 1], s = n > 2 ? ks[1] : null, hs = [];
  if (r && r !== l) hs.push(trackA(splitAnims, wa(r, [kf(24, 0, 1, 0), K1], 240, SP, 'backwards')));
  if (s) hs.push(trackA(splitAnims, wO(s, 180)));
  if (hs.length) deferPlay(hs);
};
const markFreshSentBubble = (conv) => {
  if (!conv || !isMotionStandardOrUltra()) return false;
  const bs = qsa(conv, '[data-testid="user-message-bubble"]'), last = bs[bs.length - 1];
  if (!last || seenSentBubbles.has(last)) return false;
  seenSentBubbles.add(last);
  wa(last, [kf(0, 18, .982, 0), K1], 340);
  return true;
};
const triggerSendLaunch = (scopeEl, btn) => {
  if (!isMotionStandardOrUltra()) return;
  const card = closestOf(scopeEl, '.surface-composer-card') || qs(closestOf(scopeEl, '[data-testid="agent-input-box"]') || docOf(), '.surface-composer-card');
  if (card) wa(card, [K0, kf(0, 3, .994), K0], 240);
  if (btn) wa(btn, [K0, kf(0, -5, 1.14), K0], 260);
  const cv = closestOf(scopeEl, '[data-testid="conversation-view"]') || findFormalConvView();
  if (cv) for (const b of qsa(cv, '[data-testid="user-message-bubble"]')) seenSentBubbles.add(b);
  sentBubbleUntil = nowOf() + 950;
};
const rstSb = () => { sbInit = false; sbIndex = -1; sbCid = ''; sbRect = null; sbRunning = false; };
const syncSidebarSelectionGlide = (snap) => {
  const d = docOf();
  if (!snap || !d) return;
  if (isSbOff()) {
    rmAll(d, '.ag-cs-sidebar-glide-pill');
    if (snap.st) for (const [row] of snap.st) tgAttr(row, 'data-ag-cs-row-running', false);
    runHoldTimer = clrT(runHoldTimer); runningCidMap.clear();
    return rstSb();
  }
  if (snap.st) for (const [row, run] of snap.st) tgAttr(row, 'data-ag-cs-row-running', run);
  if (snap.e) return rstSb();
  const { i: selIdx, cid: curCid, r: selRow, rn: selRun, s: curSnap, l: listRect, t: scrollTop } = snap;
  if (!selRow) return;
  const targetRun = !!(selRun || ha(selRow, 'data-ag-cs-row-running'));
  if (!sbInit) { sbInit = true; sbIndex = selIdx; sbCid = curCid; sbRect = curSnap; sbRunning = targetRun; return; }
  const sessionChanged = curCid && sbCid ? curCid !== sbCid : selIdx !== sbIndex;
  if (sbIndex >= 0 && selIdx >= 0 && sessionChanged && sbRect && curSnap && !(suppressEntryMotionUntil > nowOf())) {
    const fromRect = listRect ? { left: listRect.left + sbRect.rx, top: listRect.top + sbRect.ry - scrollTop, width: sbRect.width, height: sbRect.height } : sbRect;
    const dir = selIdx < sbIndex ? 'down' : 'up';
    const vps = AF(qsa(d, '[data-testid="autoscroll-viewport"]')).filter((vp) => !isSub(vp));
    const matchedVp = curCid ? vps.find((vp) => ga(closestOf(vp, '[data-cascade-id]'), 'data-cascade-id') === curCid) : null;
    const targets = matchedVp ? [matchedVp] : vps;
    if (isMotionStandardOrUltra()) {
      rmAll(d, '.ag-cs-sidebar-glide-pill');
      const pill = mkTag(d, 'div', 'ag-cs-sidebar-glide-pill');
      if (targetRun) sa(pill, 'data-ag-cs-glide-running', '1'); else if (sbRunning) sa(pill, 'data-ag-cs-glide-from-running', '1');
      for (const s of `position:fixed|z-index:38|pointer-events:none|left:${M.round(curSnap.left)}px|top:${M.round(curSnap.top)}px|width:${M.round(curSnap.width)}px|height:${M.round(curSnap.height)}px`.split('|')) { const i = s.indexOf(':'); setProp(pill, s.slice(0, i), s.slice(i + 1)); }
      d.body?.appendChild(pill);
      try { motionEngine?.glideIndicator?.(pill, fromRect, curSnap, { durationMs: 240, stiffness: 390, damping: 32, mass: 0.9 }); } catch {}
      scheduleTransient(() => pill.remove(), 260);
      convDipEl = null; convSwapSeq++; convSwapExitTm = clrT(convSwapExitTm);
      clrAnims(swapAnims);
      const dy = dir === 'down' ? -20 : 20;
      for (const vp of targets) wa(vp, [kf(0, dy, 1, 0), K1], 240, SP, 'backwards');
    }
    if (isMotionUltra()) {
      for (const vp of targets) {
        sa(vp, 'data-ag-cs-stage-glide', dir);
        scheduleTransient(() => {
          if (isConn(vp) && ga(vp, 'data-ag-cs-stage-glide') === dir) ra(vp, 'data-ag-cs-stage-glide');
        }, 220);
      }
    }
  }
  sbIndex = selIdx; sbCid = curCid; sbRect = curSnap; sbRunning = targetRun;
};

const applyCaustic = (el) => {
  if (!el || !isMotionUltra()) return;
  sa(el, 'data-ag-cs-caustic', '1');
  scheduleTransient(() => { if (isConn(el)) ra(el, 'data-ag-cs-caustic'); }, 920);
};
const getBus = () => G.__agDomBus || G.__agPrismDomBus || (typeof window !== 'undefined' && (window.__agDomBus || window.__agPrismDomBus)) || null;
const runBus = (k, rFn, wFn) => {
  const b = getBus();
  if (b?.measure && b?.mutate) { let v = null; b.measure(k + '-r', () => { v = rFn(); }); b.mutate(k + '-w', () => { if (!isDestroyed() && v?.length) guardMut(() => wFn(v)); }); }
  else wFn(rFn());
};
const measureVisibleChangedHeaders = () => {
  const out = [], bus = getBus(), vh = typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : 1080;
  for (const hdr of qsa(docOf(), '[data-testid="changed-files-card-header"]')) {
    if (seenHeaders.has(hdr) || bus?.isSkipped?.(hdr)) continue;
    const r = rectOf(hdr);
    if (!r || r.height <= 0 || (r.bottom > 0 && r.top < vh)) out.push(hdr);
  }
  return out;
};
const syncHeaderOpenStates = (scope = null) => {
  const root = scope || docOf();
  if (root) for (const hdr of qsa(root, '[data-testid="changed-files-card-header"]')) tgAttr(hdr, 'data-ag-cs-hdr-open', tagOf(hdr.nextElementSibling) === 'DIV');
};
const applyCausticHeaders = (list) => {
  let sawNew = false;
  for (const hdr of list) if (!seenHeaders.has(hdr)) { seenHeaders.add(hdr); sawNew = true; if (isMotionUltra()) applyCaustic(hdr); }
  if (sawNew) notifyMascot('files-changed');
};
const syncHeroCCaustics = (measuredHeaders) => {
  const d = docOf(), now = nowOf();
  syncHeaderOpenStates(d);
  if (measuredHeaders) applyCausticHeaders(measuredHeaders);
  else runBus('sc:caustics', measureVisibleChangedHeaders, applyCausticHeaders);
  const PANE_RUN_SEL = '[data-testid="input-cancel-button"],[data-testid="stop-button"],[data-testid="cancel-button"],[data-testid="agent-loading"],[data-testid="thinking-collapsible-trigger"][data-op-thought-state="streaming"]';
  const views = findFormalConvViews();
  let paneCausticHit = false;
  if (views.length > 1) {
    for (const cv of views) {
      const runPane = !!qs(cv, PANE_RUN_SEL), ps = paneRunState.get(cv);
      if (!ps) paneRunState.set(cv, { wasRunning: runPane, startAt: runPane ? now : 0 });
      else if (runPane && !ps.wasRunning) { ps.wasRunning = true; ps.startAt = now; }
      else if (!runPane && ps.wasRunning) {
        ps.wasRunning = false;
        const dur = ps.startAt > 0 ? now - ps.startAt : 0; ps.startAt = 0;
        if (dur >= 6000 && isMotionUltra()) {
          const card = qs(cv, '[data-testid="agent-input-box"] .surface-composer-card');
          if (card && !isSub(card)) { applyCaustic(card); paneCausticHit = true; }
        }
      }
    }
  }
  const runningNow = isConvRunning();
  if (!runInit) { runInit = true; wasRunning = runningNow; runStartAt = runningNow ? now : 0; }
  else if (runningNow && !wasRunning) { wasRunning = true; runStartAt = now; }
  else if (!runningNow && wasRunning) {
    wasRunning = false;
    const elapsed = runStartAt > 0 ? now - runStartAt : 0; runStartAt = 0;
    const auraPhase = convAuraCtl?.getInstance?.()?.phase || '';
    if (auraPhase === 'error-halted' || !!qs(d, '[data-testid="conversation-view"] [data-testid="agent-error-banner"], [data-testid="conversation-view"] [data-testid="error-message"]')) {
      convAuraCtl?.triggerErrorHalted?.(now);
      notifyMascot('streamDone', { error: true, durationMs: elapsed });
    } else {
      if (!paneCausticHit && elapsed >= 6000 && isMotionUltra()) {
        for (const c of qsa(d, '[data-testid="agent-input-box"] .surface-composer-card')) if (!isSub(c)) applyCaustic(c);
      }
      if (elapsed >= 15000) { convAuraCtl?.triggerLongTaskComplete?.(now); notifyMascot('aura-complete', { durationMs: elapsed }); }
      else notifyMascot('complete', { durationMs: elapsed });
      if (qs(d, '[data-ag-prism-pulse-bar][data-pv-warn="1"], #ag-prism-pulse-bar[data-pv-warn="1"]') && now - lastVialHighNotifyAt >= 600000) {
        lastVialHighNotifyAt = now; notifyMascot('vial-high', { fraction: 0.8 });
      }
    }
  }
};
const triggerHeroDFiberPulse = (card, modelBtn, brand) => {
  if (!card || !isMotionUltra()) return;
  if (fiberTimer) { CT(fiberTimer); transientTimers.delete(fiberTimer); fiberTimer = 0; }
  sa(card, 'data-ag-cs-fiber-camp', brand === 'antigravity' || brand === 'claude' || brand === 'openai' ? brand : 'gemini');
  fiberTimer = scheduleTransient(() => { fiberTimer = 0; if (isConn(card)) ra(card, 'data-ag-cs-fiber-camp'); }, 480);
  const glyph = qs(modelBtn, '.ag-cs-model-glyph');
  if (glyph && isFn(motionEngine?.spring)) try { motionEngine.spring(glyph, [{ transform: 'scale(0.84) rotate(-8deg)' }, { transform: 'scale(1.12) rotate(3deg)' }, { transform: 'scale(1) rotate(0deg)' }], { stiffness: 420, damping: 22, slot: 'fiber-focus' }); } catch {}
};
const triggerHeroESonar = (navTurn) => {
  if (!navTurn || !isMotionUltra()) return;
  const conv = closestOf(navTurn, '[data-testid="conversation-view"]') || findFormalConvView();
  if (!conv) return;
  let turns = qsa(conv, '[data-testid="user-input-step"]');
  if (!turns.length) turns = qsa(conv, '[data-testid="conversation-turn"]');
  if (!turns.length) turns = qsa(conv, '[data-testid="user-message-bubble"]');
  if (!turns.length) return;
  let idx = -1;
  const rawAttr = ga(navTurn, 'data-turn-index') ?? ga(navTurn, 'data-index');
  if (rawAttr != null && /^\d+$/.test(String(rawAttr).trim())) idx = parseInt(String(rawAttr).trim(), 10);
  else if (ga(navTurn, 'data-testid') === 'conversation-navigator-group') idx = 0;
  else {
    const navRoot = closestOf(navTurn, '[data-testid="conversation-navigator"]') || peOf(navTurn);
    if (navRoot) {
      const sibs = AF(qsa(navRoot, '[data-testid="conversation-navigator-turn"]')), relIdx = sibs.indexOf(navTurn);
      if (relIdx >= 0) idx = M.min(turns.length - 1, M.max(0, turns.length - sibs.length) + relIdx);
    }
  }
  const target = idx >= 0 && idx < turns.length ? turns[idx] : null;
  if (!target) return;
  sa(target, 'data-ag-cs-sonar', '1');
  scheduleTransient(() => { if (isConn(target)) ra(target, 'data-ag-cs-sonar'); }, 720);
};

const syncHeroRouteChoreography = (measured) => {
  const d = docOf(), inHome = measured ? measured.inHome : !!qs(d, '.agy-home');
  const formalConv = measured ? measured.formalConv : !inHome ? findFormalConvView() : null, inFormalConv = !!formalConv;
  if (inHome) { const sheet = closestOf(qs(d, '.agy-home'), '.agy-sheet'); if (sheet) setAttrIfChanged(sheet, 'data-ag-cs-home-sheet', '1'); }
  else for (const cv of findFormalConvViews()) {
    const seat = peOf(cv), vp = qs(cv, '[data-testid="autoscroll-viewport"]'), vpP = peOf(vp);
    if (seat && tagOf(seat) === 'DIV') setAttrIfChanged(seat, 'data-ag-cs-conv-seat', '1');
    if (vpP && vpP !== cv) setAttrIfChanged(vpP, 'data-ag-cs-vp-wrap', '1');
  }
  if (inHome && !measured?.homeComposerSampled) sampleHomeComposerRect();
  if (!heroState.routeInitialized) heroState.routeInitialized = true;
  else if (!(suppressEntryMotionUntil > nowOf())) {
    if (heroState.wasInHome && !inHome && inFormalConv) triggerHeroALiftoff(formalConv, measured?.convInputRect || null);
    else if (heroState.wasInFormalConv && !heroState.wasInHome && inHome) triggerHeroBHomeReturn();
  } else liftoffBubbleUntil = 0;
  heroState.wasInHome = inHome; heroState.wasInFormalConv = inFormalConv;
  if (formalConv) {
    if (liftoffBubbleUntil > 0 && (nowOf() > liftoffBubbleUntil || markLiftoffBubble(formalConv))) liftoffBubbleUntil = 0;
    if (sentBubbleUntil > 0 && (nowOf() > sentBubbleUntil || markFreshSentBubble(formalConv))) sentBubbleUntil = 0;
  }
  if (inHome) clearSwapGuards(d);
  else if (measured?.isConvSwap && !measured?.sidebarSnap) clearSwapGuards(d);
  if (measured?.sidebarSnap) syncSidebarSelectionGlide(measured.sidebarSnap);
  if (!measured || measured.checkCaustics !== false) syncHeroCCaustics(measured?.visibleChangedHeaders);
};
const isBlockCode = (el, stopAt) => {
  if (!isEl(el)) return false;
  const t = tagOf(el);
  if (t === 'PRE' || clHas(el, 'code-block') || clHas(el, 'code-line')) return true;
  if (t === 'CODE') for (let p = peOf(el); p && p !== stopAt; p = peOf(p)) if (tagOf(p) === 'PRE' || clHas(p, 'code-block')) return true;
  return false;
};
const insideCodeOrTable = (node, stopAt) => {
  for (let cur = isEl(node) ? node : peOf(node); cur && cur !== stopAt; cur = peOf(cur)) if (TABLE_TAGS.has(tagOf(cur)) || isBlockCode(cur, stopAt)) return cur;
  return null;
};
const findRowAnc = (node, stopAt) => {
  for (let cur = isEl(node) ? node : peOf(node); cur && cur !== stopAt; cur = peOf(cur)) if (tagOf(cur) === 'TR') return cur;
  return null;
};
const flushAllStreamArtifacts = (immediate = true) => {
  scannedNodes = new WeakSet(); seenBlocks = new WeakSet();
  const force = immediate || !canStreamMotion() || isDestroyed();
  if (force) { clearHighlightFade(); sweepTimer = clrT(sweepTimer); }
  guardMut(() => {
    const d = docOf();
    if (force) {
      for (const [el, map] of expirableClasses.entries()) for (const cls of map.keys()) clRm(el, cls);
      expirableClasses.clear();
      if (d) for (const cls of ['ag-cs-stream-chunk', 'ag-cs-thought-chunk', 'ag-cs-code-scan']) for (const el of qsa(d, '.' + cls)) clRm(el, cls);
    }
    if (!d) return;
    raAll(d, 'data-ag-cs-thought-streaming');
    if (!isMotionUltra()) {
      rmAll(d, '.ag-cs-liftoff-veil');
      for (const s of 'liftoff-bubble|caustic|fiber-camp|stage-glide|glide-item|sonar'.split('|')) raAll(d, 'data-ag-cs-' + s);
    }
    if (!isMotionStandardOrUltra()) { rmAll(d, '.ag-cs-sidebar-glide-pill'); clearSwapGuards(d); clrAnims(splitAnims); }
  });
};

    const PROSE_SEL = '[data-testid="planner-response-text"],[data-testid="agent-response"] [data-markdown-root]';

const findStreamingThoughtBody = (node) => {
  const body = docOf()?.body;
  for (let cur = isEl(node) ? node : peOf(node); cur && cur !== body; cur = peOf(cur)) {
    if (ga(cur, 'data-ag-cs-thought-streaming') === '1') return cur;
    const tid = ga(cur, 'data-testid');
    if (tid === 'agent-response' || TH_STOP.has(tid)) return null;
    const prev = cur.previousElementSibling;
    if (prev && ga(prev, 'data-testid') === 'thinking-collapsible-trigger' && ga(prev, 'aria-expanded') === 'true') return cur;
  }
  return null;
};
const markStreamClass = (el, cls, dur = 300) => {
  if (!el?.[K_CL] || clHas(el, cls)) return false;
  guardMut(() => el[K_CL].add(cls));
  let map = expirableClasses.get(el);
  if (!map) expirableClasses.set(el, (map = new Map()));
  map.set(cls, Date.now() + dur);
  if (!sweepTimer) sweepTimer = ST(flushExpiredClasses, dur);
  return true;
};
const fadeLeafTexts = (node, now, max = 4) => {
  if (!node || isThoughtIsolatedNode(node)) return;
  let c = 0;
  const walk = (cur) => {
    if (!cur || c >= max || isThoughtIsolatedNode(cur)) return;
    if (isTxt(cur)) {
      const len = txtOf(cur).length;
      textLenMap.set(cur, len);
      if (len > 0) { enqueueFadeRange(cur, 0, len, now); c++; }
      return;
    }
    if (isEl(cur) && cur.childNodes) for (let i = 0; i < cur.childNodes.length && c < max; i++) walk(cur.childNodes[i]);
  };
  walk(node);
};

    const onStreamMutations = (mutations) => {
      if (isDestroyed() || streamMutating || !canStreamMotion()) return;
      const now = nowOf();
      let newBlocks = 0;

      for (const m of mutations) {
        if (!m || isThoughtMutationRecord(m)) continue;
        const target = m.target;
        if (!target || isThoughtIsolatedNode(target)) continue;
        const baseEl = isEl(target) ? target : peOf(target);
        if (
          !baseEl ||
          getBus()?.isSkipped?.(baseEl) ||
          closestOf(
            baseEl,
            '.ag-prism-thought-overlay, .ag-cs-smooth-caret, .ag-cs-crab, .ag-cs-conv-aura-host, [data-testid="agent-input-box"], script, style'
          )
        ) {
          continue;
        }

        if (m.type === 'characterData') {
          if (!isTxt(target)) continue;
          const nLen = txtOf(target).length, pLen = textLenMap.get(target);
          textLenMap.set(target, nLen);
          if (pLen !== undefined ? nLen <= pLen : nLen <= 0 || nLen > 28) continue;
          const tb = findStreamingThoughtBody(baseEl);
          if (tb ? isManagedThoughtPanel(tb) : !closestOf(baseEl, PROSE_SEL)) continue;
          enqueueFadeRange(target, pLen ?? 0, nLen, now);
          continue;
        }
        if (m.type !== 'childList' || !m.addedNodes?.length) continue;
        const inAnimBlock = !!closestOf(baseEl, '.ag-cs-stream-chunk, .ag-cs-thought-chunk');
        const addBlock = (el, cls, dur) => { if (!seenBlocks.has(el) && newBlocks < 4) { seenBlocks.add(el); newBlocks++; snapTextLens(el, 12); markStreamClass(el, cls, dur); return true; } return false; };
        const thoughtBody = findStreamingThoughtBody(target);
        if (thoughtBody) {
          if (isManagedThoughtPanel(thoughtBody)) continue;
          for (const added of m.addedNodes) {
            if (isThoughtIsolatedNode(added)) continue;
            if (isTxt(added)) fadeLeafTexts(added, now, 1);
            else if (isEl(added) && (inAnimBlock || INLINE_TAGS.has(tagOf(added)) || !addBlock(added, 'ag-cs-thought-chunk', 290))) fadeLeafTexts(added, now, 4);
          }
          continue;
        }
        const proseRoot = closestOf(baseEl, PROSE_SEL);
        if (!proseRoot) continue;
        const markCode = (el, lim) => { scannedNodes.add(el); lastCodeAt = now; snapTextLens(el, lim); markStreamClass(el, 'ag-cs-code-scan', 240); };
        const codeCtx = insideCodeOrTable(target, proseRoot);
        if (codeCtx) {
          const isTbl = TABLE_TAGS.has(tagOf(codeCtx));
          for (const added of m.addedNodes) {
            if (isTxt(added)) { fadeLeafTexts(added, now, 1); continue; }
            if (!isEl(added)) continue;
            if (isTbl) {
              const tr = tagOf(added) === 'TR' ? added : findRowAnc(added, proseRoot) || findRowAnc(codeCtx, proseRoot);
              if (tr && !scannedNodes.has(tr) && now - lastCodeAt >= STREAM_BATCH_MS) markCode(tr, 12);
              else fadeLeafTexts(added, now, 3);
            } else if (tagOf(added) === 'PRE' || clHas(added, 'code-block')) { if (!scannedNodes.has(added)) markCode(added, 16); }
            else {
              const lineEl = clHas(added, 'code-line') ? added : closestOf(added, '.code-line') || added;
              if (lineEl && lineEl !== proseRoot && tagOf(lineEl) !== 'PRE' && !clHas(lineEl, 'code-block') && !scannedNodes.has(lineEl) && now - lastCodeAt >= STREAM_BATCH_MS) markCode(lineEl, 8);
              else fadeLeafTexts(added, now, 3);
            }
          }
          continue;
        }
        for (const added of m.addedNodes) {
          if (isTxt(added)) { fadeLeafTexts(added, now, 1); continue; }
          if (!isEl(added)) continue;
          const tag = tagOf(added);
          if (tag === 'PRE' || tag === 'TABLE' || clHas(added, 'code-block') || clHas(added, 'md-table-host') || clHas(added, 'md-table-frame') || qs(added, 'pre, table, .code-block, .md-table-frame')) {
            if (!scannedNodes.has(added) && now - lastCodeAt >= STREAM_BATCH_MS) markCode(added, 16);
          } else if (inAnimBlock || (INLINE_TAGS.has(tag) && baseEl !== proseRoot) || !addBlock(added, 'ag-cs-stream-chunk', 310)) fadeLeafTexts(added, now, 4);
        }
      }
    };
const syncStreamActiveAttr = (on) => {
  const h = deOf();
  if (h) { if (on) { if (ga(h, 'data-ag-cs-stream-active') !== '1' && isFn(h.setAttribute)) setAttrIfChanged(h, 'data-ag-cs-stream-active', '1'); } else if (ha(h, 'data-ag-cs-stream-active') && isFn(h.removeAttribute)) ra(h, 'data-ag-cs-stream-active'); }
  try { getBus()?.setStreaming?.(on); } catch {}
};
const syncDualStreamEngine = () => {
  const running = isConvRunning(), views = running ? findFormalConvViews() : [];
  syncStreamActiveAttr(running && views.length > 0);
  if (!canStreamMotion() || !running || !views.length) {
    if (streamObs) { try { streamObs.disconnect(); } catch {} streamRoots.clear(); }
    getBus()?.cancelGroup?.('conv:stream');
    return flushAllStreamArtifacts(!canStreamMotion());
  }
  const trigByView = [];
  for (const conv of views) {
    const triggers = qsa(conv, '[data-testid="thinking-collapsible-trigger"]');
    trigByView.push([conv, triggers]);
    for (let i = 0; i < triggers.length; i++) {
      const trig = triggers[i], bodyDiv = trig.nextElementSibling;
      if (bodyDiv && tagOf(bodyDiv) === 'DIV') tgAttr(bodyDiv, 'data-ag-cs-thought-streaming', ga(trig, 'aria-expanded') === 'true' && isStreamingThoughtTrigger(trig, i === triggers.length - 1));
    }
  }
  if (!streamObs && typeof MutationObserver === 'function') streamObs = new MutationObserver(onStreamMutations);
  if (streamObs && (streamRoots.size !== views.length || views.some((v) => !streamRoots.has(v)))) {
    try {
      streamObs.disconnect(); streamRoots.clear();
      for (const [conv, triggers] of trigByView) {
        const resps = qsa(conv, PROSE_SEL);
        if (resps.length) snapTextLens(resps[resps.length - 1], 24);
        const lb = triggers[triggers.length - 1]?.nextElementSibling;
        if (lb && !isManagedThoughtPanel(lb)) snapTextLens(lb, 16);
        streamObs.observe(conv, { childList: true, characterData: true, subtree: true });
        streamRoots.add(conv);
      }
    } catch {}
  }
};
const resolveTriggerOriginCoords = (trig) => {
  if (!trig || !isFin(trig.at)) return null;
  const age = nowOf() - trig.at;
  if (age < 0 || age > 900) return null;
  if (trig.el && !trig._measured) {
    trig._measured = true;
    const r = isConn(trig.el) ? rectOf(trig.el) : null;
    if (r?.width > 0 && r.height > 0) { trig.x = r.left + r.width / 2; trig.y = r.top + r.height / 2; }
    trig.el = null;
  }
  return isFin(trig.x) && isFin(trig.y) ? trig : null;
};
const measureNewLensOverlays = () => {
  const d = docOf();
  if (!isMotionStandardOrUltra() || !d) return [];
  const cands = new Set(qsa(d, '.agy-overlay, .agy-fastpick, [data-testid="context-menu-popup"], [data-testid="context-menu-submenu-popup"]'));
  for (const el of qsa(d, '[data-testid="overview-panel"]')) { const p = peOf(el); if (p && tagOf(p) === 'DIV') cands.add(p); }
  const freshNew = [], bus = getBus();
  for (const ov of cands) if (!ha(ov, 'data-hover-card-popup') && !seenOverlays.has(ov) && !bus?.isSkipped?.(ov)) freshNew.push(ov);
  if (!freshNew.length) return [];
  const trig = resolveTriggerOriginCoords(heroState.lastTriggerOrigin);
  return freshNew.map((ov) => ({ ov, rect: trig ? rectOf(ov) : null }));
};
const applyLensOverlays = (list) => {
  if (!list?.length) return;
  const trig = resolveTriggerOriginCoords(heroState.lastTriggerOrigin);
  for (const { ov, rect: r } of list) {
    if (seenOverlays.has(ov) || (trig && r && (r.width <= 0 || r.height <= 0))) continue;
    seenOverlays.add(ov);
    if (trig && r?.width > 0 && r.height > 0) {
      setProp(ov, '--ag-origin-x', `${M.round(M.max(-40, M.min(r.width + 40, trig.x - r.left)))}px`);
      setProp(ov, '--ag-origin-y', `${M.round(M.max(-40, M.min(r.height + 40, trig.y - r.top)))}px`);
    }
    let idx = 0;
    for (const item of qsa(ov, '[role="option"], [role="menuitem"], [data-testid]')) {
      const role = ga(item, 'role'), tid = ga(item, 'data-testid') || '';
      if (role === 'option' || role === 'menuitem' || tid.startsWith('overview-panel-row-') || tid === 'subagent-node' || tid === 'artifact-row') {
        setProp(item, '--ag-row-i', String(idx++));
        setAttrIfChanged(item, 'data-ag-row-stagger', '1');
        if (idx >= 6) break;
      }
    }
  }
};
const syncLensOverlayOrigins = (measuredOverlays) => {
  const d = docOf();
  if (!d) return;
  for (const el of qsa(d, '[data-testid="overview-panel"]')) { const p = peOf(el); if (p && tagOf(p) === 'DIV') setAttrIfChanged(p, 'data-ag-cs-overview-shell', '1'); }
  if (!isMotionStandardOrUltra()) return;
  if (measuredOverlays) return applyLensOverlays(measuredOverlays);
  runBus('sc:lens', measureNewLensOverlays, applyLensOverlays);
};
const scheduleDeferredConvEntry = (fn, delayMs = 65, frame2Fn = null) => {
  const seq = ++convEntrySeq;
  convEntryTimer = clrT(convEntryTimer); convEntryRaf = clrF(convEntryRaf);
  convEntryTimer = ST(() => {
    convEntryTimer = 0;
    if (isDestroyed() || seq !== convEntrySeq) return;
    if (fn() !== false && seq === convEntrySeq && isFn(frame2Fn)) convEntryRaf = rAF(() => { convEntryRaf = 0; if (!isDestroyed() && seq === convEntrySeq) frame2Fn(); });
  }, delayMs);
};
const disconnectStreamObserver = () => {
syncStreamActiveAttr(false);
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
findFormalConvView,
findFormalConvViews,
sampleHomeComposerRect,
triggerHomeLiftoffRippleBurst,
triggerHeroDFiberPulse,
triggerHeroESonar,
isSidebarRowRunning,
lockSidebarRowRunningOnPointerDown,
stampSidebarRowRunningImmediate,
prepareConvPressDip,
prepareConvSwitchExit,
triggerSplitTransition,
triggerSendLaunch,
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
  suppressEntryMotionUntil = M.max(suppressEntryMotionUntil, nowOf() + M.max(120, Number(ms) || 900));
  liftoffBubbleUntil = 0;
  rmAll(docOf(), '.ag-cs-liftoff-veil,.ag-cs-sidebar-glide-pill');
},
isEntryMotionSuppressed: () => suppressEntryMotionUntil > nowOf(),
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
