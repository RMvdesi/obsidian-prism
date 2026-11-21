// Obsidian Prism — Multi-State Semantic Conversation Horizon Aura Controller (.ag-cs-conv-aura-host)
// Split-Rate 300Hz VSync (~30fps cap in running, 1200ms idle settle -> 0fps) + Ambient Intensity + 3-State 0fps Semantic Afterglow.

(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  if (!G) return;

  const CONV_AURA_HEIGHT_RATIO = 0.32;
  const CONV_AURA_START_MS = 1150;
  const CONV_AURA_COMPLETE_MS = 1400;
  const CONV_AURA_IDLE_SLEEP_MS = 1200;
  const CONV_AURA_DECISION_BREATH_MS = 1600;
  const CONV_AURA_DECISION_CLEAR_MS = 400;
  const CONV_AURA_ERROR_MS = 900;
  const CONV_AURA_LONG_TASK_THRESHOLD_MS = 15000;
  const CONV_AURA_LONG_COMPLETE_MS = 1200;
  const CONV_AURA_FOCUS_FADE_MS = 600;

  function scaleConvReach(fullViewportReach) {
    return Math.max(0.08, Math.min(0.98, +(fullViewportReach / CONV_AURA_HEIGHT_RATIO).toFixed(4)));
  }

  function clamp01(v, fallback = 1) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
  }

  function isVisibleAuraNode(el, skipSyncVis = false) {
    if (!el || el.hidden === true || el.isConnected === false) return false;
    const st = el.style;
    if (st && (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0')) return false;
    if (typeof el.closest === 'function' && el.closest('[hidden], .hidden')) return false;
    if (!skipSyncVis && typeof el.checkVisibility === 'function' && !el.checkVisibility()) return false;
    return true;
  }

  let cachedRunningVal = false;
  let cachedRunningAt = -1;
  let cachedRunningEl = null;
  let cachedDecisionVal = false;
  let cachedDecisionAt = -1;
  let cachedDecisionEl = null;
  let cachedErrorAt = -1;
  let lastFullVisAt = -1;
  const seenErrorNodes = typeof WeakSet === 'function' ? new WeakSet() : null;

  function readNowMs() {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }

  const RUNNING_SEL =
    '[data-testid="input-cancel-button"], [data-testid="stop-button"], [data-testid="cancel-button"], [data-testid="agent-loading"], [data-testid="thinking-collapsible-trigger"][data-op-thought-state="streaming"]';
  const DECISION_SEL = '[data-testid="interaction-takeover-card"], [data-testid="side-question-panel"]';
  const SUBAGENT_SEL = '[data-testid="subagent-tab-conversation"]';

  function isLiveMatchedIndicator(el, sel, skipSyncVis = false) {
    return Boolean(
      el &&
        el.isConnected === true &&
        typeof el.nodeType === 'number' &&
        typeof el.matches === 'function' &&
        el.matches(sel) &&
        !el.closest?.(SUBAGENT_SEL) &&
        isVisibleAuraNode(el, skipSyncVis)
    );
  }

  function isConvRunning(skipSyncVis = false) {
    if (typeof document === 'undefined') return false;
    const now = readNowMs();
    if (cachedRunningAt >= 0 && Math.abs(now - cachedRunningAt) < 200) {
      return cachedRunningVal;
    }
    if (isLiveMatchedIndicator(cachedRunningEl, RUNNING_SEL, skipSyncVis)) {
      cachedRunningVal = true;
      cachedRunningAt = now;
      if (!skipSyncVis) lastFullVisAt = now;
      return true;
    }
    cachedRunningEl = null;
    const nodes = document.querySelectorAll(RUNNING_SEL);
    let running = false;
    for (const n of nodes) {
      if (n.closest?.(SUBAGENT_SEL)) continue;
      if (isVisibleAuraNode(n, skipSyncVis)) {
        running = true;
        cachedRunningEl = n;
        break;
      }
    }
    cachedRunningVal = running;
    cachedRunningAt = now;
    if (!skipSyncVis) lastFullVisAt = now;
    return running;
  }

  function isAwaitingDecision(skipSyncVis = false) {
    if (typeof document === 'undefined') return false;
    const now = readNowMs();
    if (cachedDecisionAt >= 0 && Math.abs(now - cachedDecisionAt) < 200) {
      return cachedDecisionVal;
    }
    if (isLiveMatchedIndicator(cachedDecisionEl, DECISION_SEL, skipSyncVis)) {
      cachedDecisionVal = true;
      cachedDecisionAt = now;
      return true;
    }
    cachedDecisionEl = null;
    const nodes = document.querySelectorAll(DECISION_SEL);
    let awaiting = false;
    for (const n of nodes) {
      if (n.closest?.(SUBAGENT_SEL)) continue;
      if (isVisibleAuraNode(n, skipSyncVis)) {
        awaiting = true;
        cachedDecisionEl = n;
        break;
      }
    }
    cachedDecisionVal = awaiting;
    cachedDecisionAt = now;
    return awaiting;
  }

  function consumeFreshDomError(convView) {
    if (!seenErrorNodes || typeof document === 'undefined') return false;
    const now = readNowMs();
    if (cachedErrorAt >= 0 && Math.abs(now - cachedErrorAt) < 240) return false;
    cachedErrorAt = now;
    const scope = convView || document;
    if (typeof scope.querySelectorAll !== 'function') return false;
    const errs = scope.querySelectorAll(
      '.ag-cs-thinking-spark[data-state="error"], [data-testid="agent-error"], [role="alert"][data-error="true"]'
    );
    let hitFresh = false;
    for (const n of errs) {
      if (n.closest?.('[data-testid="subagent-tab-conversation"]')) continue;
      if (!seenErrorNodes.has(n) && isVisibleAuraNode(n)) {
        seenErrorNodes.add(n);
        hitFresh = true;
      }
    }
    return hitFresh;
  }

  function computeConvAuraOptics(phase, phaseAt, now, dark, wasRunning) {
    const idleStr = dark ? 0.21 : 0.52;
    const runBase = dark ? 0.31 : 0.64;
    const idlePrism = dark ? 0.14 : 0.26;
    if (phase === 'start') {
      const p = Math.max(0, Math.min(1, (now - phaseAt) / CONV_AURA_START_MS));
      const s = Math.sin(p * Math.PI);
      const peakStr = dark ? 0.46 : 0.78;
      const endStr = wasRunning ? runBase : idleStr;
      const endFullReach = wasRunning ? 0.22 : 0.16;
      const rawReach = p <= 0.5 ? 0.16 + (0.26 - 0.16) * s : endFullReach + (0.26 - endFullReach) * s;
      const endPrism = wasRunning ? 0.70 : idlePrism;
      const settleEase = Math.pow(p, 2.4);
      const endSpeed = wasRunning ? 1.45 : 0.72;
      return {
        strength: p <= 0.5 ? idleStr + (peakStr - idleStr) * s : endStr + (peakStr - endStr) * s,
        reach: scaleConvReach(rawReach),
        prism: p <= 0.5 ? idlePrism + (0.74 - idlePrism) * s : endPrism + (0.74 - endPrism) * s,
        surge: Number((0.50 * (1 - 0.32 * settleEase)).toFixed(4)),
        speed: Number((1.95 - (1.95 - endSpeed) * settleEase).toFixed(4)),
        semantic: 'none',
        frameMs: 22,
      };
    }
    if (phase === 'running') {
      return {
        strength: runBase + (dark ? 0.035 : 0.045) * Math.sin(now * 0.0021),
        reach: scaleConvReach(0.22),
        prism: 0.70,
        surge: 0.06 * Math.sin(now * 0.0024),
        speed: 1.45,
        semantic: 'none',
        frameMs: 32,
      };
    }
    if (phase === 'awaiting-decision') {
      const elapsed = Math.max(0, now - phaseAt);
      const p = Math.min(1, elapsed / CONV_AURA_DECISION_BREATH_MS);
      const wave = p < 1 ? Math.sin(p * Math.PI * 2) * (1 - 0.35 * p) : 0;
      const baseHold = dark ? 0.22 : 0.42;
      return {
        strength: Math.max(0.08, baseHold + (dark ? 0.045 : 0.065) * wave),
        reach: scaleConvReach(0.18 + 0.025 * Math.max(0, wave)),
        prism: 0.32,
        surge: p < 1 ? Number((0.12 * wave).toFixed(4)) : 0,
        speed: p < 1 ? 0.85 : 0,
        semantic: 'awaiting-decision',
        frameMs: 36,
      };
    }
    if (phase === 'decision-clear') {
      const p = Math.max(0, Math.min(1, (now - phaseAt) / CONV_AURA_DECISION_CLEAR_MS));
      const ease = 1 - Math.pow(1 - p, 2);
      const startHold = dark ? 0.22 : 0.42;
      return {
        strength: startHold * (1 - ease),
        reach: scaleConvReach(0.18 - 0.04 * ease),
        prism: 0.24 * (1 - ease),
        surge: -0.14 * (1 - ease),
        speed: 0.65 * (1 - ease),
        semantic: 'awaiting-decision',
        frameMs: 28,
      };
    }
    if (phase === 'error-halted') {
      const p = Math.max(0, Math.min(1, (now - phaseAt) / CONV_AURA_ERROR_MS));
      const ease = 1 - Math.pow(1 - p, 2.2);
      const peakErr = dark ? 0.26 : 0.46;
      return {
        strength: peakErr * (1 - ease),
        reach: scaleConvReach(0.21 - 0.09 * ease),
        prism: 0.36 * (1 - ease),
        surge: Number((-0.44 * (1 - ease)).toFixed(4)),
        speed: 0.9 * (1 - 0.6 * ease),
        semantic: 'error-halted',
        frameMs: 28,
      };
    }
    if (phase === 'long-task-complete') {
      const p = Math.max(0, Math.min(1, (now - phaseAt) / CONV_AURA_LONG_COMPLETE_MS));
      const ease = 1 - Math.pow(1 - p, 2.05);
      const startStr = dark ? 0.36 : 0.62;
      const holdStr = dark ? 0.16 : 0.30;
      return {
        strength: startStr + (holdStr - startStr) * ease,
        reach: scaleConvReach(0.24 + (0.17 - 0.24) * ease),
        prism: 0.52 + (0.24 - 0.52) * ease,
        surge: Number((-0.48 * (1 - ease * 0.92)).toFixed(4)),
        speed: 1.25 + (0.55 - 1.25) * ease,
        semantic: 'long-task-complete',
        frameMs: 28,
      };
    }
    if (phase === 'focus-fade') {
      const p = Math.max(0, Math.min(1, (now - phaseAt) / CONV_AURA_FOCUS_FADE_MS));
      const ease = 1 - Math.pow(1 - p, 2);
      const holdStr = dark ? 0.16 : 0.30;
      return {
        strength: holdStr + (idleStr - holdStr) * ease,
        reach: scaleConvReach(0.17 + (0.16 - 0.17) * ease),
        prism: 0.24 + (idlePrism - 0.24) * ease,
        surge: 0,
        speed: 0.55 + (0.72 - 0.55) * ease,
        semantic: p < 0.7 ? 'long-task-complete' : 'none',
        frameMs: 32,
      };
    }
    if (phase === 'complete') {
      const p = Math.max(0, Math.min(1, (now - phaseAt) / CONV_AURA_COMPLETE_MS));
      const ease = 1 - Math.pow(1 - p, 2.1);
      const startStr = dark ? 0.38 : 0.70;
      const rawReach = 0.24 + (0.16 - 0.24) * ease;
      return {
        strength: startStr + (idleStr - startStr) * ease,
        reach: scaleConvReach(rawReach),
        prism: 0.76 + (idlePrism - 0.76) * ease,
        surge: -0.36 * (1 - ease * 0.85),
        speed: 1.45 + (0.72 - 1.45) * ease,
        semantic: 'none',
        frameMs: 28,
      };
    }
    return {
      strength: idleStr + (dark ? 0.024 : 0.038) * Math.sin(now * 0.0018),
      reach: scaleConvReach(0.16),
      prism: idlePrism,
      surge: 0,
      speed: 0.72,
      semantic: 'none',
      frameMs: 110,
    };
  }

  function invokeConvGlowDraw(glow, now, dark, still, opt, ambientIntensity = 1, spectrum = undefined) {
    if (!glow) return;
    try {
      const extra = {
        reach: opt.reach,
        prism: opt.prism,
        surge: opt.surge,
        speed: opt.speed,
        semantic: opt.semantic || 'none',
        ambientIntensity,
        still,
      };
      if (spectrum !== undefined && spectrum !== null) {
        extra.spectrum = spectrum;
      }
      if (still && typeof glow.drawStaticSnapshot === 'function') {
        extra.still = true;
        glow.drawStaticSnapshot(now, dark, opt.strength, extra);
        return;
      }
      if (typeof glow.draw === 'function') {
        glow.draw(now, dark, opt.strength, extra);
      }
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
    let convAura = null;
    let overrideAmbient = null;
    let overrideSpectrum = null;
    let externalAwaiting = null;
    let externalErrorPending = false;

    function normAmbientVal(v) {
      if (v === null || v === undefined || v === '') return 1;
      const n = Number(v);
      if (!Number.isFinite(n)) return 1;
      return n <= 0 ? 0 : n > 1 ? Math.min(1, n / 100) : n;
    }

    function resolveAmbient() {
      if (overrideAmbient !== null) return normAmbientVal(overrideAmbient);
      if (typeof getAmbientIntensity === 'function') return normAmbientVal(getAmbientIntensity());
      try {
        if (typeof document !== 'undefined' && document.documentElement?.getAttribute) {
          const raw = document.documentElement.getAttribute('data-ag-cs-ambient');
          if (raw !== null && raw !== '') return normAmbientVal(raw);
        }
      } catch {}
      return 1;
    }

    function resolveSpectrum() {
      if (overrideSpectrum !== null) return overrideSpectrum;
      if (typeof getSpectrumMode === 'function') return getSpectrumMode();
      return undefined;
    }

    const isP = () => typeof document !== 'undefined' && (document.hidden || document.documentElement?.getAttribute?.('data-ag-cs-win-blur') === '1');

    function checkWindowFocused() {
      if (typeof isWindowFocused === 'function') return Boolean(isWindowFocused());
      try {
        if (typeof document !== 'undefined' && typeof document.hasFocus === 'function') {
          return Boolean(document.hasFocus());
        }
      } catch {}
      return true;
    }

    function findConvAuraView() {
      if (typeof document === 'undefined' || !isHomeRippleEnabled() || document.querySelector('.agy-home')) return null;
      if (
        convAura &&
        convAura.convView &&
        convAura.convView.isConnected !== false &&
        !convAura.convView.closest?.('.agy-home') &&
        !convAura.convView.closest?.('[data-testid="subagent-tab-conversation"]')
      ) {
        return convAura.convView;
      }
      const views = document.querySelectorAll('[data-testid="conversation-view"]');
      for (const cv of views) {
        if (cv.closest?.('.agy-home') || cv.closest?.('[data-testid="subagent-tab-conversation"]')) continue;
        return cv;
      }
      return null;
    }

    function detachFocusWakeListeners(st) {
      if (!st || !st.onUserReturn) return;
      const fn = st.onUserReturn;
      st.onUserReturn = null;
      try {
        if (typeof window !== 'undefined' && window.removeEventListener) {
          window.removeEventListener('focus', fn);
          window.removeEventListener('pointermove', fn);
        }
        if (typeof document !== 'undefined' && document.removeEventListener) {
          document.removeEventListener('pointerenter', fn);
        }
      } catch {}
    }

    function attachFocusWakeListeners(st) {
      if (!st || st.onUserReturn) return;
      const onReturn = () => {
        detachFocusWakeListeners(st);
        if (!convAura || convAura !== st || !st.unfocusedHold) return;
        st.unfocusedHold = false;
        st.sleepReason = '';
        st.phase = 'focus-fade';
        st.phaseAt = readNowMs();
        setAttrIfChanged(st.host, 'data-aura-phase', 'focus-fade');
        st.wake(true);
      };
      st.onUserReturn = onReturn;
      try {
        if (typeof window !== 'undefined' && window.addEventListener) {
          window.addEventListener('focus', onReturn, { once: true, passive: true });
          window.addEventListener('pointermove', onReturn, { once: true, passive: true });
        }
        if (typeof document !== 'undefined' && document.addEventListener) {
          document.addEventListener('pointerenter', onReturn, { once: true, passive: true });
        }
      } catch {}
    }

    function advancePhase(now = readNowMs(), fromAnimLoop = false) {
      if (!convAura || !convAura.host || !convAura.host.isConnected) return 'off';
      const skipSyncVis = Boolean(fromAnimLoop && lastFullVisAt >= 0 && Math.abs(now - lastFullVisAt) < 2000);
      const runningNow = isConvRunning(skipSyncVis);
      const awaitingNow = externalAwaiting !== null ? Boolean(externalAwaiting) : isAwaitingDecision(skipSyncVis);
      const freshErr = externalErrorPending || (!runningNow && consumeFreshDomError(convAura.convView));
      if (externalErrorPending) externalErrorPending = false;

      if (freshErr) {
        detachFocusWakeListeners(convAura);
        convAura.wasRunning = false;
        convAura.decisionHolding = false;
        convAura.unfocusedHold = false;
        convAura.sleepReason = '';
        convAura.phase = 'error-halted';
        convAura.phaseAt = now;
      } else if (awaitingNow) {
        detachFocusWakeListeners(convAura);
        convAura.wasRunning = runningNow;
        convAura.unfocusedHold = false;
        if (convAura.phase !== 'awaiting-decision') {
          convAura.decisionHolding = false;
          convAura.sleepReason = '';
          convAura.phase = 'awaiting-decision';
          convAura.phaseAt = now;
        }
      } else {
        if (convAura.phase === 'awaiting-decision') {
          convAura.decisionHolding = false;
          convAura.sleepReason = '';
          if (runningNow) {
            convAura.wasRunning = true;
            convAura.runStartedAt = now;
            convAura.phase = 'start';
            convAura.phaseAt = now;
          } else {
            convAura.phase = 'decision-clear';
            convAura.phaseAt = now;
          }
        } else if (runningNow && !convAura.wasRunning) {
          detachFocusWakeListeners(convAura);
          convAura.unfocusedHold = false;
          convAura.decisionHolding = false;
          convAura.sleepReason = '';
          convAura.wasRunning = true;
          convAura.runStartedAt = now;
          if (convAura.phase !== 'start') {
            convAura.phase = 'start';
            convAura.phaseAt = now;
          }
        } else if (!runningNow && convAura.wasRunning) {
          convAura.wasRunning = false;
          convAura.sleepReason = '';
          const runDur = convAura.runStartedAt > 0 ? now - convAura.runStartedAt : 0;
          convAura.runStartedAt = 0;
          convAura.phase = runDur >= CONV_AURA_LONG_TASK_THRESHOLD_MS ? 'long-task-complete' : 'complete';
          convAura.phaseAt = now;
        }
      }

      if (convAura.phase === 'start' && now - convAura.phaseAt >= CONV_AURA_START_MS) {
        convAura.phase = convAura.wasRunning ? 'running' : 'idle';
        convAura.phaseAt = now;
      } else if (convAura.phase === 'complete' && now - convAura.phaseAt >= CONV_AURA_COMPLETE_MS) {
        convAura.phase = 'idle';
        convAura.phaseAt = now;
      } else if (convAura.phase === 'decision-clear' && now - convAura.phaseAt >= CONV_AURA_DECISION_CLEAR_MS) {
        convAura.phase = 'idle';
        convAura.phaseAt = now;
      } else if (convAura.phase === 'error-halted' && now - convAura.phaseAt >= CONV_AURA_ERROR_MS) {
        convAura.pendingErrorClear = true;
        convAura.phase = 'idle';
        convAura.phaseAt = now - CONV_AURA_IDLE_SLEEP_MS;
      } else if (convAura.phase === 'focus-fade' && now - convAura.phaseAt >= CONV_AURA_FOCUS_FADE_MS) {
        convAura.phase = 'idle';
        convAura.phaseAt = now - CONV_AURA_IDLE_SLEEP_MS;
      } else if (
        convAura.phase === 'long-task-complete' &&
        !convAura.unfocusedHold &&
        now - convAura.phaseAt >= CONV_AURA_LONG_COMPLETE_MS &&
        checkWindowFocused()
      ) {
        convAura.phase = 'idle';
        convAura.phaseAt = now - CONV_AURA_IDLE_SLEEP_MS;
      }

      if (convAura.host.getAttribute('data-aura-phase') !== convAura.phase) {
        runGuardedMut(() => {
          convAura.host.setAttribute('data-aura-phase', convAura.phase);
        });
      }
      return convAura.phase;
    }

    function unmount() {
      if (!convAura) return;
      detachFocusWakeListeners(convAura);
      if (convAura.timer) clearTimeout(convAura.timer);
      if (convAura.rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(convAura.rafId);
      if (convAura.ro) convAura.ro.disconnect();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', convAura.onVis);
      if (convAura.glow && typeof convAura.glow.dispose === 'function') {
        try {
          convAura.glow.dispose();
        } catch {}
      }
      if (convAura.host) convAura.host.remove();
      convAura = null;
    }

    function park() {
      if (!convAura) return;
      detachFocusWakeListeners(convAura);
      if (convAura.timer) {
        clearTimeout(convAura.timer);
        convAura.timer = 0;
      }
      if (convAura.rafId && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(convAura.rafId);
        convAura.rafId = 0;
      }
      if (convAura.ro) {
        try {
          convAura.ro.disconnect();
        } catch {}
      }
      if (convAura.host) convAura.host.remove();
      convAura.seatParent = null;
      convAura.convView = null;
      convAura.sleeping = true;
      convAura.parked = true;
    }

    function prime() {
      cachedRunningAt = -1;
      cachedDecisionAt = -1;
      cachedErrorAt = -1;
      if (isDestroyed() || !isHomeRippleEnabled()) return;
      if (!findConvAuraView()) return;
      isConvRunning();
      if (externalAwaiting === null) isAwaitingDecision();
    }

    function sync(preserveCache = false) {
      if (!preserveCache) {
        cachedRunningAt = -1;
        cachedDecisionAt = -1;
        cachedErrorAt = -1;
      }
      if (isDestroyed() || !isHomeRippleEnabled()) {
        unmount();
        return;
      }
      const convView = findConvAuraView();
      const seatParent = convView ? convView.parentElement || convView : null;
      if (!convView || !seatParent || typeof document === 'undefined') {
        if (convAura) park();
        return;
      }

      if (convAura) {
        if (convAura.seatParent !== seatParent || !convAura.host.isConnected || !convAura.canvas.isConnected) {
          if (convAura.ro) {
            try {
              convAura.ro.disconnect();
            } catch {}
          }
          convAura.seatParent = seatParent;
          convAura.convView = convView;
          convAura.parked = false;
          seatParent.insertBefore(convAura.host, seatParent.firstChild);
          if (convAura.ro) {
            try {
              convAura.ro.observe(seatParent);
            } catch {}
          }
          const canDeferRelayout =
            Boolean(convAura.ro) &&
            convAura.width > 0 &&
            convAura.height > 0 &&
            typeof requestAnimationFrame === 'function' &&
            !document.hidden;
          if (!canDeferRelayout && typeof convAura.relayout === 'function') convAura.relayout();
          const nowRe = readNowMs();
          const runRe = isConvRunning();
          convAura.wasRunning = runRe;
          convAura.runStartedAt = runRe ? nowRe : 0;
          convAura.decisionHolding = false;
          convAura.unfocusedHold = false;
          convAura.sleepReason = '';
          convAura.phase = runRe ? 'running' : 'idle';
          convAura.phaseAt = nowRe;
          setAttrIfChanged(convAura.host, 'data-aura-phase', convAura.phase);
          convAura.wake(!canDeferRelayout);
          return;
        }
        const prevPhase = convAura.phase;
        const nextPhase = advancePhase(readNowMs());
        const shouldResumeFromMotionOrVis =
          isMotionStandardOrUltra() &&
          !isP() &&
          convAura.sleeping &&
          convAura.sleepReason !== 'settled' &&
          convAura.sleepReason !== 'ambient-zero';
        if (nextPhase !== prevPhase || shouldResumeFromMotionOrVis) {
          if (shouldResumeFromMotionOrVis && nextPhase === 'idle') {
            convAura.phaseAt = readNowMs();
          }
          convAura.sleepReason = '';
          convAura.wake(true);
        }
        return;
      }

      const host = document.createElement('div');
      host.className = 'ag-cs-conv-aura-host';
      host.setAttribute('data-ag-no-i18n', '');
      host.setAttribute('aria-hidden', 'true');
      host.style.setProperty('top', 'auto', 'important');
      host.style.setProperty('bottom', '0', 'important');
      host.style.setProperty('left', '0', 'important');
      host.style.setProperty('right', '0', 'important');
      host.style.setProperty('height', '32%', 'important');

      const glowCanvas = document.createElement('canvas');
      glowCanvas.className = 'ag-cs-conv-glow';
      host.appendChild(glowCanvas);
      seatParent.insertBefore(host, seatParent.firstChild);

      const initNow = readNowMs();
      const initRunning = isConvRunning();
      const initAwaiting = externalAwaiting !== null ? Boolean(externalAwaiting) : isAwaitingDecision();
      const initPhase = initAwaiting ? 'awaiting-decision' : initRunning ? 'running' : 'idle';
      host.setAttribute('data-aura-phase', initPhase);
      consumeFreshDomError(convView); // prime historical errors without firing false alarm on initial mount

      const state = {
        seatParent,
        convView,
        host,
        canvas: glowCanvas,
        width: -1,
        height: -1,
        dpr: 0,
        phase: initPhase,
        phaseAt: initNow,
        runStartedAt: initRunning ? initNow : 0,
        liftoffAt: 0,
        sleeping: false,
        sleepReason: '',
        decisionHolding: false,
        unfocusedHold: false,
        pendingErrorClear: false,
        onUserReturn: null,
        drawCount: 0,
        lastOptics: null,
        wasRunning: initRunning,
        glow:
          rippleCore && typeof rippleCore.mountBrandHorizonGlow === 'function'
            ? rippleCore.mountBrandHorizonGlow(glowCanvas)
            : { mode: 'none', resize() {}, clear() {}, draw() {}, drawStaticSnapshot() {}, dispose() {} },
        timer: 0,
        rafId: 0,
        ro: null,
        onVis: null,
        wake: null,
        refreshTheme: null,
      };

      let frameWanted = false;
      let drawnOnce = false;
      let lastGpuDrawAt = 0;
      let forceImmediateDraw = false;

      function applySize(w, parentH) {
        const h = parentH > 0 ? Math.max(1, Math.round(parentH * CONV_AURA_HEIGHT_RATIO)) : 0;
        const rawDpr = (typeof window !== 'undefined' && Number(window.devicePixelRatio)) || 1;
        const dpr =
          rippleCore && typeof rippleCore.resolveHorizonDpr === 'function'
            ? rippleCore.resolveHorizonDpr(rawDpr, 0.72)
            : Math.min(rawDpr, 1) * 0.72;
        if (w === state.width && h === state.height && dpr === state.dpr) return;
        state.width = w;
        state.height = h;
        state.dpr = dpr;
        if (state.glow && typeof state.glow.resize === 'function' && w > 0 && h > 0) {
          try {
            state.glow.resize(w, h, dpr);
          } catch {}
        }
        drawnOnce = false;
      }

      function layout(forceRead = false) {
        if (!forceRead && state.ro && state.width > 0 && state.height > 0) return;
        const w = seatParent.clientWidth || convView.clientWidth || 0;
        const parentH = seatParent.clientHeight || convView.clientHeight || 0;
        applySize(w, parentH);
      }

      function enterAuraSleep(reason = 'settled') {
        if (state.timer) {
          clearTimeout(state.timer);
          state.timer = 0;
        }
        if (state.rafId && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(state.rafId);
          state.rafId = 0;
        }
        frameWanted = false;
        state.sleeping = true;
        state.sleepReason = reason;
        setAttrIfChanged(host, 'data-aura-sleep', '1');
      }

      function drawNow(now) {
        state.rafId = 0;
        frameWanted = false;
        if (isDestroyed() || convAura !== state) return;

        const ambient = resolveAmbient();
        if (ambient <= 0) {
          if (state.glow && typeof state.glow.clear === 'function') {
            try {
              state.glow.clear();
            } catch {}
          }
          state.lastOptics = { strength: 0, reach: 0.08, prism: 0, surge: 0, speed: 0, semantic: 'none', frameMs: 0 };
          enterAuraSleep('ambient-zero');
          return;
        }

        const allowLivingFlow = isMotionStandardOrUltra() && !isP();
        const liftElapsed = state.liftoffAt > 0 ? now - state.liftoffAt : -1;
        const inLiftoffEbb = allowLivingFlow && liftElapsed >= 0 && liftElapsed < 520;
        if (state.liftoffAt > 0 && !inLiftoffEbb) {
          state.liftoffAt = 0;
        }

        const prevPhaseBeforeAdv = state.phase;
        const phase = advancePhase(now, true);
        const phaseJustChanged = phase !== prevPhaseBeforeAdv;
        const dark = isDarkTheme();
        const spectrum = resolveSpectrum();

        let opt = computeConvAuraOptics(phase, state.phaseAt, now, dark, state.wasRunning);
        if (inLiftoffEbb) {
          const p = Math.max(0, Math.min(1, liftElapsed / 520));
          const ease = 1 - Math.pow(1 - p, 2.25);
          const endStr = dark ? 0.31 : 0.64;
          opt = {
            strength: 0.92 + (endStr - 0.92) * ease,
            reach: scaleConvReach(0.31 + (0.22 - 0.31) * ease),
            prism: 0.78 + (0.70 - 0.78) * ease,
            surge: 0.38 * (1 - ease),
            speed: 1.65 + (1.45 - 1.65) * ease,
            semantic: 'none',
            frameMs: 16,
          };
        }

        // Split-Rate 300Hz VSync throttle: only short burst transients run high-rate; steady running/breathing strictly obey opt.frameMs (~30fps)
        const isGpuGlow = Boolean(state.glow && state.glow.mode === 'webgl2');
        const minGap = isGpuGlow && typeof getMinFrameGapMs === 'function' ? Number(getMinFrameGapMs() || 0) : 0;
        const isBurstTransient = inLiftoffEbb || phase === 'start';
        const effectiveMinGap = isBurstTransient
          ? minGap
          : Math.max(minGap, Math.max(0, (opt.frameMs || 32) - 2));

        const bypassThrottle = forceImmediateDraw || phaseJustChanged || !drawnOnce;
        forceImmediateDraw = false;

        if (!bypassThrottle && allowLivingFlow && effectiveMinGap > 0 && lastGpuDrawAt > 0 && now - lastGpuDrawAt < effectiveMinGap) {
          const rem = Math.max(4, Math.ceil(effectiveMinGap - (now - lastGpuDrawAt)));
          clearTimeout(state.timer);
          state.timer = setTimeout(() => wake(false), rem);
          return;
        }

        lastGpuDrawAt = now;
        layout();

        // Check terminal 0fps snapshot conditions before/at render
        const phaseElapsed = now - state.phaseAt;
        const settleDecisionHold = allowLivingFlow && phase === 'awaiting-decision' && phaseElapsed >= CONV_AURA_DECISION_BREATH_MS;
        const settleErrorZero = Boolean(state.pendingErrorClear) || (phase === 'error-halted' && phaseElapsed >= CONV_AURA_ERROR_MS);
        const settleLongComplete = allowLivingFlow && phase === 'long-task-complete' && phaseElapsed >= CONV_AURA_LONG_COMPLETE_MS;
        const settleIdleSleep = allowLivingFlow && phase === 'idle' && !inLiftoffEbb && phaseElapsed >= CONV_AURA_IDLE_SLEEP_MS;

        if (settleErrorZero) {
          state.pendingErrorClear = false;
          if (state.glow && typeof state.glow.clear === 'function') {
            try {
              state.glow.clear();
            } catch {}
          }
          state.phase = 'idle';
          state.phaseAt = now - CONV_AURA_IDLE_SLEEP_MS;
          setAttrIfChanged(host, 'data-aura-phase', 'idle');
          state.lastOptics = { ...opt, strength: 0, surge: 0, speed: 0 };
          enterAuraSleep();
          return;
        }

        if (settleDecisionHold) {
          const holdOpt = {
            strength: dark ? 0.22 : 0.42,
            reach: scaleConvReach(0.18),
            prism: 0.30,
            surge: 0,
            speed: 0,
            semantic: 'awaiting-decision',
            frameMs: 0,
          };
          state.lastOptics = holdOpt;
          state.decisionHolding = true;
          if (state.width > 0 && state.height > 0) {
            invokeConvGlowDraw(state.glow, now, dark, true, holdOpt, ambient, spectrum);
            state.drawCount += 1;
            drawnOnce = true;
          }
          enterAuraSleep();
          return;
        }

        if (settleLongComplete) {
          const focused = checkWindowFocused();
          if (!focused) {
            const jadeHoldOpt = {
              strength: dark ? 0.16 : 0.30,
              reach: scaleConvReach(0.17),
              prism: 0.24,
              surge: 0,
              speed: 0,
              semantic: 'long-task-complete',
              frameMs: 0,
            };
            state.lastOptics = jadeHoldOpt;
            state.unfocusedHold = true;
            if (state.width > 0 && state.height > 0) {
              invokeConvGlowDraw(state.glow, now, dark, true, jadeHoldOpt, ambient, spectrum);
              state.drawCount += 1;
              drawnOnce = true;
            }
            attachFocusWakeListeners(state);
            enterAuraSleep('settled');
            return;
          }
          state.phase = 'idle';
          state.phaseAt = now - CONV_AURA_IDLE_SLEEP_MS;
          setAttrIfChanged(host, 'data-aura-phase', 'idle');
          const idleSnapOpt = computeConvAuraOptics('idle', state.phaseAt, now, dark, false);
          state.lastOptics = idleSnapOpt;
          if (state.width > 0 && state.height > 0) {
            invokeConvGlowDraw(state.glow, now, dark, true, idleSnapOpt, ambient, spectrum);
            state.drawCount += 1;
            drawnOnce = true;
          }
          enterAuraSleep();
          return;
        }

        const still = !allowLivingFlow || settleIdleSleep;
        state.lastOptics = opt;

        if (state.width > 0 && state.height > 0) {
          if (still && state.glow && typeof state.glow.invalidate === 'function') {
            state.glow.invalidate();
          }
          invokeConvGlowDraw(state.glow, now, dark, still, opt, ambient, spectrum);
          state.drawCount += 1;
          drawnOnce = true;
        }

        if (isDestroyed() || !allowLivingFlow || settleIdleSleep) {
          const reason = !allowLivingFlow ? (isP() ? 'hidden' : 'motion-still') : 'settled';
          enterAuraSleep(reason);
          return;
        }

        state.sleeping = false;
        state.sleepReason = '';
        if (host.hasAttribute('data-aura-sleep')) host.removeAttribute('data-aura-sleep');

        if (isGpuGlow && isBurstTransient) {
          wake(false);
          return;
        }

        let nextDelay = opt.frameMs || 32;
        if (inLiftoffEbb) {
          nextDelay = Math.min(16, Math.max(8, 520 - liftElapsed + 4));
        } else if (phase === 'start') {
          nextDelay = Math.min(nextDelay, Math.max(16, CONV_AURA_START_MS - phaseElapsed + 4));
        } else if (phase === 'complete') {
          nextDelay = Math.min(nextDelay, Math.max(16, CONV_AURA_COMPLETE_MS - phaseElapsed + 4));
        } else if (phase === 'awaiting-decision') {
          nextDelay = Math.min(nextDelay, Math.max(16, CONV_AURA_DECISION_BREATH_MS - phaseElapsed + 4));
        } else if (phase === 'error-halted') {
          nextDelay = Math.min(nextDelay, Math.max(16, CONV_AURA_ERROR_MS - phaseElapsed + 4));
        } else if (phase === 'long-task-complete') {
          nextDelay = Math.min(nextDelay, Math.max(16, CONV_AURA_LONG_COMPLETE_MS - phaseElapsed + 4));
        } else if (phase === 'idle') {
          nextDelay = Math.min(nextDelay, Math.max(20, CONV_AURA_IDLE_SLEEP_MS - phaseElapsed + 4));
        }
        clearTimeout(state.timer);
        state.timer = setTimeout(() => wake(false), nextDelay);
      }

      function wake(immediate = false) {
        if (state.timer) {
          clearTimeout(state.timer);
          state.timer = 0;
        }
        if (isDestroyed() || convAura !== state) return;
        if (isP()) {
          if (!drawnOnce) {
            forceImmediateDraw = true;
            drawNow(readNowMs());
          }
          enterAuraSleep('hidden');
          return;
        }
        if (immediate) {
          if (state.rafId && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(state.rafId);
            state.rafId = 0;
          }
          frameWanted = false;
          forceImmediateDraw = true;
          drawNow(readNowMs());
          return;
        }
        if (frameWanted) return;
        frameWanted = true;
        if (typeof requestAnimationFrame === 'function') {
          state.rafId = requestAnimationFrame(drawNow);
        } else {
          drawNow(readNowMs());
        }
      }

      state.wake = wake;
      state.relayout = () => {
        state.width = -1;
        state.height = -1;
        drawnOnce = false;
        layout(true);
      };
      state.refreshTheme = () => {
        if (state.glow && typeof state.glow.invalidate === 'function') state.glow.invalidate();
        if (state.decisionHolding || state.unfocusedHold || state.sleepReason === 'settled') {
          forceImmediateDraw = true;
          drawNow(readNowMs());
        } else {
          state.sleepReason = '';
          wake(true);
        }
      };
      state.onVis = () => {
        if (!document.hidden) {
          if (state.sleepReason === 'hidden') {
            state.sleepReason = '';
            wake(true);
          }
        } else {
          enterAuraSleep('hidden');
        }
      };
      document.addEventListener('visibilitychange', state.onVis);

      if (typeof ResizeObserver === 'function') {
        state.ro = new ResizeObserver((entries) => {
          const prevW = state.width;
          const prevH = state.height;
          const cr = entries && entries[0] && entries[0].contentRect;
          if (cr && cr.width > 0 && cr.height > 0) {
            applySize(Math.round(cr.width), Math.round(cr.height));
          } else {
            layout(true);
          }
          if (state.width !== prevW || state.height !== prevH) wake(false);
        });
        state.ro.observe(seatParent);
      }

      convAura = state;
      layout(true);
      wake(true);
    }

    function triggerStart() {
      if (isDestroyed() || !isHomeRippleEnabled()) return;
      if (!convAura) sync();
      if (!convAura) return;
      const now = readNowMs();
      detachFocusWakeListeners(convAura);
      convAura.decisionHolding = false;
      convAura.unfocusedHold = false;
      convAura.sleepReason = '';
      if (!convAura.runStartedAt) convAura.runStartedAt = now;
      if (convAura.phase !== 'start' || now - convAura.phaseAt > 240) {
        convAura.phase = 'start';
        convAura.phaseAt = now;
        setAttrIfChanged(convAura.host, 'data-aura-phase', 'start');
      }
      convAura.wake(true);
    }

    function triggerLiftoffEbb(now = readNowMs()) {
      if (!convAura) sync();
      if (convAura) {
        convAura.liftoffAt = now;
        convAura.sleepReason = '';
        convAura.wake(true);
      }
    }

    function setAmbientIntensity(val) {
      overrideAmbient = val === null || val === undefined ? null : clamp01(val, 1);
      if (convAura) {
        convAura.sleepReason = '';
        convAura.wake(true);
      }
    }

    function setSpectrumMode(mode) {
      overrideSpectrum = mode === null || mode === undefined ? null : String(mode);
      if (convAura && typeof convAura.refreshTheme === 'function') {
        convAura.refreshTheme();
      }
    }

    function setSemanticState(patch = {}) {
      if (!patch || typeof patch !== 'object') return;
      if ('awaitingDecision' in patch) {
        externalAwaiting = patch.awaitingDecision === null ? null : Boolean(patch.awaitingDecision);
      }
      if (patch.hasError === true) {
        externalErrorPending = true;
      }
      if (convAura) {
        const prev = convAura.phase;
        const next = advancePhase(readNowMs());
        if (next !== prev || externalErrorPending) {
          convAura.sleepReason = '';
          convAura.wake(true);
        }
      }
    }

    function triggerErrorHalted(now = readNowMs()) {
      externalErrorPending = true;
      if (!convAura) sync();
      if (convAura) {
        advancePhase(now);
        convAura.wake(true);
      }
    }

    function triggerLongTaskComplete(now = readNowMs()) {
      if (!convAura) sync();
      if (convAura) {
        detachFocusWakeListeners(convAura);
        convAura.wasRunning = false;
        convAura.runStartedAt = 0;
        convAura.decisionHolding = false;
        convAura.unfocusedHold = false;
        convAura.sleepReason = '';
        convAura.phase = 'long-task-complete';
        convAura.phaseAt = now;
        setAttrIfChanged(convAura.host, 'data-aura-phase', 'long-task-complete');
        convAura.wake(true);
      }
    }

    function refreshTheme() {
      if (convAura && typeof convAura.refreshTheme === 'function') convAura.refreshTheme();
    }

    function getInstance() {
      return convAura;
    }

    return {
      prime,
      sync,
      unmount,
      triggerStart,
      triggerLiftoffEbb,
      advancePhase,
      refreshTheme,
      setAmbientIntensity,
      setSpectrumMode,
      setSemanticState,
      triggerErrorHalted,
      triggerLongTaskComplete,
      getInstance,
    };
  }

  G.__agPrismConvAura = {
    CONV_AURA_HEIGHT_RATIO,
    CONV_AURA_IDLE_SLEEP_MS,
    CONV_AURA_DECISION_BREATH_MS,
    CONV_AURA_ERROR_MS,
    CONV_AURA_LONG_TASK_THRESHOLD_MS,
    CONV_AURA_LONG_COMPLETE_MS,
    isConvRunning,
    isAwaitingDecision,
    computeConvAuraOptics,
    createConvAuraController,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
