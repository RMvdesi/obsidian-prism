// Obsidian Prism — Conversation Horizon Aura Controller (.ag-cs-conv-aura-host)
(function (root) {
  'use strict';
  const M = Math, G = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  if (!G) return;
  const getD = () => (typeof document !== 'undefined' ? document : null), isF = (v) => typeof v === 'function';

  const CONV_AURA_HEIGHT_RATIO = 0.32, START_MS = 1150, COMP_MS = 1400, IDLE_MS = 1200, DEC_MS = 1600, DEC_CLR_MS = 400;
  const ERR_MS = 900, LONG_TH_MS = 15000, LONG_C_MS = 1200, FOC_MS = 600;
  const scaleConvReach = (r) => M.max(0.08, M.min(0.98, +(r / CONV_AURA_HEIGHT_RATIO).toFixed(4)));
  const clamp01 = (v, fb = 1) => { const n = Number(v); return Number.isFinite(n) ? M.max(0, M.min(1, n)) : fb; };
  const CONV_GLOW_SCALE = 0.5;
  function isVisibleAuraNode(el, syncVis = false) {
    if (!el || el.hidden === true || el.isConnected === false || el.getAttribute?.('aria-hidden') === 'true') return false;
    const off = el.getAttribute?.('data-ag-offscreen'), st = el.style;
    if ((off != null && off !== '0' && off !== 'false') || (st && (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0'))) return false;
    if (el.closest?.('[hidden], .hidden, [aria-hidden="true"], [data-ag-offscreen="1"]') || (G.__agDomBus || G.__agPrismDomBus)?.isSkipped?.(el)) return false;
    return !syncVis || !el.checkVisibility || Boolean(el.checkVisibility());
  }

  const mkSc = () => (isF(G.WeakMap) ? new WeakMap() : new Map()), runCache = mkSc(), decCache = mkSc();
  let cacheEpoch = 1, cachedErrorAt = -1;
  const seenErrorNodes = isF(G.WeakSet) ? new WeakSet() : null;
  const wantSyncVis = (a) => a === 'sync' || Boolean(a && typeof a === 'object' && a.syncVis === true);
  const readNowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  const RUNNING_SEL =
    '[data-testid="input-cancel-button"],[data-testid="stop-button"],[data-testid="cancel-button"],[data-testid="agent-loading"],[data-testid="thinking-collapsible-trigger"][data-op-thought-state="streaming"]';
  const DECISION_SEL = '[data-testid="interaction-takeover-card"],[data-testid="side-question-panel"]';
  const SUBAGENT_SEL = '[data-testid="subagent-tab-conversation"]';
  const RUN_EXCL = SUBAGENT_SEL + ',[data-side-panel-body],[data-testid="side-question-panel"]';
  const CV_SEL = '[data-testid="conversation-view"]';

  function isWithinScope(el, scope) {
    if (!el) return false;
    const d = getD();
    if (!scope || scope === d || el === scope || scope.contains?.(el)) return true;
    const ov = el.closest?.(CV_SEL);
    if (ov) return ov === scope;
    const av = d?.querySelectorAll?.(CV_SEL);
    return !av || av.length <= 1;
  }

  function isLiveMatchedIndicator(el, sel, syncVis = false, scope = null, ex = SUBAGENT_SEL) {
    return !!(
      el && el.isConnected === true && typeof el.nodeType === 'number' && isF(el.matches) &&
      el.matches(sel) && !el.closest?.(ex) && isWithinScope(el, scope) && isVisibleAuraNode(el, syncVis)
    );
  }

  function queryScopedIndicator(scope, sel, syncVis, ex = SUBAGENT_SEL) {
    for (const n of scope.querySelectorAll(sel)) if (!n.closest?.(ex) && isVisibleAuraNode(n, syncVis)) return n;
    const d = getD();
    if (scope !== d && isF(d?.querySelectorAll)) {
      const av = d.querySelectorAll(CV_SEL), sp = !av || av.length <= 1;
      for (const n of d.querySelectorAll(sel)) {
        if (n.closest?.(ex)) continue;
        const ov = n.closest?.(CV_SEL);
        if ((ov ? ov === scope : sp) && isVisibleAuraNode(n, syncVis)) return n;
      }
    }
    return null;
  }

  function queryCachedScope(cache, sel, syncOpt, scopeEl, ex = SUBAGENT_SEL) {
    const d = getD();
    if (!d) return false;
    const scope = isF(scopeEl?.querySelectorAll) ? scopeEl : d;
    const syncVis = wantSyncVis(syncOpt), now = readNowMs();
    const cur = cache.get(scope);
    if (cur && cur.ep === cacheEpoch && cur.at >= 0 && M.abs(now - cur.at) < 200 && (!syncVis || cur.sync)) return cur.val;
    if (cur && isLiveMatchedIndicator(cur.el, sel, syncVis, scope, ex)) {
      cur.ep = cacheEpoch; cur.val = true; cur.at = now; cur.sync = syncVis;
      return true;
    }
    const el = queryScopedIndicator(scope, sel, syncVis, ex);
    const val = !!el;
    cache.set(scope, { ep: cacheEpoch, val, at: now, el, sync: syncVis });
    return val;
  }

  function isConvRunning(syncOpt = false, scopeEl = null) {
    return queryCachedScope(runCache, RUNNING_SEL, syncOpt, scopeEl, RUN_EXCL);
  }

  function isAwaitingDecision(syncOpt = false, scopeEl = null) {
    return queryCachedScope(decCache, DECISION_SEL, syncOpt, scopeEl);
  }

  function consumeFreshDomError(convView) {
    const d = getD();
    if (!seenErrorNodes || !d) return false;
    const now = readNowMs();
    if (cachedErrorAt >= 0 && M.abs(now - cachedErrorAt) < 240) return false;
    cachedErrorAt = now;
    const scope = convView || d;
    if (!isF(scope.querySelectorAll)) return false;
    const errs = scope.querySelectorAll('.ag-cs-thinking-spark[data-state="error"], [data-testid="agent-error"], [role="alert"][data-error="true"]');
    let hitFresh = false;
    for (const n of errs) {
      if (n.closest?.(SUBAGENT_SEL)) continue;
      if (!seenErrorNodes.has(n) && isVisibleAuraNode(n)) { seenErrorNodes.add(n); hitFresh = true; }
    }
    return hitFresh;
  }

  const OPTICS_BUF = { strength: 0, reach: 0.5, prism: 0, surge: 0, speed: 0, semantic: 'none', frameMs: 110 };
  const DRAW_EXTRA_BUF = { reach: 0.5, prism: 0, surge: 0, speed: 0, semantic: 'none', ambientIntensity: 1, still: false, spectrum: undefined };

  function fillOptics(out, strength, reach, prism, surge, speed, semantic, frameMs) {
    out.strength = strength; out.reach = reach; out.prism = prism; out.surge = surge;
    out.speed = speed; out.semantic = semantic; out.frameMs = frameMs;
    return out;
  }

  const DA_V = [.62, .76, .88, .68, .9, .24, .28], DA_B = [.46, .6, .74, .5, .8, .2, .25], DA_FD = [0, .31, 0, 0, .7, 0, .22], DA_FL = [0, .64, 0, 0, .7, 0, .22];
  const gDa = (d, a) => (d ? (a === 'vivid' ? DA_V : a === 'balanced' ? DA_B : 0) : 0);

  function computeConvAuraOptics(phase, phaseAt, now, dark, wasRunning, out = {}, da = 'subtle') {
    const dt = gDa(dark, da);
    const idleStr = dt ? dt[0] : dark ? 0.21 : 0.52;
    const runBase = dt ? dt[1] : dark ? 0.31 : 0.64;
    const peakStr = dt ? dt[2] : dark ? 0.46 : 0.78;
    const idlePrism = dt ? dt[3] : dark ? 0.14 : 0.26;
    const runPrism = dt ? dt[4] : 0.7;
    const idleReach = dt ? dt[5] : 0.16;
    const runReach = dt ? dt[6] : 0.22;
    const prog = (ms) => { const v = (now - phaseAt) / ms; return v < 0 ? 0 : v > 1 ? 1 : v; };
    const ep = (ms, pw) => 1 - M.pow(1 - prog(ms), pw);
    const fx = (n) => Number(n.toFixed(4));
    const f = (s, r, p, u, v, m, ms) => fillOptics(out, s, scaleConvReach(r), p, u, v, m, ms);
    if (phase === 'start') {
      const p = prog(START_MS), s = M.sin(p * M.PI);
      const endStr = wasRunning ? runBase : idleStr, endFullReach = wasRunning ? runReach : idleReach;
      const rawReach = p <= 0.5 ? idleReach + (0.26 - idleReach) * s : endFullReach + (0.26 - endFullReach) * s;
      const endPrism = wasRunning ? runPrism : idlePrism, settleEase = M.pow(p, 2.4), endSpeed = wasRunning ? 1.45 : 0.72;
      return f(
        p <= 0.5 ? idleStr + (peakStr - idleStr) * s : endStr + (peakStr - endStr) * s,
        rawReach,
        p <= 0.5 ? idlePrism + (0.74 - idlePrism) * s : endPrism + (0.74 - endPrism) * s,
        fx(0.50 * (1 - 0.32 * settleEase)), fx(1.95 - (1.95 - endSpeed) * settleEase), 'none', 22
      );
    }
    if (phase === 'running') {
      return f(runBase + (dark ? 0.035 : 0.045) * M.sin(now * 0.0021), runReach, runPrism, 0.025 * (1 + M.sin(now * 0.0016)), 1.45, 'none', 32);
    }
    if (phase === 'awaiting-decision') {
      const p = prog(DEC_MS), wave = p < 1 ? M.sin(p * M.PI * 2) * (1 - 0.35 * p) : 0, baseHold = dark ? 0.22 : 0.42;
      return f(M.max(0.08, baseHold + (dark ? 0.045 : 0.065) * wave), 0.18 + 0.025 * M.max(0, wave), 0.32, p < 1 ? fx(0.12 * wave) : 0, p < 1 ? 0.85 : 0, 'awaiting-decision', 36);
    }
    if (phase === 'decision-clear') {
      const ease = ep(DEC_CLR_MS, 2), startHold = dark ? 0.22 : 0.42;
      return f(startHold * (1 - ease), 0.18 - 0.04 * ease, 0.24 * (1 - ease), -0.14 * (1 - ease), 0.65 * (1 - ease), 'awaiting-decision', 28);
    }
    if (phase === 'error-halted') {
      const ease = ep(ERR_MS, 2.2), peakErr = dark ? 0.26 : 0.46;
      return f(peakErr * (1 - ease), 0.21 - 0.09 * ease, 0.36 * (1 - ease), fx(-0.44 * (1 - ease)), 0.9 * (1 - 0.6 * ease), 'error-halted', 28);
    }
    if (phase === 'long-task-complete') {
      const ease = ep(LONG_C_MS, 2.05), startStr = dark ? 0.36 : 0.62, holdStr = dark ? 0.16 : 0.30;
      return f(startStr + (holdStr - startStr) * ease, 0.24 + (0.17 - 0.24) * ease, 0.52 + (0.24 - 0.52) * ease, fx(-0.48 * (1 - ease * 0.92)), 1.25 + (0.55 - 1.25) * ease, 'long-task-complete', 28);
    }
    if (phase === 'focus-fade') {
      const ease = ep(FOC_MS, 2), holdStr = dark ? 0.16 : 0.30;
      return f(holdStr + (idleStr - holdStr) * ease, 0.17 + (0.16 - 0.17) * ease, 0.24 + (idlePrism - 0.24) * ease, 0, 0.55 + (0.72 - 0.55) * ease, 'none', 32);
    }
    if (phase === 'complete') {
      const ease = ep(COMP_MS, 2.1), startStr = dark ? 0.38 : 0.70;
      return f(startStr + (idleStr - startStr) * ease, 0.24 + (0.16 - 0.24) * ease, 0.76 + (idlePrism - 0.76) * ease, -0.36 * (1 - ease * 0.85), 1.45 + (0.72 - 1.45) * ease, 'none', 28);
    }
    return f(idleStr + (dark ? 0.024 : 0.038) * M.sin(now * 0.0018), idleReach, idlePrism, 0, 0.72, 'none', 110);
  }

  function invokeConvGlowDraw(glow, now, dark, still, opt, ambientIntensity = 1, spectrum = undefined) {
    if (!glow) return;
    try {
      const extra = DRAW_EXTRA_BUF;
      extra.reach = opt.reach; extra.prism = opt.prism; extra.surge = opt.surge; extra.speed = opt.speed;
      extra.semantic = opt.semantic || 'none'; extra.ambientIntensity = ambientIntensity;
      extra.still = !!(still); extra.spectrum = spectrum !== undefined && spectrum !== null ? spectrum : undefined;
      if (still && isF(glow.drawStaticSnapshot)) {
        extra.still = true;
        glow.drawStaticSnapshot(now, dark, opt.strength, extra);
        return;
      }
      if (isF(glow.draw)) glow.draw(now, dark, opt.strength, extra);
    } catch {}
  }

  function createConvAuraController({
    isDestroyed,
    isHomeRippleEnabled,
    isMotionStandardOrUltra,
    isDarkTheme,
    getMinFrameGapMs,
    getAmbientIntensity,
    getSpectrumMode,
    isWindowFocused,
    rippleCore,
    setAttrIfChanged,
    runGuardedMut,
  }) {
    let convAura = null, preferredView = null, overrideAmbient = null, overrideSpectrum = null;
    let externalAwaiting = null, externalErrorPending = false, wb = false;
    const WB = 'data-ag-cs-win-blur', PM_A = 'data-ag-cs-perf-mode';
    const PP_OPEN = 'data-ag-pp-open';
    const getHtml = () => getD()?.documentElement || null;
    const ga = (k) => getHtml()?.getAttribute?.(k);
    const rw = () => G.__agPrismRippleWorker || null;
    const getPerfMode = () => String(getHtml()?.dataset?.agCsPerfMode || ga(PM_A) || '').trim().toLowerCase();
    const isPerf = (m = getPerfMode()) => m === 'performance' || m === 'eco';
    const isAB = () => ga(WB) === '1';
    const isPpOpen = () => ga(PP_OPEN) === '1' && isPerf();
    const isH = () => !!(getD()?.hidden);
    const isP = () => !!(isH() || isAB() || wb || isPpOpen());

    function normAmbientVal(v) {
      const n = v == null || v === '' ? 1 : Number(v);
      return !Number.isFinite(n) ? 1 : n <= 0 ? 0 : n > 1 ? M.min(1, n / 100) : n;
    }

    function resolveAmbient() {
      if (overrideAmbient !== null) return normAmbientVal(overrideAmbient);
      if (isF(getAmbientIntensity)) return normAmbientVal(getAmbientIntensity());
      try {
        const raw = ga('data-ag-cs-ambient');
        if (raw !== null && raw !== '') return normAmbientVal(raw);
      } catch {}
      return 1;
    }

    function resolveSpectrum() {
      const sp = overrideSpectrum ?? getSpectrumMode?.();
      return (!sp || sp === 'follow' || sp === 'default') && isDarkTheme() && ga('data-ag-cs-dark-aura-style') === 'neon' ? 'neon' : sp;
    }

    function checkWindowFocused() {
      if (isF(isWindowFocused)) return !!(isWindowFocused());
      const d = getD();
      try { return isF(d?.hasFocus) ? !!(d.hasFocus()) : true; } catch { return true; }
    }

    function isValidConvView(cv) {
      return !!(cv && cv.isConnected !== false && !cv.closest?.('.agy-home') && !cv.closest?.(SUBAGENT_SEL) && !cv.querySelector?.('.agy-home'));
    }

    function resolveConvViewTarget(target) {
      if (!target) return null;
      const cv = target.matches?.(CV_SEL) ? target : target.closest?.(CV_SEL);
      return isValidConvView(cv) ? cv : null;
    }

    function findConvAuraView() {
      const d = getD();
      if (!d || !isHomeRippleEnabled() || d.querySelector('.agy-home')) return null;
      if (isValidConvView(preferredView)) return preferredView;
      preferredView = null;
      const actCv = resolveConvViewTarget(d.activeElement);
      if (actCv) return actCv;
      if (convAura && isValidConvView(convAura.convView)) return convAura.convView;
      for (const cv of d.querySelectorAll(CV_SEL)) {
        if (isValidConvView(cv)) return cv;
      }
      return null;
    }

    const bindFW = (m, fn, o) => {
      try {
        if (typeof window !== 'undefined') { window[m]?.('focus', fn, o); window[m]?.('pointermove', fn, o); }
        getD()?.[m]?.('pointerenter', fn, o);
      } catch {}
    };

    function detFW(st) {
      const fn = st?.onUserReturn;
      if (!fn) return;
      st.onUserReturn = null;
      bindFW('removeEventListener', fn);
    }

    const setPh = (st, ph, t) => { st.phase = ph; st.phaseAt = t; setAttrIfChanged(st.host, 'data-aura-phase', ph); };
    function attFW(st) {
      if (!st || st.onUserReturn) return;
      const onR = () => {
        detFW(st);
        if (!convAura || convAura !== st || !st.unfocusedHold) return;
        st.unfocusedHold = false; st.sleepReason = '';
        setPh(st, 'focus-fade', readNowMs());
        st.wake(true);
      };
      st.onUserReturn = onR;
      bindFW('addEventListener', onR, { once: true, passive: true });
    }

    function advancePhase(now = readNowMs()) {
      const a = convAura;
      if (!a || !a.host || !a.host.isConnected) return 'off';
      const scope = a.convView || null, rNow = isConvRunning(false, scope);
      const aNow = externalAwaiting !== null ? !!(externalAwaiting) : isAwaitingDecision(false, scope);
      const fErr = externalErrorPending || (!rNow && consumeFreshDomError(scope));
      const pTo = (ph, t = now) => { a.phase = ph; a.phaseAt = t; };
      if (externalErrorPending) externalErrorPending = false;

      if (fErr) {
        detFW(a);
        a.wasRunning = a.decisionHolding = a.unfocusedHold = false; a.sleepReason = ''; pTo('error-halted');
      } else if (aNow) {
        detFW(a);
        a.wasRunning = rNow; a.unfocusedHold = false;
        if (a.phase !== 'awaiting-decision') { a.decisionHolding = false; a.sleepReason = ''; pTo('awaiting-decision'); }
      } else if (a.phase === 'awaiting-decision') {
        a.decisionHolding = false; a.sleepReason = '';
        if (rNow) { a.wasRunning = true; a.runStartedAt = now; pTo('start'); }
        else pTo('decision-clear');
      } else if (rNow && !a.wasRunning) {
        detFW(a);
        a.unfocusedHold = a.decisionHolding = false; a.sleepReason = ''; a.wasRunning = true; a.runStartedAt = now;
        if (a.phase !== 'start') pTo('start');
      } else if (!rNow && a.wasRunning) {
        a.wasRunning = false; a.sleepReason = '';
        const dur = a.runStartedAt > 0 ? now - a.runStartedAt : 0; a.runStartedAt = 0;
        pTo(dur >= LONG_TH_MS ? 'long-task-complete' : 'complete');
      }

      const pe = now - a.phaseAt;
      if (a.phase === 'start' && pe >= START_MS) pTo(a.wasRunning ? 'running' : 'idle');
      else if ((a.phase === 'complete' && pe >= COMP_MS) || (a.phase === 'decision-clear' && pe >= DEC_CLR_MS)) pTo('idle');
      else if (a.phase === 'error-halted' && pe >= ERR_MS) { a.pendingErrorClear = true; pTo('idle', now - IDLE_MS); }
      else if ((a.phase === 'focus-fade' && pe >= FOC_MS) || (a.phase === 'long-task-complete' && !a.unfocusedHold && pe >= LONG_C_MS && checkWindowFocused())) pTo('idle', now - IDLE_MS);

      if (a.host.getAttribute('data-aura-phase') !== a.phase) runGuardedMut(() => { a.host.setAttribute('data-aura-phase', a.phase); });
      return a.phase;
    }

    const stopTimers = (a) => {
      detFW(a);
      for (const k of ['timer', 'resizeTimer', 'recTimer']) if (a[k]) { clearTimeout(a[k]); a[k] = 0; }
      if (a.rafId && isF(G.cancelAnimationFrame)) { cancelAnimationFrame(a.rafId); a.rafId = 0; }
    };

    function unmount() {
      preferredView = null;
      if (!convAura) return;
      const a = convAura;
      stopTimers(a);
      a.ro?.disconnect();
      a.uW?.();
      try { a.glow?.dispose?.(); } catch {}
      a.host?.remove();
      convAura = null;
    }

    function park() {
      const a = convAura;
      if (!a) return;
      stopTimers(a);
      try { a.ro?.disconnect(); } catch {}
      a.host?.remove(); a.seatParent = a.convView = null; a.releaseBacking?.(); a.sleeping = a.parked = true;
    }

    function prime() {
      cacheEpoch += 1; cachedErrorAt = -1;
      if (isDestroyed() || !isHomeRippleEnabled()) return;
      const cv = findConvAuraView();
      if (!cv) return;
      isConvRunning(false, cv);
      if (externalAwaiting === null) isAwaitingDecision(false, cv);
    }

    function sync(preserveCache = false) {
      if (!preserveCache) { cacheEpoch += 1; cachedErrorAt = -1; }
      if (isDestroyed() || !isHomeRippleEnabled()) { unmount(); return; }
      const convView = findConvAuraView(), docRef = getD();
      const seatParent = convView ? convView.parentElement || convView : null;
      if (!convView || !seatParent || !docRef) {
        if (convAura) park();
        return;
      }

      const readSize = () => [seatParent.clientWidth || convView.clientWidth || 0, seatParent.clientHeight || convView.clientHeight || 0];
      const readPhase = () => {
        const r = isConvRunning(false, convView);
        const a = externalAwaiting !== null ? !!(externalAwaiting) : isAwaitingDecision(false, convView);
        return [r, a ? 'awaiting-decision' : r ? 'running' : 'idle'];
      };
      if (convAura) {
        const a = convAura;
        if (a.seatParent !== seatParent || a.convView !== convView || !a.host.isConnected || !a.canvas.isConnected) {
          const nowRe = readNowMs(), [runRe, phaseRe] = readPhase();
          const canDeferRelayout = !a.backingReleased && !!(a.ro) && a.width > 0 && a.height > 0 && isF(G.requestAnimationFrame) && !docRef.hidden;
          const [reW, reH] = canDeferRelayout ? [0, 0] : readSize();
          try { a.ro?.disconnect(); } catch {}
          a.seatParent = seatParent; a.convView = convView; a.parked = false;
          seatParent.insertBefore(a.host, seatParent.firstChild);
          try { a.ro?.observe(seatParent); } catch {}
          if (!canDeferRelayout) { if (reW > 0 && reH > 0 && a.applySize) a.applySize(reW, reH); else a.relayout?.(); }
          a.wasRunning = runRe; a.runStartedAt = runRe ? nowRe : 0; a.decisionHolding = a.unfocusedHold = false;
          a.sleepReason = ''; a.phase = phaseRe; a.phaseAt = nowRe;
          setAttrIfChanged(a.host, 'data-aura-phase', phaseRe); a.wake(!canDeferRelayout);
          return;
        }
        const prevPhase = a.phase, nextPhase = advancePhase(readNowMs());
        if (!isAB()) wb = false;
        if (isH()) { a.releaseBacking?.(); return; }
        if (!a.sleeping && (!isMotionStandardOrUltra() || isP())) { a.wake(true); return; }
        const shouldResume = isMotionStandardOrUltra() && !isP() && a.sleeping && a.sleepReason !== 'settled' && a.sleepReason !== 'ambient-zero';
        if (nextPhase !== prevPhase || shouldResume || (!isH() && a.backingReleased)) {
          if (shouldResume && nextPhase === 'idle') a.phaseAt = readNowMs();
          a.sleepReason = ''; a.wake(true);
        }
        return;
      }

      const initNow = readNowMs();
      const [initW, initH] = readSize();
      const [initRunning, initPhase] = readPhase();
      consumeFreshDomError(convView);

      const host = docRef.createElement('div');
      host.className = 'ag-cs-conv-aura-host';
      host.setAttribute('data-ag-no-i18n', '');
      host.setAttribute('aria-hidden', 'true');
      host.setAttribute('data-aura-phase', initPhase);
      for (const [k, v] of [['top', 'auto'], ['bottom', '0'], ['left', '0'], ['right', '0'], ['height', '32%']]) host.style.setProperty(k, v, 'important');

      let glowCanvas = docRef.createElement('canvas');
      glowCanvas.className = 'ag-cs-conv-glow';
      host.appendChild(glowCanvas);
      seatParent.insertBefore(host, seatParent.firstChild);

      const N = () => {}, NOOP_GLOW = { mode: 'none', resize: N, clear: N, draw: N, drawStaticSnapshot: N, dispose: N };
      const state = {
        seatParent, convView, host, canvas: glowCanvas,
        width: -1, height: -1, dpr: 0, phase: initPhase, phaseAt: initNow,
        runStartedAt: initRunning ? initNow : 0, liftoffAt: 0,
        sleeping: false, sleepReason: '', backingReleased: false,
        decisionHolding: false, unfocusedHold: false, pendingErrorClear: false,
        onUserReturn: null, drawCount: 0, lastOptics: null, wasRunning: initRunning,
        glow: NOOP_GLOW, timer: 0, resizeTimer: 0, recTimer: 0, rafId: 0,
        ro: null, uW: null, wake: null, refreshTheme: null,
      };

      let frameWanted = false, drawnOnce = false, lastGpuDrawAt = 0, forceImmediateDraw = false;
      let bkRel = false, pendingW = 0, pendingH = 0, hasPendingResize = false, lastRoAt = -1;
      let gLost = false, recTries = 0, workerFailed = false, lastPerfKey = getPerfMode();

      const RESIZE_DEBOUNCE_MS = 120;
      const RESIZE_BURST_WINDOW_MS = 180;
      const isLive = () => !isDestroyed() && convAura === state;
      const isResizing = () => ga('data-ag-cs-resizing') === '1';
      const isWorkerGlow = () => state.glow?.mode === 'worker-webgl2';
      const hasCvBuf = () => {
        if (isWorkerGlow()) { const s = state.glow.getBufferSize?.(); return !!(s && s.width > 0 && s.height > 0); }
        return !!(glowCanvas && glowCanvas.width > 0 && glowCanvas.height > 0);
      };

      function swapCv() {
        const next = (getD() || docRef).createElement('canvas');
        next.className = 'ag-cs-conv-glow';
        if (glowCanvas?.replaceWith) glowCanvas.replaceWith(next);
        else if (glowCanvas?.parentNode?.replaceChild) glowCanvas.parentNode.replaceChild(next, glowCanvas);
        else { glowCanvas?.remove?.(); host.appendChild(next); }
        glowCanvas = state.canvas = next;
        return next;
      }

      function onLost(e) {
        e?.preventDefault?.();
        if (!isLive()) return;
        gLost = true;
        if (glowCanvas?.style) glowCanvas.style.display = 'none';
        if (recTries >= 3 || state.recTimer) return;
        const run = () => { state.recTimer = 0; recoverLost(); };
        const tid = isF(G.setTimeout) ? setTimeout(run, 32) : 0;
        if (tid) state.recTimer = tid; else run();
      }

      const resyncGlow = () => { if (state.width > 0 && state.height > 0) { resizeGlow(state.width, state.height, state.dpr || CONV_GLOW_SCALE); wake(true); } };

      function mountGlow(p2d, sw) {
        if (sw) { try { state.glow?.dispose?.(true); } catch {} swapCv(); }
        const wm = rw();
        let g = null;
        if (wm?.mountManagedGlow) {
          g = wm.mountManagedGlow({
            getCanvas: () => glowCanvas, swapCanvas: swapCv, rippleCore, doc: getD() || docRef,
            prefer2D: !!p2d, allowWorker: !workerFailed, antialias: false, onContextLost: onLost,
            onFallbackDone: () => { workerFailed = true; if (!isLive()) return; try { state.glow?.dispose?.(); } catch {} mountGlow(0, 1); resyncGlow(); },
            onUpgradeReady: () => { if (isLive() && !workerFailed && state.glow?.mode === 'webgl2') { mountGlow(0, 1); resyncGlow(); } },
          });
        } else {
          const mk = (u) => {
            if (!rippleCore?.mountBrandHorizonGlow) return NOOP_GLOW;
            if (!u) { glowCanvas.addEventListener?.('webglcontextlost', onLost); return rippleCore.mountBrandHorizonGlow(glowCanvas, { width: 0, height: 0 }); }
            return rippleCore.mountBrandHorizonGlow(glowCanvas, { prefer2D: true, antialias: false, width: 0, height: 0, onContextLost: onLost });
          };
          g = mk(p2d);
          if (rippleCore?.mountBrandHorizonGlow && g?.mode === 'none' && !p2d && !isPerf()) { try { g.dispose?.(true); } catch {} swapCv(); g = mk(1); }
        }
        state.glow = g; gLost = false;
        if (glowCanvas?.style) glowCanvas.style.display = (!rippleCore?.mountBrandHorizonGlow || g?.mode !== 'none') ? '' : 'none';
      }

      function recoverLost() {
        if (!isLive() || !gLost) return;
        if (isH()) return releaseBacking();
        gLost = false;
        mountGlow(++recTries >= 2, 1);
        if (state.width > 0 && state.height > 0 && state.glow?.mode !== 'none') resizeGlow(state.width, state.height, state.dpr || CONV_GLOW_SCALE);
        drawnOnce = false;
        state.glow?.invalidate?.();
        wake(true);
      }

      mountGlow(0, 0);

      const clrT = () => { if (state.timer) { clearTimeout(state.timer); state.timer = 0; } };
      const clrRaf = () => { if (state.rafId && isF(G.cancelAnimationFrame)) { cancelAnimationFrame(state.rafId); state.rafId = 0; } };
      const clearResizeTimer = () => { if (state.resizeTimer) { clearTimeout(state.resizeTimer); state.resizeTimer = 0; } };
      const clrPend = () => { hasPendingResize = false; pendingW = pendingH = 0; };

      function flushPendingResize() {
        state.resizeTimer = 0;
        if (!isLive()) return;
        if (isH()) { clrPend(); return releaseBacking(); }
        if (isResizing()) { state.resizeTimer = setTimeout(flushPendingResize, RESIZE_DEBOUNCE_MS); return; }
        if (!hasPendingResize) return;
        const tw = pendingW, th = pendingH;
        clrPend();
        const prevW = state.width, prevH = state.height;
        if (tw > 0 && th > 0) applySize(tw, th);
        else layout(true);
        if (state.width !== prevW || state.height !== prevH) wake(true);
      }

      function releaseBacking() {
        clearResizeTimer();
        clrPend();
        enterAuraSleep('hidden');
        if (bkRel && !hasCvBuf()) return;
        try { state.glow?.releaseBackingStore?.(); } catch {}
        if (!isWorkerGlow()) glowCanvas.width = glowCanvas.height = 0;
        bkRel = state.backingReleased = true;
        drawnOnce = false;
      }

      function resizeGlow(w, h, dpr) {
        if (w <= 0 || h <= 0) return;
        if (gLost || state.glow?.isContextLost?.()) mountGlow(recTries >= 2, 1);
        const sc = dpr < 0.5 ? dpr * 2 : 1;
        try { state.glow?.resize?.(sc < 1 ? M.max(1, M.round(w * sc)) : w, sc < 1 ? M.max(1, M.round(h * sc)) : h, dpr < 0.5 ? 0.5 : dpr); } catch {}
        if (!isWorkerGlow() && (!glowCanvas.width || !glowCanvas.height)) {
          glowCanvas.width = M.max(1, M.round(w * dpr));
          glowCanvas.height = M.max(1, M.round(h * dpr));
        }
      }

      function applySize(w, parentH) {
        if (isH()) return releaseBacking();
        const h = parentH > 0 ? M.max(1, M.round(parentH * CONV_AURA_HEIGHT_RATIO)) : 0;
        const pm = getPerfMode(), pmChg = pm !== lastPerfKey, dpr = isPerf(pm) ? 0.4 : CONV_GLOW_SCALE;
        lastPerfKey = pm;
        if (pmChg && rippleCore?.mountBrandHorizonGlow && (isPerf(pm) ? state.glow?.mode === '2d' : state.glow?.mode === 'none')) { mountGlow(0, 1); drawnOnce = false; }
        const need = bkRel || (w > 0 && h > 0 && !hasCvBuf());
        if (!need && w === state.width && h === state.height && dpr === state.dpr) return;
        state.width = w; state.height = h; state.dpr = dpr;
        bkRel = state.backingReleased = drawnOnce = false;
        resizeGlow(w, h, dpr);
      }

      function layout(forceRead = false) {
        if (isH()) return releaseBacking();
        const pmChanged = getPerfMode() !== lastPerfKey;
        if (!forceRead && !pmChanged && !bkRel && state.ro && state.width > 0 && state.height > 0) return;
        const sp = state.seatParent || seatParent, cv = state.convView || convView;
        const w = sp?.clientWidth || cv?.clientWidth || 0, parentH = sp?.clientHeight || cv?.clientHeight || 0;
        if (w > 0 && parentH > 0) applySize(w, parentH);
        else if (bkRel && state.width > 0 && state.height > 0) {
          bkRel = state.backingReleased = drawnOnce = false;
          resizeGlow(state.width, state.height, state.dpr || CONV_GLOW_SCALE);
        } else if (!bkRel) applySize(w, parentH);
      }

      function enterAuraSleep(reason = 'settled') {
        clrT(); clrRaf();
        frameWanted = false;
        state.sleeping = true;
        state.sleepReason = reason;
        state.glow?.setPaused?.(true);
        setAttrIfChanged(host, 'data-aura-sleep', '1');
      }

      function drawNow(now) {
        state.rafId = 0;
        frameWanted = false;
        if (!isLive()) return;
        if (isH()) { releaseBacking(); return; }
        if (rippleCore?.mountBrandHorizonGlow && state.glow?.mode === 'none') { enterAuraSleep('settled'); return; }

        const ambient = resolveAmbient();
        if (ambient <= 0) {
          if (hasCvBuf()) { try { state.glow?.clear?.(); } catch {} }
          state.lastOptics = fillOptics(OPTICS_BUF, 0, 0.08, 0, 0, 0, 'none', 0);
          return enterAuraSleep('ambient-zero');
        }

        const flow = isMotionStandardOrUltra() && !isP();
        const lEl = state.liftoffAt > 0 ? now - state.liftoffAt : -1, inLift = flow && lEl >= 0 && lEl < 520;
        if (state.liftoffAt > 0 && !inLift) state.liftoffAt = 0;
        const pBefore = state.phase, phase = advancePhase(now, true), pChg = phase !== pBefore;
        const dark = isDarkTheme(), spectrum = resolveSpectrum(), da = ga('data-ag-cs-dark-aura') || 'balanced';
        let opt = computeConvAuraOptics(phase, state.phaseAt, now, dark, state.wasRunning, OPTICS_BUF, da);
        if (inLift) {
          const p = M.max(0, M.min(1, lEl / 520)), ease = 1 - M.pow(1 - p, 2.25), dt = gDa(dark, da) || (dark ? DA_FD : DA_FL);
          opt = fillOptics(OPTICS_BUF, 0.92 + (dt[1] - 0.92) * ease, scaleConvReach(0.31 + (dt[6] - 0.31) * ease), 0.78 + (dt[4] - 0.78) * ease, 0.38 * (1 - ease), 1.65 + (1.45 - 1.65) * ease, 'none', 16);
        }
        const isGpu = !!(state.glow && (state.glow.mode === 'webgl2' || state.glow.mode === 'worker-webgl2'));
        const sGpu = isGpu && isF(getMinFrameGapMs), rawPG = rw()?.getPerfMinGapMs?.(getD() || docRef) || 0;
        const pGap = rawPG > 0 ? rawPG * 0.88 : (isPerf() ? 14.5 : 0), minG = sGpu ? M.max(pGap, Number(getMinFrameGapMs()) || 0) : pGap;
        const preSl = !inLift && (phase === 'idle' || phase === 'awaiting-decision' || phase === 'long-task-complete');
        const sAct = sGpu && !preSl, sPre = sGpu && preSl, burst = inLift || phase === 'start';
        const sMs = sPre ? M.max(33, minG) : sAct ? M.max(16, minG) : (phase === 'idle' ? M.max(160, opt.frameMs || 160) : opt.frameMs || 32);
        const bGap = M.max(minG, inLift ? 16 : 20);
        const effG = sPre ? M.max(31, sMs - 2) : sAct ? M.max(14.5, minG) : burst ? bGap : M.max(minG, M.max(0, sMs - 2));

        const pEl = now - state.phaseAt;
        const stDec = flow && phase === 'awaiting-decision' && pEl >= DEC_MS;
        const stErr = !!(state.pendingErrorClear) || (phase === 'error-halted' && pEl >= ERR_MS);
        const stLng = flow && phase === 'long-task-complete' && pEl >= LONG_C_MS;
        const stIdl = flow && phase === 'idle' && !inLift && pEl >= IDLE_MS;
        const byp = forceImmediateDraw || pChg || !drawnOnce || stDec || stErr || stLng || stIdl;
        forceImmediateDraw = false;
        if (!byp && flow && effG > 0 && lastGpuDrawAt > 0 && now - lastGpuDrawAt < effG) {
          if (sAct) { wake(false); return; }
          clearTimeout(state.timer); state.timer = setTimeout(() => wake(false), M.max(4, M.ceil(effG - (now - lastGpuDrawAt))));
          return;
        }
        lastGpuDrawAt = now; layout();
        const hasBuf = state.width > 0 && state.height > 0 && hasCvBuf();
        const paint = (o, st) => { if (!hasBuf) return; if (st) state.glow?.invalidate?.(); invokeConvGlowDraw(state.glow, now, dark, st, o, ambient, spectrum); state.drawCount += 1; drawnOnce = true; };
        const stopAt = (o, r) => { state.lastOptics = o; paint(o, true); return enterAuraSleep(r); };
        if (stErr) {
          state.pendingErrorClear = false; if (hasCvBuf()) try { state.glow?.clear?.(); } catch {}
          setPh(state, 'idle', now - IDLE_MS);
          opt.strength = opt.surge = opt.speed = 0; state.lastOptics = opt;
          return enterAuraSleep();
        }
        if (stDec) {
          state.decisionHolding = true;
          return stopAt(fillOptics(OPTICS_BUF, dark ? 0.22 : 0.42, scaleConvReach(0.18), 0.30, 0, 0, 'awaiting-decision', 0));
        }
        if (stLng) {
          if (!checkWindowFocused()) {
            state.unfocusedHold = true; attFW(state);
            return stopAt(fillOptics(OPTICS_BUF, dark ? 0.16 : 0.30, scaleConvReach(0.17), 0.24, 0, 0, 'long-task-complete', 0), 'settled');
          }
          setPh(state, 'idle', now - IDLE_MS);
          return stopAt(computeConvAuraOptics('idle', state.phaseAt, now, dark, false, OPTICS_BUF, da));
        }
        const still = !flow || stIdl;
        state.lastOptics = opt; paint(opt, still);
        if (isDestroyed() || !flow || stIdl) return enterAuraSleep(!flow ? (isP() ? 'hidden' : 'motion-still') : 'settled');
        state.sleeping = false; state.sleepReason = '';
        if (host.hasAttribute('data-aura-sleep')) host.removeAttribute('data-aura-sleep');
        const PD = { start: START_MS, complete: COMP_MS, 'awaiting-decision': DEC_MS, 'error-halted': ERR_MS, 'long-task-complete': LONG_C_MS, idle: IDLE_MS };
        let nextD = burst ? bGap : sMs;
        if (inLift) nextD = M.min(nextD, M.max(8, 520 - lEl + 4));
        else if (PD[phase]) nextD = M.min(nextD, M.max(phase === 'idle' ? 20 : 16, PD[phase] - pEl + 4));
        clearTimeout(state.timer);
        if (sAct) { wake(false); return; }
        state.timer = setTimeout(() => wake(false), nextD);
      }

      const drawImm = () => { forceImmediateDraw = true; drawNow(readNowMs()); };
      function wake(immediate = false) {
        clrT();
        if (!isLive()) return;
        if (isH()) return releaseBacking();
        if (bkRel) layout(true);
        if (isP()) {
          if (!drawnOnce && hasCvBuf()) drawImm();
          return enterAuraSleep('hidden');
        }
        if (immediate) { clrRaf(); frameWanted = false; return drawImm(); }
        if (frameWanted) return;
        frameWanted = true;
        if (isF(G.requestAnimationFrame)) state.rafId = requestAnimationFrame(drawNow);
        else drawNow(readNowMs());
      }

      state.wake = wake;
      state.releaseBacking = releaseBacking;
      state.relayout = () => { if (!bkRel) state.width = state.height = -1; drawnOnce = false; layout(true); };
      state.refreshTheme = () => {
        state.glow?.invalidate?.();
        if (isH()) return releaseBacking();
        if (bkRel) layout(true);
        if (state.decisionHolding || state.unfocusedHold || state.sleepReason === 'settled') drawImm();
        else { state.sleepReason = ''; wake(true); }
      };
      const onVis = () => {
        if (isH()) return releaseBacking();
        const r = bkRel, pChg = getPerfMode() !== lastPerfKey;
        if (r || pChg) { layout(true); state.glow?.invalidate?.(); }
        if (!isP()) { if (r || pChg || state.sleepReason === 'hidden') { state.sleepReason = ''; wake(true); } }
        else {
          if (r && !drawnOnce && hasCvBuf()) drawImm();
          enterAuraSleep('hidden');
        }
      };
      const onBlur = () => { wb = true; enterAuraSleep('hidden'); };
      const onFocus = () => { wb = false; onVis(); };
      const onPaneAct = (ev) => {
        if (isDestroyed()) return;
        const cv = resolveConvViewTarget(ev?.target);
        if (cv && cv !== preferredView) { preferredView = cv; if (convAura && convAura.convView !== cv) sync(false); }
      };
      const capOpt = { capture: true, passive: true };
      docRef.addEventListener('visibilitychange', onVis);
      docRef.addEventListener('focusin', onPaneAct, capOpt);
      docRef.addEventListener('pointerdown', onPaneAct, capOpt);
      const wRef = typeof window !== 'undefined' ? window : null;
      wRef?.addEventListener?.('blur', onBlur);
      wRef?.addEventListener?.('focus', onFocus);
      let bMo = null, unBus = null;
      const dBus = wRef && (wRef.__agDomBus || wRef.__agPrismDomBus), aF = [WB, PP_OPEN, PM_A];
      const onAttr = () => { if (!isAB()) wb = false; onVis(); };
      if (dBus?.subscribe) {
        try { unBus = dBus.subscribe('conv-aura-root', onAttr, { priority: 'high', attributes: true, attributeFilter: aF, filter: (m) => m?.type === 'attributes' && m.target === getHtml() && aF.includes(m.attributeName), observeOptions: { childList: false, subtree: false, attributes: true, attributeFilter: aF } }); } catch { unBus = null; }
      }
      if (!unBus && isF(G.MutationObserver) && getHtml()) {
        try { bMo = new MutationObserver(onAttr); bMo.observe(getHtml(), { attributes: true, attributeFilter: aF }); } catch {}
      }
      state.uW = () => {
        const d = getD();
        if (d) { for (const [e, fn, o] of [['visibilitychange', onVis], ['focusin', onPaneAct, capOpt], ['pointerdown', onPaneAct, capOpt]]) d.removeEventListener(e, fn, o); }
        wRef?.removeEventListener?.('blur', onBlur); wRef?.removeEventListener?.('focus', onFocus);
        unBus?.(); bMo?.disconnect();
      };
      if (isF(G.ResizeObserver)) {
        state.ro = new ResizeObserver((entries) => {
          if (isH()) return releaseBacking();
          const e0 = entries?.[0], bs = e0?.borderBoxSize, bb = Array.isArray(bs) ? bs[0] : bs, cr = e0?.contentRect;
          const rw = bb?.inlineSize > 0 ? bb.inlineSize : (cr?.width || 0), rh = bb?.blockSize > 0 ? bb.blockSize : (cr?.height || 0);
          const hasCr = rw > 0 && rh > 0, nextW = hasCr ? M.round(rw) : 0, nextH = hasCr ? M.round(rh) : 0, now = readNowMs();
          const defer = !bkRel && state.width > 0 && state.height > 0 && hasCvBuf() && (isResizing() || hasPendingResize || (lastRoAt >= 0 && now - lastRoAt <= RESIZE_BURST_WINDOW_MS));
          lastRoAt = now;
          if (defer) {
            hasPendingResize = true; pendingW = hasCr ? nextW : 0; pendingH = hasCr ? nextH : 0;
            clearResizeTimer(); state.resizeTimer = setTimeout(flushPendingResize, RESIZE_DEBOUNCE_MS);
            return;
          }
          clearResizeTimer(); clrPend();
          const prevW = state.width, prevH = state.height;
          if (hasCr) applySize(nextW, nextH); else layout(true);
          if (state.width !== prevW || state.height !== prevH) wake(true);
        });
        state.ro.observe(seatParent);
      }

      state.applySize = applySize;
      convAura = state;
      if (initW > 0 && initH > 0) applySize(initW, initH);
      else layout(true);
      wake(true);
    }

    function setActiveView(target = null) {
      const next = target ? resolveConvViewTarget(target) : null;
      preferredView = next;
      if (convAura && next && convAura.convView !== next) sync(false);
      return convAura?.convView || preferredView || null;
    }

    function getActiveView() {
      return convAura?.convView || (isValidConvView(preferredView) ? preferredView : null);
    }

    function triggerStart(target = null) {
      if (isDestroyed() || !isHomeRippleEnabled()) return;
      if (target) { const cv = resolveConvViewTarget(target); if (cv) preferredView = cv; }
      if (!convAura || (preferredView && convAura.convView !== preferredView)) sync();
      if (!convAura) return;
      const now = readNowMs();
      detFW(convAura);
      convAura.decisionHolding = convAura.unfocusedHold = false; convAura.sleepReason = '';
      if (!convAura.runStartedAt) convAura.runStartedAt = now;
      if (convAura.phase !== 'start' || now - convAura.phaseAt > 240) setPh(convAura, 'start', now);
      convAura.wake(true);
    }

    function triggerLiftoffEbb(now = readNowMs(), target = null) {
      if (target) { const cv = resolveConvViewTarget(target); if (cv) preferredView = cv; }
      if (!convAura || (preferredView && convAura.convView !== preferredView)) sync();
      if (convAura) { convAura.liftoffAt = now; convAura.sleepReason = ''; convAura.wake(true); }
    }

    function setAmbientIntensity(val) {
      overrideAmbient = val === null || val === undefined ? null : clamp01(val, 1);
      if (convAura) { convAura.sleepReason = ''; convAura.wake(true); }
    }

    function setSpectrumMode(mode) {
      overrideSpectrum = mode === null || mode === undefined ? null : String(mode);
      convAura?.refreshTheme?.();
    }

    function setSemanticState(patch = {}) {
      if (!patch || typeof patch !== 'object') return;
      if ('awaitingDecision' in patch) externalAwaiting = patch.awaitingDecision === null ? null : !!(patch.awaitingDecision);
      if (patch.hasError === true) externalErrorPending = true;
      if (convAura) {
        const prev = convAura.phase, next = advancePhase(readNowMs());
        if (next !== prev || externalErrorPending) { convAura.sleepReason = ''; convAura.wake(true); }
      }
    }

    function triggerErrorHalted(now = readNowMs()) {
      externalErrorPending = true;
      if (!convAura) sync();
      if (convAura) { advancePhase(now); convAura.wake(true); }
    }

    function triggerLongTaskComplete(now = readNowMs()) {
      if (!convAura) sync();
      if (convAura) {
        detFW(convAura);
        convAura.wasRunning = convAura.decisionHolding = convAura.unfocusedHold = false;
        convAura.runStartedAt = 0; convAura.sleepReason = '';
        setPh(convAura, 'long-task-complete', now);
        convAura.wake(true);
      }
    }

    function refreshTheme() { convAura?.refreshTheme?.(); }
    function wake(immediate = false) { convAura?.wake?.(immediate); }
    function getInstance() { return convAura; }

    return {
      prime, sync, unmount, wake, setActiveView, getActiveView, triggerStart, triggerLiftoffEbb,
      advancePhase, refreshTheme, setAmbientIntensity, setSpectrumMode, setSemanticState,
      triggerErrorHalted, triggerLongTaskComplete, getInstance,
    };
  }

  G.__agPrismConvAura = {
    CONV_AURA_HEIGHT_RATIO, CONV_AURA_IDLE_SLEEP_MS: IDLE_MS, CONV_AURA_DECISION_BREATH_MS: DEC_MS,
    CONV_AURA_ERROR_MS: ERR_MS, CONV_AURA_LONG_TASK_THRESHOLD_MS: LONG_TH_MS, CONV_AURA_LONG_COMPLETE_MS: LONG_C_MS,
    isConvRunning, isAwaitingDecision, computeConvAuraOptics, createConvAuraController,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
