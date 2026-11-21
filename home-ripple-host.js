// Obsidian Prism — Home Interactive ASCII Matrix & Silk Skimmer Ripple Host (home-ripple-host.js)
// Extracted from ui-runtime.js: manages WebGL2/2D glyph ripple field, horizon glow, skimmer physics, and 0fps true idle sleep.

(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  if (!G) return;

  const RIPPLE_INTRO_MS = 1600;
  const AURA_IDLE_SLEEP_MS = 1200;

  const parseAmbientScale = (raw) =>
    G.__agPrismRipple?.parseAmbientScale
      ? G.__agPrismRipple.parseAmbientScale(raw)
      : raw === null || raw === undefined || raw === ''
      ? 1
      : Math.max(0, Math.min(1, Number(raw) > 1 ? Number(raw) / 100 : Number.isFinite(Number(raw)) ? Number(raw) : 1));

  function createHomeRippleController({
    rippleCore,
    isDestroyed,
    isAllowed,
    isDarkTheme,
    motionReduced,
    getMinFrameGapMs,
    getAmbientIntensity,
    getAccentTone,
    setAttrIfChanged,
    onPointerPressMascot,
  }) {
    let rippleMount = null;

    function getRootHtml() {
      return typeof document !== 'undefined' ? document.documentElement : null;
    }

    function resolveAmbientScale() {
      if (typeof getAmbientIntensity === 'function') {
        return parseAmbientScale(getAmbientIntensity());
      }
      return parseAmbientScale(getRootHtml()?.getAttribute?.('data-ag-cs-ambient'));
    }

    function resolveSpectrumMode(dark) {
      const html = getRootHtml();
      const rawTone =
        (typeof getAccentTone === 'function' ? getAccentTone() : null) ||
        html?.getAttribute?.('data-ag-cs-accent') ||
        'follow';
      if (rawTone === 'mono' || rawTone === 'cobalt' || rawTone === 'iris' || rawTone === 'amber') {
        return rawTone;
      }
      const pal = html?.getAttribute?.('data-ag-cs-palette') || 'obsidian';
      if (pal === 'warm' || pal === 'claude') return 'warm';
      if (!dark && html?.getAttribute?.('data-ag-cs-light-preset') === 'alabaster') return 'warm';
      return 'default';
    }

    function sampleRippleThemeTokens(canvas) {
      const cs = typeof getComputedStyle === 'function' ? getComputedStyle(canvas) : null;
      const dark = isDarkTheme();
      const spec = resolveSpectrumMode(dark);
      const defaultWaveLight =
        spec === 'mono'
          ? [51, 65, 85]
          : spec === 'iris'
          ? [124, 58, 237]
          : spec === 'amber'
          ? [217, 119, 6]
          : spec === 'warm'
          ? [194, 89, 52]
          : [37, 99, 235];
      const ink =
        (cs && rippleCore.parseCssColorToRgb(cs.getPropertyValue('--ag-cs-ripple-ink'))) ||
        (dark ? [146, 148, 156] : [104, 114, 134]);
      const wave =
        (cs && rippleCore.parseCssColorToRgb(cs.getPropertyValue('--ag-cs-ripple-wave'))) ||
        (dark ? [214, 218, 228] : defaultWaveLight);
      const fontFamily = (cs && cs.getPropertyValue('--font-mono').trim()) || 'ui-monospace, Consolas, monospace';
      return { ink, wave, dark, fontFamily };
    }

    function buildRipplePalette(tokens, auraState, now, ambientScale = 1, spectrumMode = 'default') {
      const t = tokens || {
        ink: isDarkTheme() ? [146, 148, 156] : [104, 114, 134],
        wave: isDarkTheme() ? [214, 218, 228] : [37, 99, 235],
        dark: isDarkTheme(),
        fontFamily: 'ui-monospace, Consolas, monospace',
      };
      const amb = Math.max(0, Math.min(1, Number.isFinite(ambientScale) ? ambientScale : 1));
      const auraAllowed = Boolean(auraState && auraState.active && !motionReduced() && amb > 0.001);
      const aura = auraAllowed
        ? { x: auraState.x, y: auraState.y, radius: 230, strength: amb, active: true }
        : { x: 0, y: 0, radius: 230, strength: 0, active: false };
      return {
        ink: t.ink,
        wave: t.wave,
        dark: t.dark,
        fontFamily: t.fontFamily,
        prismStrength: amb * (spectrumMode === 'mono' ? 0.45 : 1),
        ambientIntensity: amb,
        spectrum: spectrumMode,
        nebula: amb <= 0.001 ? false : undefined,
        aura,
        auraPhase: (now || 0) * 0.0006,
      };
    }

    function parkRipple() {
      if (!rippleMount) return;
      if (rippleMount.timer) {
        clearTimeout(rippleMount.timer);
        rippleMount.timer = 0;
      }
      if (rippleMount.rafId) {
        cancelAnimationFrame(rippleMount.rafId);
        rippleMount.rafId = 0;
      }
      if (rippleMount.ro) rippleMount.ro.disconnect();
      if (rippleMount.root) {
        rippleMount.root.removeEventListener('pointerdown', rippleMount.onPress);
        if (rippleMount.onMove) rippleMount.root.removeEventListener('pointermove', rippleMount.onMove);
        if (rippleMount.onLeave) rippleMount.root.removeEventListener('pointerleave', rippleMount.onLeave);
        rippleMount.root = null;
      }
      rippleMount.host.remove();
      rippleMount.sleeping = true;
      rippleMount.parked = true;
    }

    function unmountRipple() {
      if (!rippleMount) return;
      if (rippleMount.timer) clearTimeout(rippleMount.timer);
      if (rippleMount.rafId) cancelAnimationFrame(rippleMount.rafId);
      if (rippleMount.ro) rippleMount.ro.disconnect();
      if (rippleMount.root) {
        rippleMount.root.removeEventListener('pointerdown', rippleMount.onPress);
        if (rippleMount.onMove) rippleMount.root.removeEventListener('pointermove', rippleMount.onMove);
        if (rippleMount.onLeave) rippleMount.root.removeEventListener('pointerleave', rippleMount.onLeave);
        rippleMount.root = null;
      }
      document.removeEventListener('visibilitychange', rippleMount.onVis);
      rippleMount.field.dispose();
      if (rippleMount.glow && typeof rippleMount.glow.dispose === 'function') rippleMount.glow.dispose();
      rippleMount.host.remove();
      rippleMount = null;
    }

    function syncRipple() {
      if (!rippleCore) return;
      if (!isAllowed()) {
        unmountRipple();
        return;
      }
      const home = document.querySelector('.agy-home');
      if (!home) {
        if (rippleMount && !rippleMount.parked) parkRipple();
        return;
      }
      if (rippleMount) {
        if (rippleMount.parked || rippleMount.root !== home || !rippleMount.canvas.isConnected) {
          if (rippleMount.ro) rippleMount.ro.disconnect();
          if (rippleMount.root && rippleMount.root !== home) {
            rippleMount.root.removeEventListener('pointerdown', rippleMount.onPress);
            if (rippleMount.onMove) rippleMount.root.removeEventListener('pointermove', rippleMount.onMove);
            if (rippleMount.onLeave) rippleMount.root.removeEventListener('pointerleave', rippleMount.onLeave);
          }
          rippleMount.root = home;
          rippleMount.parked = false;
          rippleMount.mountedAt = performance.now();
          home.insertBefore(rippleMount.host, home.firstChild);
          home.addEventListener('pointerdown', rippleMount.onPress, { passive: true });
          home.addEventListener('pointermove', rippleMount.onMove, { passive: true });
          home.addEventListener('pointerleave', rippleMount.onLeave, { passive: true });
          if (rippleMount.ro) rippleMount.ro.observe(home);
          if (typeof rippleMount.reattach === 'function') rippleMount.reattach();
        }
        return;
      }

      const host = document.createElement('div');
      host.className = 'ag-cs-ripple-host';
      host.setAttribute('aria-hidden', 'true');
      const glowCanvas = document.createElement('canvas');
      glowCanvas.className = 'ag-cs-brand-glow';
      glowCanvas.setAttribute('data-testid', 'onboarding-brand-glow');
      glowCanvas.setAttribute('aria-hidden', 'true');
      host.appendChild(glowCanvas);
      const canvas = document.createElement('canvas');
      canvas.className = 'ag-cs-ripple-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      host.appendChild(canvas);
      home.insertBefore(host, home.firstChild);

      const auraState = { x: 0, y: 0, active: false };
      let lastSkimX = null;
      let lastSkimY = null;
      let lastSkimAt = 0;
      let skimCarryDist = 0;
      let cachedThemeTokens = null;
      let cachedCanvasRect = null;
      let cachedCanvasRectAt = 0;

      const state = {
        root: home,
        host,
        glowCanvas,
        canvas,
        width: -1,
        height: -1,
        dpr: 0,
        mountedAt: performance.now(),
        sleeping: false,
        parked: false,
        glowClearedAtZero: false,
        aura: { reach: 0.47, strength: 1.0 },
        tideSwellAt: 0,
        waves: { height: new Float32Array(0), active: () => false, disturb() {}, skimmer() {}, advance() {} },
        glow:
          typeof rippleCore.mountBrandHorizonGlow === 'function'
            ? rippleCore.mountBrandHorizonGlow(glowCanvas)
            : { mode: 'none', resize() {}, draw() {}, dispose() {} },
        field: { mode: 'none', dispose() {}, invalidate() {}, setCalmZones() {}, draw() {}, needsDraw: () => false, busy: () => false },
        timer: 0,
        rafId: 0,
        ro: null,
        onPress: null,
        onMove: null,
        onLeave: null,
        onVis: null,
        wake: null,
        reattach: null,
        refreshTheme: null,
      };
      let previous = state.mountedAt;
      let lastRippleRenderAt = 0;
      let frameWanted = false;
      let drawnOnce = false;
      let forceSingleDraw = true;

      function updateCalmZones() {
        const curHome = state.root;
        if (!curHome || !state.field || typeof state.field.setCalmZones !== 'function') return;
        const greet = curHome.querySelector('[data-testid="home-greeting"]');
        if (!greet) {
          state.field.setCalmZones([]);
          return;
        }
        const c = canvas.getBoundingClientRect();
        cachedCanvasRect = c;
        cachedCanvasRectAt = performance.now();
        const g = greet.getBoundingClientRect();
        if (!c.width || !g.width) return;
        state.field.setCalmZones([
          { x: g.left - c.left - 28, y: g.top - c.top - 14, w: g.width + 56, h: g.height + 28 },
        ]);
      }

      function layout() {
        const curHome = state.root;
        if (!curHome) return;
        const w = curHome.clientWidth;
        const h = curHome.clientHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (w === state.width && h === state.height && dpr === state.dpr) {
          cachedCanvasRect = null;
          return;
        }
        const cols = Math.ceil(w / rippleCore.RIPPLE.cellWidth);
        const rows = Math.ceil(h / rippleCore.RIPPLE.cellHeight);
        state.width = w;
        state.height = h;
        state.dpr = dpr;
        canvas.width = Math.round(cols * rippleCore.RIPPLE.cellWidth * dpr);
        canvas.height = Math.round(rows * rippleCore.RIPPLE.cellHeight * dpr);
        canvas.style.width = `${cols * rippleCore.RIPPLE.cellWidth}px`;
        canvas.style.height = `${rows * rippleCore.RIPPLE.cellHeight}px`;
        if (state.glow && typeof state.glow.resize === 'function') {
          state.glow.resize(w, h, 0.6);
        }
        state.field.dispose();
        state.waves = rippleCore.createWaveField(cols, rows);
        state.field = rippleCore.createGlyphField(canvas, cols, rows, state.waves);
        cachedThemeTokens = sampleRippleThemeTokens(canvas);
        cachedCanvasRect = null;
        updateCalmZones();
        drawnOnce = false;
        forceSingleDraw = true;
      }

      function enterIdleSleep() {
        if (state.timer) {
          clearTimeout(state.timer);
          state.timer = 0;
        }
        state.sleeping = true;
        setAttrIfChanged(host, 'data-ripple-sleep', '1');
      }

      const hP = () => document.hidden || document.documentElement?.getAttribute?.('data-ag-cs-win-blur') === '1';
      function wake() {
        if (state.timer) {
          clearTimeout(state.timer);
          state.timer = 0;
        }
        if (isDestroyed() || state.parked || frameWanted) return;
        state.sleeping = false;
        if (host.hasAttribute('data-ripple-sleep')) host.removeAttribute('data-ripple-sleep');
        if (hP()) {
          if (!drawnOnce && canvas.width > 0) drawFrame(performance.now());
          enterIdleSleep();
          return;
        }
        frameWanted = true;
        state.rafId = requestAnimationFrame(drawFrame);
      }

      function drawFrame(now) {
        state.rafId = 0;
        frameWanted = false;
        if (isDestroyed() || state.parked || (rippleMount !== state && rippleMount !== null)) return;
        const still = motionReduced();
        const minGap = getMinFrameGapMs();
        if (!still && drawnOnce && !forceSingleDraw && minGap > 0 && lastRippleRenderAt > 0 && now - lastRippleRenderAt < minGap && !document.hidden) {
          wake();
          return;
        }
        lastRippleRenderAt = now;
        state.waves.advance(still ? 0 : Math.min(0.05, Math.max(0, (now - previous) / 1000)));
        previous = now;
        const tideElapsed = state.tideSwellAt > 0 ? now - state.tideSwellAt : -1;
        const inTideSwell = !still && tideElapsed >= 0 && tideElapsed < 480;
        if (state.tideSwellAt > 0 && !inTideSwell) {
          state.tideSwellAt = 0;
          state.aura.reach = 0.47;
          state.aura.strength = 1.0;
          forceSingleDraw = true;
        } else if (inTideSwell) {
          const p = Math.max(0, Math.min(1, tideElapsed / 480));
          const ease = 1 - Math.pow(1 - p, 2.2);
          state.aura.reach = +(0.2 + (0.47 - 0.2) * ease).toFixed(4);
          state.aura.strength = +(0.32 + (1.0 - 0.32) * ease).toFixed(4);
        }

        const ambientScale = resolveAmbientScale();
        if (ambientScale <= 0.001 && auraState.active) {
          auraState.active = false;
        }
        const auraActiveRecent =
          ambientScale > 0.001 && auraState.active && lastSkimAt > 0 && now - lastSkimAt < AURA_IDLE_SLEEP_MS;
        const inIntro = !still && ambientScale > 0.001 && now - state.mountedAt < RIPPLE_INTRO_MS;
        const fieldBusy = Boolean(state.field && typeof state.field.busy === 'function' && state.field.busy());
        const needsGlowClear = ambientScale <= 0.001 && !state.glowClearedAtZero;
        const needsRender =
          forceSingleDraw ||
          !drawnOnce ||
          needsGlowClear ||
          inTideSwell ||
          inIntro ||
          auraActiveRecent ||
          (state.field && state.field.needsDraw(now, still));

        if (canvas.width > 0 && needsRender) {
          forceSingleDraw = false;
          if (!cachedThemeTokens) cachedThemeTokens = sampleRippleThemeTokens(canvas);
          const spectrumMode = resolveSpectrumMode(cachedThemeTokens.dark);
          const pal = buildRipplePalette(cachedThemeTokens, auraState, now, ambientScale, spectrumMode);
          if (ambientScale <= 0.001) {
            if (!state.glowClearedAtZero) {
              if (state.glow && typeof state.glow.clear === 'function') {
                state.glow.clear();
              }
              state.glowClearedAtZero = true;
            }
          } else {
            state.glowClearedAtZero = false;
            if (state.glow && typeof state.glow.draw === 'function') {
              state.glow.draw(now, {
                dark: pal.dark,
                still,
                strength: inTideSwell ? state.aura.strength : 1,
                reach: state.aura.reach,
                ambientIntensity: ambientScale,
                spectrum: spectrumMode,
              });
            }
          }
          state.field.draw(now, pal, still);
          drawnOnce = true;
        }

        if (isDestroyed() || hP() || still) {
          enterIdleSleep();
          return;
        }
        if (inTideSwell || fieldBusy || inIntro || auraActiveRecent) {
          wake();
        } else {
          enterIdleSleep();
        }
      }

      state.wake = wake;
      state.reattach = () => {
        previous = performance.now();
        frameWanted = false;
        forceSingleDraw = true;
        auraState.active = false;
        lastSkimX = null;
        lastSkimY = null;
        skimCarryDist = 0;
        const runReattachLayout = () => {
          if (isDestroyed() || state.parked) return;
          const prevW = state.width;
          const prevH = state.height;
          layout();
          if (state.width !== prevW || state.height !== prevH) {
            updateCalmZones();
          }
          state.field.invalidate();
          if (state.glow && typeof state.glow.invalidate === 'function') state.glow.invalidate();
          wake();
        };
        if (state.width > 0 && state.height > 0 && !document.hidden && typeof requestAnimationFrame === 'function') {
          if (state.rafId) cancelAnimationFrame(state.rafId);
          state.rafId = requestAnimationFrame(() => {
            state.rafId = 0;
            runReattachLayout();
          });
        } else {
          runReattachLayout();
        }
      };

      state.onMove = (ev) => {
        if (motionReduced()) return;
        const nowRect = performance.now();
        if (!cachedCanvasRect || nowRect - cachedCanvasRectAt > 1500) {
          cachedCanvasRect = canvas.getBoundingClientRect();
          cachedCanvasRectAt = nowRect;
        }
        const rect = cachedCanvasRect;
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
          lastSkimX = null;
          lastSkimY = null;
          skimCarryDist = 0;
          if (auraState.active) {
            auraState.active = false;
            forceSingleDraw = true;
            if (!state.field || state.field.mode !== 'webgl2') state.field.invalidate();
            wake();
          }
          return;
        }
        const now = performance.now();
        if (lastSkimX !== null && lastSkimY !== null) {
          const stepDist = Math.hypot(x - lastSkimX, y - lastSkimY);
          const dtSec = Math.max(0.004, (now - lastSkimAt) / 1000);
          const pxPerSec = stepDist / dtSec;
          if (pxPerSec >= 220) {
            skimCarryDist += stepDist;
            if (skimCarryDist >= 42) {
              skimCarryDist = Math.min(20, skimCarryDist - 42);
              const speedNorm = Math.max(0.05, Math.min(1, (pxPerSec - 220) / 1800));
              const col = Math.floor(x / rippleCore.RIPPLE.cellWidth);
              const row = Math.floor(y / rippleCore.RIPPLE.cellHeight);
              if (typeof state.waves.skimmer === 'function') {
                state.waves.skimmer(col, row, speedNorm);
              }
            }
          } else {
            skimCarryDist *= 0.85;
          }
        }
        lastSkimX = x;
        lastSkimY = y;
        lastSkimAt = now;
        const ambientNow = resolveAmbientScale();
        if (ambientNow > 0.001) {
          auraState.x = x;
          auraState.y = y;
          auraState.active = true;
          if (state.sleeping) previous = now;
          if (!state.field || state.field.mode !== 'webgl2') state.field.invalidate();
          wake();
        } else if (state.waves.active()) {
          if (state.sleeping) previous = now;
          state.field.invalidate();
          wake();
        }
      };

      state.onLeave = () => {
        lastSkimX = null;
        lastSkimY = null;
        skimCarryDist = 0;
        if (auraState.active) {
          auraState.active = false;
          forceSingleDraw = true;
          if (!state.field || state.field.mode !== 'webgl2') state.field.invalidate();
          wake();
        }
      };

      state.onPress = (ev) => {
        if (ev.button !== 0 || motionReduced()) return;
        const rect = canvas.getBoundingClientRect();
        cachedCanvasRect = rect;
        cachedCanvasRectAt = performance.now();
        const col = Math.floor((ev.clientX - rect.left) / rippleCore.RIPPLE.cellWidth);
        const row = Math.floor((ev.clientY - rect.top) / rippleCore.RIPPLE.cellHeight);
        if (state.sleeping) previous = performance.now();
        state.waves.disturb(col, row);
        state.field.invalidate();
        wake();
        if (typeof onPointerPressMascot === 'function') {
          onPointerPressMascot(ev.clientX);
        }
      };

      home.addEventListener('pointerdown', state.onPress, { passive: true });
      home.addEventListener('pointermove', state.onMove, { passive: true });
      home.addEventListener('pointerleave', state.onLeave, { passive: true });

      state.onVis = () => {
        if (!document.hidden) {
          previous = performance.now();
          forceSingleDraw = true;
          wake();
        } else {
          if (state.rafId) cancelAnimationFrame(state.rafId);
          state.rafId = 0;
          frameWanted = false;
          enterIdleSleep();
        }
      };
      document.addEventListener('visibilitychange', state.onVis);

      if (typeof ResizeObserver === 'function') {
        state.ro = new ResizeObserver(() => {
          layout();
          wake();
        });
        state.ro.observe(home);
      }
      rippleMount = state;
      layout();
      state.refreshTheme = () => {
        cachedThemeTokens = sampleRippleThemeTokens(canvas);
        forceSingleDraw = true;
        state.field.invalidate();
        if (state.glow && typeof state.glow.invalidate === 'function') state.glow.invalidate();
        if (document.hidden && canvas.width > 0) drawFrame(performance.now());
        else wake();
      };
      wake();
    }

    function refreshTheme() {
      if (rippleMount && typeof rippleMount.refreshTheme === 'function') {
        rippleMount.refreshTheme();
      }
    }

    function triggerLiftoffBurst(composerRect) {
      if (!rippleMount || typeof rippleMount.field?.triggerLiftoffBurst !== 'function') return;
      let normX = 0.5;
      let normY = 0.62;
      const cvRect = rippleMount.canvas?.getBoundingClientRect?.();
      if (composerRect && cvRect && cvRect.width > 0 && cvRect.height > 0) {
        normX = Math.max(0.05, Math.min(0.95, (composerRect.left + composerRect.width * 0.5 - cvRect.left) / cvRect.width));
        normY = Math.max(0.05, Math.min(0.95, (composerRect.top + composerRect.height * 0.5 - cvRect.top) / cvRect.height));
      }
      try {
        rippleMount.field.triggerLiftoffBurst(normX, normY);
        rippleMount.field.invalidate?.();
        rippleMount.wake?.();
      } catch {}
    }

    function triggerTideSwell() {
      if (!rippleMount) syncRipple();
      if (!rippleMount) return;
      rippleMount.tideSwellAt = performance.now();
      rippleMount.aura.reach = 0.2;
      rippleMount.aura.strength = 0.32;
      try {
        rippleMount.field?.triggerTideSwell?.();
        rippleMount.field?.invalidate?.();
        rippleMount.wake?.();
      } catch {}
    }

    return {
      sync: syncRipple,
      park: parkRipple,
      unmount: unmountRipple,
      refreshTheme,
      triggerLiftoffBurst,
      triggerTideSwell,
      getMount: () => rippleMount,
    };
  }

  const api = { createHomeRippleController };
  if (typeof module === 'object' && module.exports) module.exports = api;
  G.__agPrismHomeRippleHost = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
