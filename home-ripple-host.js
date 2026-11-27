// Obsidian Prism — Home & Conv Ripple Host
(function (root) {
  'use strict';
  const M = Math, G = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  if (!G) return;

  const INTRO_MS = 1600, IDLE_MS = 1200, RZ_MS = 120, RZ_WIN = 180;
  const HA = 'data-has-browser-hole', DHA = 'data-has-drawer-browser-hole', PMA = 'data-ag-cs-perf-mode', RZA = 'data-ag-cs-resizing';
  const CA = 'data-ag-cs-conv-ripple', HHA = 'data-ag-cs-conv-ripple-host', LA = 'data-conv-level', WB = 'data-ag-cs-win-blur';
  const PP_OPEN = 'data-ag-pp-open';
  const SB = 'aside,[data-side-panel-body]', GCLS = 'ag-cs-brand-glow', GTID = 'onboarding-brand-glow', RCLS = 'ag-cs-ripple-canvas';
  const CP = { subtle: [0.6, 0.4, 0.45, 0.55, 32, 340, 72, 196, 0.62, 0.28, 0.72], medium: [0.85, 0.75, 0.75, 0.82, 22, 270, 54, 215, 0.85, 0.34, 0.88], full: [1, 1, 1, 1, 16, 220, 42, 230, 1, 0.4, 1] };
  const isF = (v) => typeof v === 'function', ga = (e, k) => e?.getAttribute?.(k);
  const ra = (e, k) => { if (e?.hasAttribute?.(k)) e.removeAttribute(k); };
  const hasH = (e) => ga(e, HA) === 'true' || ga(e, DHA) === 'true';
  const docOf = () => (typeof document !== 'undefined' ? document : null);
  const nowOf = () => performance.now(), cl = (v, a, b) => M.max(a, M.min(b, v));
  const cAF = (id) => { if (id && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id); return 0; };
  const rAF = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : 0);
  const cT = (id) => { if (id) clearTimeout(id); return 0; };
  const pAmb = (r) => G.__agPrismRipple?.parseAmbientScale ? G.__agPrismRipple.parseAmbientScale(r) : r == null || r === '' ? 1 : cl(Number(r) > 1 ? Number(r) / 100 : Number.isFinite(Number(r)) ? Number(r) : 1, 0, 1);

  function createHomeRippleController({ rippleCore: rc, isDestroyed: isD, isAllowed, isConvAllowed, getConvLevel, isConvRunning, isDarkTheme, motionReduced: mRed, getMinFrameGapMs, getAmbientIntensity, getAccentTone, setAttrIfChanged: sa, onPointerPressMascot }) {
    let rm = null, cHost = null, timer = 0, rRaf = 0, recT = 0, recRaf = 0, rzT = 0, mAt = 0, tideAt = 0, ro = null, unWin = null, syncMFn = null, strChk = null, refLv = null;
    const html = () => docOf()?.documentElement || null, rw = () => G.__agPrismRippleWorker || null;
    const pMode = () => String(html()?.dataset?.agCsPerfMode || ga(html(), PMA) || '').trim().toLowerCase();
    const setCS = (on, el) => { const h = html(); if (h) on ? sa(h, CA, '1') : ra(h, CA); if (cHost && cHost !== el) ra(cHost, HHA); cHost = on && el ? el : null; if (cHost) sa(cHost, HHA, '1'); };
    const isCB = () => { const d = docOf(), h = d?.documentElement; return Boolean(mRed() || ga(h, 'data-ag-cs-motion') === 'off' || ga(h, 'data-ag-prism-wallpaper') === 'on' || hasH(h) || hasH(d?.body) || d?.querySelector?.('[data-has-browser-hole="true"],[data-has-drawer-browser-hole="true"]')); };
    const convLv = () => { if (isF(isConvAllowed) && !isConvAllowed()) return 'off'; if (isF(getConvLevel)) { const v = getConvLevel(); return v === true || v === 'true' || v === 'on' ? 'medium' : v === 'subtle' || v === 'medium' || v === 'full' ? v : 'off'; } return isF(isConvAllowed) && isConvAllowed() ? 'medium' : 'off'; };

    function resolveTarget() {
      const d = docOf();
      if (!d) return null;
      const home = d.querySelector('.agy-home');
      if (home) return isAllowed() ? { mode: 'home', root: home, level: 'off' } : null;
      const lv = convLv();
      if (lv === 'off' || isCB() || !isF(d.querySelectorAll)) return null;
      const vs = Array.from(d.querySelectorAll('[data-testid="conversation-view"]')).filter((v) => !v.hidden && v.style?.display !== 'none' && v.style?.visibility !== 'hidden' && !v.closest?.('[data-testid="subagent-tab-conversation"]'));
      if (!vs.length) return null;
      const ok = (el) => Boolean(el && el !== d.documentElement && el !== d.body && ga(el, 'data-testid') !== 'conversation-view' && !hasH(el) && !el.closest?.(SB) && !el.querySelector?.(SB + ',[data-testid="sidebar-split"]>div:first-child') && vs.every((v) => !isF(el.contains) || el.contains(v)));
      const v0 = vs[0];
      for (const s of ['[data-main-content-body]', '.agy-sheet', '[data-split-panes]', '.agy-inset-shell']) {
        const c = v0.closest?.(s);
        if (ok(c)) return { mode: 'conv', root: c, level: lv };
      }
      let p = v0.parentElement;
      if (vs.length > 1) { while (p && p !== d.body && p !== d.documentElement && !vs.every((v) => p.contains?.(v))) p = p.parentElement; }
      else if (p && (ga(p, 'data-ag-cs-conv-seat') === '1' || p.hasAttribute?.('data-tiling-pane')) && ok(p.parentElement)) p = p.parentElement;
      return ok(p) ? { mode: 'conv', root: p, level: lv } : null;
    }

    const ambScale = () => pAmb(isF(getAmbientIntensity) ? getAmbientIntensity() : ga(html(), 'data-ag-cs-ambient'));

    function specMode(dark) {
      const h = html(), t = (isF(getAccentTone) ? getAccentTone() : null) || ga(h, 'data-ag-cs-accent') || 'follow';
      if (t === 'mono' || t === 'cobalt' || t === 'iris' || t === 'amber') return t;
      const pal = ga(h, 'data-ag-cs-palette') || 'obsidian';
      return pal === 'warm' || pal === 'claude' || (!dark && pal === 'obsidian' && ga(h, 'data-ag-cs-light-preset') === 'alabaster') ? 'warm' : 'default';
    }

    const defTok = (dark, sp) => ({ ink: dark ? [146, 148, 156] : [104, 114, 134], wave: dark ? [214, 218, 228] : sp === 'mono' ? [51, 65, 85] : sp === 'iris' ? [124, 58, 237] : sp === 'amber' ? [217, 119, 6] : sp === 'warm' ? [194, 89, 52] : [37, 99, 235], dark, fontFamily: 'ui-monospace, Consolas, monospace' });
    function sampleTok(cv) {
      const cs = typeof getComputedStyle === 'function' ? getComputedStyle(cv) : null, dk = isDarkTheme(), t = defTok(dk, specMode(dk));
      if (!cs) return t;
      t.ink = rc.parseCssColorToRgb(cs.getPropertyValue('--ag-cs-ripple-ink')) || t.ink;
      t.wave = rc.parseCssColorToRgb(cs.getPropertyValue('--ag-cs-ripple-wave')) || t.wave;
      t.fontFamily = cs.getPropertyValue('--font-mono').trim() || t.fontFamily;
      return t;
    }
    function buildPal(tok, as, now, aRaw, sp, mode, lv) {
      const t = tok || defTok(isDarkTheme(), sp), amb = cl(Number.isFinite(aRaw) ? aRaw : 1, 0, 1);
      const c = mode === 'conv', cp = c ? CP[lv] || CP.medium : null, rad = cp ? cp[7] : 230, fd = as?.f ?? 1, on = Boolean(as?.active && fd > 0.005 && !mRed() && amb > 0.001);
      return {
        ink: t.ink, wave: t.wave, dark: t.dark, fontFamily: t.fontFamily, conv: c,
        alphaScale: cp ? (amb <= 0.001 ? 0 : cp[0]) : 1, nebulaLiftScale: cp ? cp[1] : 1, auraLiftScale: cp ? cp[2] : 1,
        prismStrength: amb * (sp === 'mono' ? 0.45 : 1) * (cp ? cp[8] : 1), ambientIntensity: amb, spectrum: sp, nebula: amb <= 0.001 ? false : undefined,
        aura: on ? { x: as.x, y: as.y, radius: rad, strength: amb * (cp ? cp[3] : 1) * fd, active: true } : { x: 0, y: 0, radius: rad, strength: 0, active: false },
        auraPhase: (now || 0) * (cp ? 0.00045 + 0.00015 * cp[3] : 0.0006),
      };
    }
    const bindR = (el, m, add) => { const fn = add ? 'addEventListener' : 'removeEventListener', o = add ? { passive: true } : undefined; el[fn]('pointerdown', m.onPress, o); m.onMove && el[fn]('pointermove', m.onMove, o); m.onLeave && el[fn]('pointerleave', m.onLeave, o); };

    const stopT = (m) => { timer = cT(timer); m.rafId = cAF(m.rafId); rRaf = cAF(rRaf); };
    const clrRec = () => { recT = cT(recT); recRaf = cAF(recRaf); };
    const detR = (m) => { if (m?.root) { bindR(m.root, m, false); m.root = null; } };

    function parkRipple() {
      setCS(false, null);
      if (!rm) return;
      stopT(rm); clrRec(); rzT = cT(rzT); ro?.disconnect(); detR(rm);
      rm.host.remove(); rm.reclaim?.(); rm.sleeping = rm.parked = true;
    }

    function unmountRipple() {
      setCS(false, null);
      if (!rm) return;
      const m = rm;
      stopT(m); clrRec(); rzT = cT(rzT); ro?.disconnect(); unWin?.(); detR(m);
      m.field?.dispose?.(); m.glow?.dispose?.(); m.host.remove();
      rm = ro = unWin = syncMFn = strChk = refLv = null;
    }

    function isIgnC(t, press) {
      if (!t?.closest) return false;
      if (t.closest(SB + ',.agy-overlay,.aux-drawer-popup')) return true;
      const role = ga(t.closest('[role]'), 'role') || '';
      if (role === 'dialog') return true;
      return Boolean(press && (/^(?:button|textbox|menu|listbox|menuitem|tab|switch)$/.test(role) || t.closest('button,a,input,textarea,select,label,summary,[contenteditable="true"],[data-testid="agent-input-box"],.surface-composer-card,.monaco-editor')));
    }

    function mountR(m, mode, tr) {
      m.root = tr; m.parked = false; mAt = nowOf();
      setCS(mode === 'conv', tr); tr.insertBefore(m.host, tr.firstChild); bindR(tr, m, true); ro?.observe(tr);
    }

    function syncRipple() {
      if (!rc) return;
      if (!isAllowed() && convLv() === 'off') return unmountRipple();
      const tgt = resolveTarget();
      if (!tgt) { setCS(false, null); if (rm && !rm.parked) parkRipple(); return; }
      const { mode, root: tr } = tgt, lv = tgt.level || 'off';
      if (rm) {
        const mc = rm.mode !== mode, lc = rm.convLevel !== lv;
        if (rm.parked || rm.root !== tr || !rm.canvas.isConnected || mc) {
          ro?.disconnect();
          if (rm.root !== tr) detR(rm);
          rm.convLevel = lv; sa(rm.host, LA, lv);
          if (mc) { rm.mode = mode; sa(rm.host, 'data-ripple-mode', mode); syncMFn?.(mode); }
          mountR(rm, mode, tr); rm.reattach?.();
        } else {
          setCS(mode === 'conv', tr);
          if (lc) { rm.convLevel = lv; sa(rm.host, LA, lv); refLv?.(); } else if (mode === 'conv') strChk?.();
        }
        return;
      }

      const d = docOf();
      const mkEl = (tag, cls) => { const el = d.createElement(tag); el.className = cls; el.setAttribute('aria-hidden', 'true'); return el; };
      const host = mkEl('div', 'ag-cs-ripple-host');
      host.setAttribute('data-ripple-mode', mode); host.setAttribute(LA, lv);
      let cv = mkEl('canvas', RCLS); host.appendChild(cv);

      const as = { x: 0, y: 0, active: false };
      mAt = nowOf(); tideAt = 0;
      let lx = null, ly = null, lsa = 0, lcma = 0, carry = 0, tok = null, cRect = null, cRectAt = 0;
      let prev = mAt, lastDraw = 0, lastTs = 0, wanted = false, drawn = false, f1 = true, gZero = false;
      let wb = false, pw = 0, ph = 0, shrunk = false, fLost = false, gLost = false, recN = 0, aT = null, wSlp = 0, aWk = 0;
      let rzPend = false, lastLayAt = -1, lastPM = pMode(), wFail = false, fWFail = false;

      const st = {
        mode, convLevel: lv, root: tr, host, glowCanvas: null, canvas: cv, width: -1, height: -1, dpr: 0, sleeping: false, parked: false,
        aura: { reach: 0.47, strength: 1.0 }, waves: { active: () => false, disturb() {}, advance() {} }, glow: null,
        field: { mode: 'none', dispose() {}, invalidate() {}, draw() {}, needsDraw: () => false, busy: () => false }, rafId: 0,
      };
      const dead = () => isD() || st.parked;
      const isAB = () => ga(html(), WB) === '1', isPp = () => ga(html(), PP_OPEN) === '1' && (st.mode !== 'conv' || /^(?:performance|eco)$/.test(pMode())), isRz = () => ga(html(), RZA) === '1';
      const isStr = () => st.mode === 'conv' && isF(isConvRunning) && Boolean(isConvRunning());
      const hP = () => Boolean(d.hidden || wb || isAB() || isPp() || (st.mode === 'conv' && isCB()));
      const hasSz = (c) => Boolean(c && c.width > 0 && c.height > 0);
      const isWGl = () => st.glow?.mode === 'worker-webgl2', isWF = () => st.field?.mode === 'worker-webgl2';
      const hasFSz = () => Boolean(cv && (isWF() ? st.field.getBufferSize?.().width > 0 && st.field.getBufferSize?.().height > 0 : hasSz(cv)));
      const hasGSz = () => { const gc = st.glowCanvas; return Boolean(gc && (isWGl() ? st.glow.getBufferSize?.().width > 0 && st.glow.getBufferSize?.().height > 0 : hasSz(gc))); };
      const invAll = () => { st.field?.invalidate?.(); st.glow?.invalidate?.(); };
      const setV = (el, on) => { if (el?.style) el.style.display = on ? '' : 'none'; };
      const isLost = (c, i) => Boolean(i?.isContextLost?.() || (i?.mode !== '2d' && i?.mode !== 'worker-webgl2' && c?.getContext?.('webgl2')?.isContextLost?.()));
      const hasG = isF(rc.mountBrandHorizonGlow);
      const rDpr = () => { const r = (typeof window !== 'undefined' && window.devicePixelRatio) || 1, w = rw(); return w?.resolveRippleDpr ? w.resolveRippleDpr(r, d) : M.min(r, pMode() === 'performance' ? 1 : pMode() === 'balanced' ? 1.5 : 2); };
      const gDpr = () => { const r = (typeof window !== 'undefined' && window.devicePixelRatio) || 1, w = rw(); return w?.resolveGlowDpr ? w.resolveGlowDpr(r, d, 0.7) : pMode() === 'performance' ? 0.55 : pMode() === 'balanced' ? 0.7 : pMode() === 'quality' ? M.min(r, 2) : 0.6; };
      const pGap = () => rw()?.getPerfMinGapMs?.(d) || (pMode() === 'performance' ? 16.67 : 0);

      function swapCv(o, cls, tid, bf) {
        const n = mkEl('canvas', cls);
        if (tid) n.setAttribute('data-testid', tid);
        o?.replaceWith ? o.replaceWith(n) : o?.parentNode?.replaceChild ? o.parentNode.replaceChild(n, o) : (o?.remove?.(), bf && host.insertBefore ? host.insertBefore(n, cv) : host.appendChild(n));
        return n;
      }

      const setCvSz = (cols, rows, skip) => { if (!skip && !isWF()) { cv.width = pw; cv.height = ph; } cv.style.width = `${cols * rc.RIPPLE.cellWidth}px`; cv.style.height = `${rows * rc.RIPPLE.cellHeight}px`; };
      const resyncG = () => { if (st.width > 0 && st.height > 0) { syncG(st.width, st.height); wake(true); } };

      function onLost(isF0) {
        if (dead()) return;
        if (isF0) { fLost = true; setV(cv, 0); } else { gLost = true; setV(st.glowCanvas, 0); }
        if (recN >= 3 || recT || recRaf) return;
        const run = () => { recT = recRaf = 0; recoverLost(); };
        const tid = typeof setTimeout === 'function' ? setTimeout(run, 32) : 0;
        if (tid) recT = tid; else if (typeof requestAnimationFrame === 'function') recRaf = rAF(run); else run();
      }

      function mountGlow(p2d, sw) {
        if (!st.glowCanvas) return;
        if (sw) { try { st.glow?.dispose?.(true); } catch {} st.glowCanvas = swapCv(st.glowCanvas, GCLS, GTID, 1); }
        const wm = rw();
        let g = hasG && wm?.mountManagedGlow ? wm.mountManagedGlow({
          getCanvas: () => st.glowCanvas, swapCanvas: () => (st.glowCanvas = swapCv(st.glowCanvas, GCLS, GTID, 1)),
          rippleCore: rc, doc: d, prefer2D: !!p2d, allowWorker: !wFail, onContextLost: () => onLost(0),
          onFallbackDone: () => { wFail = true; if (!dead() && st.glowCanvas) { try { st.glow?.dispose?.(); } catch {} mountGlow(0, 1); resyncG(); } },
          onUpgradeReady: () => { if (!dead() && !wFail && st.mode === 'home' && st.glow?.mode === 'webgl2') { mountGlow(0, 1); resyncG(); } },
        }) : null;
        if (!g) {
          const mk = (u) => (hasG ? rc.mountBrandHorizonGlow(st.glowCanvas, { prefer2D: !!u, width: 0, height: 0, onContextLost: () => onLost(0) }) : { mode: 'none', resize() {}, draw() {}, dispose() {} });
          g = mk(p2d);
          if (hasG && g?.mode === 'none' && !p2d) { try { g.dispose?.(true); } catch {} st.glowCanvas = swapCv(st.glowCanvas, GCLS, GTID, 1); g = mk(1); }
        }
        st.glow = g; gLost = false; setV(st.glowCanvas, !hasG || g?.mode !== 'none');
      }

      const remountF = () => { st.field = mountField(M.ceil(st.width / rc.RIPPLE.cellWidth), M.ceil(st.height / rc.RIPPLE.cellHeight), 0, 1); tok = sampleTok(cv); cRect = null; updateCalm(); f1 = true; wake(true); return st.field; };
      function mountField(cols, rows, p2d, sw) {
        if (sw) cv = st.canvas = swapCv(cv, RCLS);
        const wm = rw();
        let f = null;
        if (cols > 0 && rows > 0 && wm?.mountManagedField && !p2d && !fWFail) {
          setCvSz(cols, rows, 1);
          f = wm.mountManagedField({
            getCanvas: () => cv, swapCanvas: () => { cv = st.canvas = swapCv(cv, RCLS); setCvSz(cols, rows, 0); return cv; },
            cols, rows, dpr: st.dpr || rDpr(), waves: st.waves, rippleCore: rc, prefer2D: false, allowWorker: !fWFail, onContextLost: () => onLost(1),
            onFallbackDone: () => { fWFail = true; if (dead()) return null; try { st.field?.dispose?.(); } catch {} return remountF(); },
            onUpgradeReady: () => { if (!dead() && !fWFail && st.field?.mode === 'webgl2' && st.width > 0 && st.height > 0) { try { st.field.dispose?.(); } catch {} remountF(); } },
          });
          if (f && f.mode !== 'worker-webgl2') setCvSz(cols, rows, 0);
        } else {
          setCvSz(cols, rows, 0);
          const mk = (u) => rc.createGlyphField(cv, cols, rows, st.waves, { prefer2D: !!u, onContextLost: () => onLost(1) });
          f = mk(p2d);
          if (cols > 0 && rows > 0 && f?.mode === 'none' && !p2d) { try { f.dispose?.(true); } catch {} cv = st.canvas = swapCv(cv, RCLS); setCvSz(cols, rows, 0); f = mk(1); }
        }
        fLost = false; setV(cv, cols <= 0 || rows <= 0 || f?.mode !== 'none');
        return f;
      }

      function recoverLost() {
        if (dead() || (!fLost && !gLost)) return;
        if (d.hidden) return reclaim();
        const nf = fLost, ng = gLost; fLost = gLost = false;
        const p2d = ++recN >= 2;
        if (nf && st.width > 0 && st.height > 0) {
          try { st.field?.dispose?.(true); } catch {}
          st.field = mountField(M.ceil(st.width / rc.RIPPLE.cellWidth), M.ceil(st.height / rc.RIPPLE.cellHeight), p2d, 1);
          tok = sampleTok(cv); cRect = null; updateCalm();
        }
        if (ng && st.glowCanvas && st.mode === 'home') {
          mountGlow(p2d, 1);
          if (st.width > 0 && st.height > 0 && st.glow?.mode !== 'none') st.glow?.resize?.(st.width, st.height, gDpr());
        }
        f1 = true; drawn = false; invAll(); wake(true);
      }

      syncMFn = (nm) => {
        if (nm === 'conv') { gLost = false; try { st.glow?.dispose?.(); } catch {} st.glow = null; st.glowCanvas?.remove?.(); st.glowCanvas = null; tideAt = 0; }
        else if (!st.glowCanvas) {
          const gc = mkEl('canvas', GCLS); gc.setAttribute('data-testid', GTID);
          host.insertBefore ? host.insertBefore(gc, st.canvas) : host.appendChild(gc);
          st.glowCanvas = gc; mountGlow(0, 0);
        }
        gZero = false;
      };
      syncMFn(mode);

      function syncG(w, h) {
        const gc = st.glowCanvas;
        if (!gc || w <= 0 || h <= 0) return;
        if (gLost || isLost(gc, st.glow)) mountGlow(recN >= 2, 1);
        const cur = st.glowCanvas;
        if (!cur || (hasG && st.glow?.mode === 'none')) return;
        const gd = gDpr();
        st.glow?.resize?.(w, h, gd);
        if (!isWGl() && (!cur.width || !cur.height)) { cur.width = M.max(1, M.round(w * gd)); cur.height = M.max(1, M.round(h * gd)); }
      }

      const reclaim = () => {
        rzT = cT(rzT); rzPend = false; enterIdleSleep();
        const gc = st.glowCanvas;
        if (shrunk && !hasFSz() && !hasGSz()) return;
        try { st.glow?.releaseBackingStore?.(); } catch {}
        try { st.field?.releaseBackingStore?.(); } catch {}
        if (!isWF()) cv.width = cv.height = 0;
        if (gc && !isWGl()) gc.width = gc.height = 0;
        shrunk = f1 = true; drawn = false;
      };

      function updateCalm() {
        const cur = st.root;
        if (!cur || !st.field?.setCalmZones) return;
        const gr = st.mode === 'home' ? cur.querySelector('[data-testid="home-greeting"]') : null;
        if (!gr) return st.field.setCalmZones([]);
        const c = cv.getBoundingClientRect(); cRect = c; cRectAt = nowOf();
        const g = gr.getBoundingClientRect();
        if (c.width && g.width) st.field.setCalmZones([{ x: g.left - c.left - 28, y: g.top - c.top - 14, w: g.width + 56, h: g.height + 28 }]);
      }

      function layout() {
        const cur = st.root;
        if (!cur) return;
        if (d.hidden) return reclaim();
        const w = M.max(0, Number(cur.clientWidth) || 0), h = M.max(0, Number(cur.clientHeight) || 0);
        const dpr = rDpr(), pm = pMode(), gc = st.glowCanvas, lostF = fLost || isLost(cv, st.field);
        const pChg = pm !== lastPM; lastPM = pm;
        if (w === st.width && h === st.height && dpr === st.dpr && !lostF && !pChg) {
          cRect = null;
          if (shrunk || gLost || isLost(gc, st.glow) || (pw > 0 && ph > 0 && (!hasFSz() || (gc && !hasGSz())))) {
            shrunk = drawn = false; f1 = true;
            if (isWF()) st.field.resize(M.ceil(w / rc.RIPPLE.cellWidth), M.ceil(h / rc.RIPPLE.cellHeight), st.waves, dpr);
            else { cv.width = pw; cv.height = ph; }
            syncG(w, h); invAll();
          }
          return;
        }
        const cw = rc.RIPPLE.cellWidth, ch = rc.RIPPLE.cellHeight, cols = M.ceil(w / cw), rows = M.ceil(h / ch);
        const was2d = st.field?.mode === '2d', inPlace = !lostF && cols > 0 && rows > 0 && st.field?.mode !== 'none' && isF(st.field?.resize);
        st.width = w; st.height = h; st.dpr = dpr; pw = M.round(cols * cw * dpr); ph = M.round(rows * ch * dpr);
        shrunk = drawn = false; f1 = true; syncG(w, h);
        st.waves = rc.createWaveField(cols, rows);
        if (inPlace) { setCvSz(cols, rows); st.field.resize(cols, rows, st.waves, dpr); }
        else { st.field.dispose(true); st.field = mountField(cols, rows, was2d && !lostF, lostF || isWF()); }
        tok = sampleTok(cv); cRect = null; updateCalm();
      }

      function enterIdleSleep() {
        stopT(st); wanted = false; wSlp = 1; st.sleeping = true;
        st.glow?.setPaused?.(true); sa(host, 'data-ripple-sleep', '1');
      }

      function wake(imm = false) {
        timer = cT(timer);
        if (dead()) return;
        if (d.hidden) return reclaim();
        if (st.mode === 'conv' && isCB()) return parkRipple();
        if (shrunk) layout();
        st.sleeping = false; ra(host, 'data-ripple-sleep');
        if (hP() || isStr()) { if ((!drawn || f1) && hasFSz()) drawFrame(nowOf()); return enterIdleSleep(); }
        if (imm) { st.rafId = cAF(st.rafId); wanted = false; f1 = true; return drawFrame(nowOf()); }
        if (wanted) return;
        wanted = true; st.rafId = rAF(drawFrame);
      }

      strChk = () => { if (isStr()) { as.active = false; if (!st.sleeping) enterIdleSleep(); } };

      function drawFrame(now) {
        st.rafId = 0; wanted = false;
        if (dead() || (rm !== st && rm !== null)) return;
        if (d.hidden) return reclaim();
        if (st.mode === 'conv' && isCB()) return parkRipple();
        const str = isStr();
        if (str) as.active = false;
        const still = mRed() || str, vsDt = lastTs > 0 && now > lastTs ? now - lastTs : now - lastDraw;
        lastTs = now;
        const rawGap = M.max(pGap(), Number(getMinFrameGapMs?.() ?? 0) || 0);
        const minGap = (st.mode === 'home' || st.convLevel === 'full') && (st.waves?.active?.() || (as.active && lsa > 0 && now - lsa < 650) || (tideAt > 0 && now - tideAt < 480)) ? rawGap : M.max(33, rawGap);
        if (!still && drawn && !f1 && minGap > 0 && lastDraw > 0 && now - lastDraw < minGap && !hP()) {
          const rem = minGap - (now - lastDraw);
          if (typeof setTimeout === 'function' && rem > M.max(8, vsDt + 2)) { timer = cT(timer); timer = setTimeout(() => { timer = 0; wake(); }, M.max(4, M.ceil(rem))); }
          else wake();
          return;
        }
        lastDraw = now;
        const dt = still ? 0 : wSlp ? M.min(16, M.max(0, now - prev)) : cl(now - prev, 0, 50);
        aT = aT === null ? now : aT + dt; wSlp = 0;
        st.waves.advance(still ? 0 : cl(dt / 1000, 0, 0.05)); prev = now;
        const te = st.mode === 'home' && tideAt > 0 ? now - tideAt : -1, inT = !still && te >= 0 && te < 480;
        if (tideAt > 0 && !inT) { tideAt = 0; st.aura.reach = 0.47; st.aura.strength = 1.0; f1 = true; }
        else if (inT) { const e = 1 - M.pow(1 - cl(te / 480, 0, 1), 2.2); st.aura.reach = +(0.2 + 0.27 * e).toFixed(4); st.aura.strength = +(0.32 + 0.68 * e).toFixed(4); }

        const amb = ambScale();
        if (amb <= 0.001 && as.active) as.active = false;
        let aSet = 0;
        if (!str && amb > 0.001 && as.active && lsa > 0) {
          const age = M.max(0, now - lsa);
          if (age >= IDLE_MS) { as.active = false; as.f = 0; aSet = 1; }
          else { const u = age <= 750 ? 1 : (IDLE_MS - age) / 450; as.f = u * u * (3 - 2 * u) * (aWk && now - aWk < 180 ? cl((now - aWk) / 180, 0.12, 1) : 1); }
        }
        const aRec = !str && amb > 0.001 && as.active && lsa > 0 && now - lsa < IDLE_MS;
        const inI = st.mode === 'home' && !still && amb > 0.001 && now - mAt < INTRO_MS;
        const busy = !str && Boolean(st.field?.busy?.());
        const need = f1 || !drawn || aSet || (Boolean(st.glowCanvas) && amb <= 0.001 && !gZero) || inT || inI || aRec || (!str && Boolean(st.field?.needsDraw(aT, still)));

        if (hasFSz() && need) {
          f1 = false;
          if (!tok) tok = sampleTok(cv);
          const sp = specMode(tok.dark), pal = buildPal(tok, as, aT, amb, sp, st.mode, st.convLevel);
          if (hasGSz()) {
            if (amb <= 0.001) { if (!gZero) { st.glow?.clear?.(); gZero = true; } }
            else { gZero = false; st.glow?.draw?.(aT, { dark: pal.dark, still, strength: inT ? st.aura.strength : 1, reach: st.aura.reach, ambientIntensity: amb, spectrum: sp }); }
          }
          st.field.draw(aT, pal, still); drawn = true;
        }
        if (isD() || hP() || still || !(inT || busy || inI || aRec)) enterIdleSleep(); else wake();
      }

      st.wake = wake; st.reclaim = reclaim;
      refLv = () => { f1 = true; invAll(); d.hidden ? reclaim() : wake(); };
      st.reattach = () => {
        timer = cT(timer); clrRec(); rzT = cT(rzT); rzPend = false; fLost = gLost = false; recN = 0; prev = nowOf(); wSlp = 1; aWk = 0; wanted = false; f1 = true; as.active = false; lx = ly = null; carry = 0;
        const runRe = () => { if (dead()) return; const pw0 = st.width, ph0 = st.height; layout(); if (st.width !== pw0 || st.height !== ph0 || st.mode === 'conv') updateCalm(); invAll(); wake(true); };
        if (!shrunk && st.width > 0 && st.height > 0 && !d.hidden && typeof requestAnimationFrame === 'function') { st.rafId = cAF(st.rafId); st.rafId = rAF(() => { st.rafId = 0; runRe(); }); } else runRe();
      };

      const invNG = () => { if (st.field?.mode !== 'webgl2' && st.field?.mode !== 'worker-webgl2') st.field?.invalidate?.(); };
      st.onMove = (ev) => {
        if (mRed()) return;
        if (!isAB()) wb = false;
        if (hP() || isStr()) return;
        const c = st.mode === 'conv', cp = c ? CP[st.convLevel] || CP.medium : null, nr = nowOf();
        if (c) { if ((lcma > 0 && nr - lcma < cp[4]) || isIgnC(ev.target, false)) return; lcma = nr; }
        if (!cRect || nr - cRectAt > 1500) { cRect = cv.getBoundingClientRect(); cRectAt = nr; }
        const x = ev.clientX - cRect.left, y = ev.clientY - cRect.top;
        if (x < 0 || y < 0 || x > cRect.width || y > cRect.height) { lx = ly = null; carry = 0; if (as.active) { as.active = false; f1 = true; invNG(); wake(); } return; }
        const now = nowOf();
        if (lx !== null && ly !== null) {
          const dist = M.hypot(x - lx, y - ly), spd = dist / M.max(0.004, (now - lsa) / 1000), ms = cp ? cp[5] : 220, cs = cp ? cp[6] : 42;
          if (spd >= ms) { carry += dist; if (carry >= cs) { carry = M.min(20, carry - cs); st.waves.skimmer?.(M.floor(x / rc.RIPPLE.cellWidth), M.floor(y / rc.RIPPLE.cellHeight), cl((spd - ms) / 1800, 0.05, 1) * (cp ? cp[3] : 1)); } }
          else carry *= 0.85;
        }
        lx = x; ly = y; lsa = now;
        if (ambScale() > 0.001) { if (!as.active || st.sleeping) aWk = now; as.x = x; as.y = y; as.active = true; if (st.sleeping) prev = now; invNG(); wake(); }
        else if (st.waves.active()) { if (st.sleeping) prev = now; st.field.invalidate(); wake(); }
      };

      st.onLeave = () => { lx = ly = null; carry = 0; if (as.active) { as.active = false; f1 = true; invNG(); wake(); } };

      st.onPress = (ev) => {
        if (ev.button !== 0 || mRed() || ambScale() <= 0.001 || hP() || isStr()) return;
        const c = st.mode === 'conv';
        if (c && isIgnC(ev.target, true)) return;
        const cp = c ? CP[st.convLevel] || CP.medium : null, r = cv.getBoundingClientRect();
        cRect = r; cRectAt = nowOf();
        if (st.sleeping) prev = cRectAt;
        st.waves.disturb(M.floor((ev.clientX - r.left) / rc.RIPPLE.cellWidth), M.floor((ev.clientY - r.top) / rc.RIPPLE.cellHeight), cp && st.convLevel !== 'full' ? { amplitudeScale: cp[3], radiusScale: 0.72 + 0.28 * cp[3], duration: cp[9], loadWeight: cp[10] } : undefined);
        st.field.invalidate(); wake();
        if (!c) onPointerPressMascot?.(ev.clientX);
      };

      const onVis = () => {
        if (d.hidden) return reclaim();
        if (st.mode === 'conv' || convLv() !== 'off') { if (isCB()) { if (!st.parked) parkRipple(); return; } if (st.parked) return syncRipple(); }
        if (st.parked) return;
        const s = shrunk, pChg = pMode() !== lastPM;
        if (s || pChg || !hasFSz()) layout();
        const ok = (s || pChg) && hasFSz();
        if (!hP() && !isStr()) { prev = nowOf(); f1 = true; ok ? drawFrame(prev) : wake(); }
        else if (ok && !drawn) drawFrame(nowOf());
        else enterIdleSleep();
      };
      const onBlur = () => { wb = true; enterIdleSleep(); }, onFocus = () => { wb = false; onVis(); };
      d.addEventListener('visibilitychange', onVis);
      const wRef = typeof window !== 'undefined' ? window : null;
      wRef?.addEventListener?.('blur', onBlur); wRef?.addEventListener?.('focus', onFocus);
      const mos = [], unsubs = [], hA = [WB, PP_OPEN, PMA, 'data-ag-prism-wallpaper', HA, DHA, 'data-ag-cs-motion'];
      const onAttr = () => { if (!isAB()) wb = false; onVis(); };
      const dBus = wRef && (wRef.__agDomBus || wRef.__agPrismDomBus);
      if (dBus?.subscribe) { try { unsubs.push(dBus.subscribe('home-ripple-root', onAttr, { priority: 'high', attributes: true, attributeFilter: hA, filter: (m) => m?.type === 'attributes' && (m.target === html() || m.target === d.body) && hA.includes(m.attributeName), observeOptions: { childList: false, subtree: true, attributes: true, attributeFilter: hA } })); } catch {} }
      if (!unsubs.length && typeof MutationObserver === 'function') { for (const [el, af] of [[html(), hA], [d.body, [HA, DHA]]]) if (el) { try { const mo = new MutationObserver(onAttr); mo.observe(el, { attributes: true, attributeFilter: af }); mos.push(mo); } catch {} } }
      unWin = () => { rRaf = cAF(rRaf); rzT = cT(rzT); rzPend = false; d.removeEventListener('visibilitychange', onVis); wRef?.removeEventListener?.('blur', onBlur); wRef?.removeEventListener?.('focus', onFocus); unsubs.forEach((u) => u?.()); mos.forEach((mo) => mo.disconnect()); };

      if (typeof ResizeObserver === 'function') {
        const applyLay = (wakeIdle) => {
          const ow = st.width, oh = st.height;
          layout(); lastLayAt = nowOf();
          if (st.width !== ow || st.height !== oh || !drawn) wake(true); else if (wakeIdle) wake();
        };
        const flushLay = () => {
          rzT = 0;
          if (dead()) return;
          if (d.hidden) { rzPend = false; return reclaim(); }
          if (isRz()) { rzT = setTimeout(flushLay, RZ_MS); return; }
          if (!rzPend) return;
          rzPend = false; applyLay(0);
        };
        const doLay = () => { rRaf = 0; if (!dead()) d.hidden ? reclaim() : applyLay(1); };
        ro = new ResizeObserver(() => {
          if (d.hidden) { rzT = cT(rzT); rzPend = false; return reclaim(); }
          const now = nowOf(), live = !shrunk && st.width > 0 && st.height > 0 && hasFSz() && !fLost && !isLost(cv, st.field);
          if (live && (isRz() || rzPend || (lastLayAt >= 0 && now > lastLayAt && now - lastLayAt <= RZ_WIN))) {
            rRaf = cAF(rRaf); rzPend = true; rzT = cT(rzT); rzT = setTimeout(flushLay, RZ_MS); return;
          }
          typeof requestAnimationFrame !== 'function' ? doLay() : !rRaf && (rRaf = rAF(doLay));
        });
      }
      mountR(st, mode, tr); rm = st; layout();
      st.refreshTheme = () => { tok = sampleTok(cv); f1 = true; invAll(); d.hidden ? reclaim() : wake(); };
      wake();
    }

    function refreshTheme() { rm?.refreshTheme?.(); }
    function triggerLiftoffBurst(cr) {
      if (!rm || rm.mode !== 'home' || !isF(rm.field?.triggerLiftoffBurst)) return;
      const r = rm.canvas?.getBoundingClientRect?.(), ok = cr && r?.width > 0 && r?.height > 0;
      const nx = ok ? cl((cr.left + cr.width * 0.5 - r.left) / r.width, 0.05, 0.95) : 0.5, ny = ok ? cl((cr.top + cr.height * 0.5 - r.top) / r.height, 0.05, 0.95) : 0.62;
      try { rm.field.triggerLiftoffBurst(nx, ny); rm.field.invalidate?.(); rm.wake?.(); } catch {}
    }
    function triggerTideSwell() {
      if (!rm) syncRipple();
      if (!rm || rm.mode !== 'home') return;
      tideAt = nowOf(); rm.aura.reach = 0.2; rm.aura.strength = 0.32;
      try { rm.field?.triggerTideSwell?.(); rm.field?.invalidate?.(); rm.wake?.(); } catch {}
    }

    return { sync: syncRipple, park: parkRipple, unmount: unmountRipple, refreshTheme, triggerLiftoffBurst, triggerTideSwell, getMount: () => rm };
  }
  const api = { createHomeRippleController };
  if (typeof module === 'object' && module.exports) module.exports = api;
  G.__agPrismHomeRippleHost = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
