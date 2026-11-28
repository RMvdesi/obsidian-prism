// Obsidian Prism - Right Side Panel Vertical Tabs Sash, Toggle & Dual-Target Resize (vtabs-sash.js)
(function (G) {
  'use strict';

  function init(ns) {
    const {
      NARROW_WIDTH_PX, EXPANDED_WIDTH_PX, MIN_EXPANDED_WIDTH_PX, SNAP_COLLAPSE_WIDTH_PX,
      safe, isFn, clampNum, ha, sa, ra, setAttrIfChanged, qa,
      computeMaxExpandedWidth, markOwned, removeEl, resolveToggleLabels, getOwnDomBus,
      buildToggleIcon, detectBrowserHole, findClipTarget, readResizeEntryWidth,
    } = ns;

    function createSashAndToggleManager(ctx) {
      let toggleHeadEl = null;
      let toggleBtnEl = null;
      let toggleArrowEl = null;
      let toggleClickUnsub = null;
      let sashEl = null;
      let sashUnsubs = [];
      let dragging = false;
      let dragState = null;

      function syncSashChrome(effW, maxW) {
        if (!sashEl) return;
        setAttrIfChanged(sashEl, 'aria-valuemin', String(MIN_EXPANDED_WIDTH_PX));
        setAttrIfChanged(sashEl, 'aria-valuemax', String(maxW));
        setAttrIfChanged(sashEl, 'aria-valuenow', String(effW));
      }

      function syncToggleChrome(effectiveCollapsed, autoCollapsed) {
        if (!toggleBtnEl) return;
        const labels = resolveToggleLabels(ctx.resolveLang(), ctx.win);
        const label = effectiveCollapsed ? labels.expand : labels.collapse;
        setAttrIfChanged(toggleBtnEl, 'aria-expanded', effectiveCollapsed ? 'false' : 'true');
        setAttrIfChanged(toggleBtnEl, 'aria-label', label);
        setAttrIfChanged(toggleBtnEl, 'title', label);
        if (autoCollapsed) setAttrIfChanged(toggleBtnEl, 'aria-disabled', 'true');
        else if (ha(toggleBtnEl, 'aria-disabled')) ra(toggleBtnEl, 'aria-disabled');
        if (toggleArrowEl) {
          setAttrIfChanged(toggleArrowEl, 'points', effectiveCollapsed ? '7.2 6.2 5.2 8 7.2 9.8' : '5.2 6.2 7.2 8 5.2 9.8');
        }
      }

      function applyDragClientX(st, clientX, notifyHoleMode) {
        if (!st || ctx.isDestroyed() || !ctx.getBoundHost() || !ctx.getBoundStrip()) return;
        const rawW = st.startW + (st.startX - clientX);
        if (rawW < SNAP_COLLAPSE_WIDTH_PX) {
          ctx.setUserState(true, st.initialUserExpandedWidth);
        } else {
          ctx.setUserState(false, Math.round(clampNum(rawW, MIN_EXPANDED_WIDTH_PX, Math.max(MIN_EXPANDED_WIDTH_PX, st.maxW))));
        }
        const syncNow = notifyHoleMode === 'sync';
        ctx.applyCollapseState(syncNow, syncNow, notifyHoleMode === 'none');
      }

      function finishDrag(commit) {
        if (!dragState) { dragging = false; return; }
        const st = dragState;
        if (st.rafSlot.id !== null) ctx.cancelScheduled(st.rafSlot);
        if (commit && st.moved && st.pendingClientX !== null) {
          const finalX = st.pendingClientX;
          st.pendingClientX = null;
          applyDragClientX(st, finalX, 'none');
        }
        dragState = null;
        dragging = false;
        safe(() => st.cleanup?.());
        if (st.pointerId !== undefined) safe(() => st.sash?.releasePointerCapture?.(st.pointerId));

        const boundHost = ctx.getBoundHost();
        const boundStrip = ctx.getBoundStrip();
        const holeNow = Boolean(boundHost && (ctx.getHasBrowserHole() || detectBrowserHole(ctx.doc, boundHost, ctx.getBoundBody())));

        ctx.runInternalMut(() => {
          for (const el of [boundHost, boundStrip]) {
            if (!el) continue;
            if (ha(el, 'data-ag-vtabs-dragging')) ra(el, 'data-ag-vtabs-dragging');
            ctx.deletePrevMark(el, 'data-ag-vtabs-dragging');
          }
        });

        if (commit) {
          if (st.moved) {
            const u = ctx.getUserState();
            ctx.writeStoredCollapsed(u.userCollapsed);
            if (!u.userCollapsed) ctx.writeStoredWidth(u.userExpandedWidth);
            if (holeNow) { ctx.cancelResizeSched(); ctx.dispatchHoleResizeNow(); }
          }
        } else {
          const cur = ctx.getUserState();
          const changedBack = cur.userExpandedWidth !== st.initialUserExpandedWidth || cur.userCollapsed !== st.initialUserCollapsed;
          ctx.setUserState(st.initialUserCollapsed, st.initialUserExpandedWidth);
          if (changedBack && !ctx.isDestroyed() && !ctx.isUnbinding() && boundHost && boundStrip && boundHost.isConnected !== false) {
            ctx.applyCollapseState(false, false, false);
          }
        }
      }

      function onSashPointerDown(ev) {
        const boundHost = ctx.getBoundHost();
        const boundStrip = ctx.getBoundStrip();
        if (!ctx.isActive() || !boundHost || !boundStrip || ctx.isAutoCollapsed()) return;
        if (ev && typeof ev.button === 'number' && ev.button !== 0) return;
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        finishDrag(false);
        ctx.cancelGlideSession();

        const measuredW = ctx.measureHostWidth();
        if (measuredW > 0 && measuredW < NARROW_WIDTH_PX) { ctx.applyWidth(measuredW); return; }
        if (measuredW > 0) ctx.setNarrowWidth(measuredW);
        const maxW = computeMaxExpandedWidth(measuredW);
        const startW = ctx.computeEffectiveWidth(measuredW);
        const startX = typeof ev?.clientX === 'number' && Number.isFinite(ev.clientX) ? ev.clientX : 0;
        const pointerId = ev?.pointerId;
        const activeSash = sashEl;
        if (pointerId !== undefined) safe(() => activeSash?.setPointerCapture?.(pointerId));

        const initialUser = ctx.getUserState();
        let lastMoveEv = null;
        const st = {
          pointerId, startX, startW, maxW, sash: activeSash,
          initialUserExpandedWidth: initialUser.userExpandedWidth,
          initialUserCollapsed: initialUser.userCollapsed,
          moved: false, pendingClientX: null, rafSlot: { id: null, isRaf: false }, cleanup: null,
        };

        const onMove = (mev) => {
          if (dragState !== st || ctx.isDestroyed() || ctx.isAutoCollapsed()) return;
          const curHost = ctx.getBoundHost();
          if (!curHost || !ctx.getBoundStrip() || curHost.isConnected === false || st.sash?.isConnected === false) { finishDrag(false); return; }
          if (mev?.pointerType === 'mouse' && typeof mev.buttons === 'number' && (mev.buttons & 1) === 0) { finishDrag(false); return; }
          if (mev && mev === lastMoveEv) return;
          if (st.pointerId !== undefined && mev?.pointerId !== undefined && mev.pointerId !== st.pointerId) return;
          lastMoveEv = mev;
          const cx = typeof mev?.clientX === 'number' && Number.isFinite(mev.clientX) ? mev.clientX : null;
          if (cx === null) return;
          st.moved = true;
          st.pendingClientX = cx;
          const req = ctx.getReqRaf();
          if (req) {
            if (st.rafSlot.id === null) {
              st.rafSlot.isRaf = true;
              st.rafSlot.id = req(() => {
                st.rafSlot.id = null; st.rafSlot.isRaf = false;
                if (dragState !== st || ctx.isDestroyed()) return;
                const nextX = st.pendingClientX; st.pendingClientX = null;
                if (nextX !== null) applyDragClientX(st, nextX, 'sync');
              });
            }
          } else { st.pendingClientX = null; applyDragClientX(st, cx, 'sync'); }
        };

        const onEnd = (uev) => {
          if (dragState !== st) return;
          if (st.pointerId !== undefined && uev?.pointerId !== undefined && uev.pointerId !== st.pointerId) return;
          if (uev?.type === 'pointerup' && st.moved && typeof uev.clientX === 'number' && Number.isFinite(uev.clientX)) {
            st.pendingClientX = uev.clientX;
          }
          finishDrag(uev?.type !== 'pointercancel');
        };
        const onBlur = () => { if (dragState === st) finishDrag(false); };

        const win = ctx.win;
        const uniqueTargets = Array.from(new Set([activeSash, win].filter((t) => t && isFn(t.addEventListener))));
        for (let i = 0; i < uniqueTargets.length; i++) {
          const tgt = uniqueTargets[i];
          safe(() => tgt.addEventListener('pointermove', onMove));
          safe(() => tgt.addEventListener('pointerup', onEnd));
          safe(() => tgt.addEventListener('pointercancel', onEnd));
          safe(() => tgt.addEventListener('lostpointercapture', onEnd));
        }
        if (win && isFn(win.addEventListener)) safe(() => win.addEventListener('blur', onBlur));

        st.cleanup = () => {
          for (let i = 0; i < uniqueTargets.length; i++) {
            const tgt = uniqueTargets[i];
            safe(() => tgt.removeEventListener?.('pointermove', onMove));
            safe(() => tgt.removeEventListener?.('pointerup', onEnd));
            safe(() => tgt.removeEventListener?.('pointercancel', onEnd));
            safe(() => tgt.removeEventListener?.('lostpointercapture', onEnd));
          }
          if (win && isFn(win.removeEventListener)) safe(() => win.removeEventListener('blur', onBlur));
        };

        dragState = st;
        dragging = true;
        ctx.runInternalMut(() => {
          setAttrIfChanged(boundHost, 'data-ag-vtabs-dragging', '1');
          ctx.recordPrevMark(boundHost, 'data-ag-vtabs-dragging');
          setAttrIfChanged(boundStrip, 'data-ag-vtabs-dragging', '1');
          ctx.recordPrevMark(boundStrip, 'data-ag-vtabs-dragging');
        });
      }

      function onSashDblClick(ev) {
        if (!ctx.isActive() || !ctx.getBoundHost() || !ctx.getBoundStrip() || ctx.isAutoCollapsed()) return;
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        finishDrag(false);
        ctx.setUserState(false, EXPANDED_WIDTH_PX);
        ctx.writeStoredCollapsed(false);
        ctx.writeStoredWidth(EXPANDED_WIDTH_PX);
        ctx.applyCollapseState(true, false, false);
      }

      function unmountSash() {
        finishDrag(false);
        for (let i = 0; i < sashUnsubs.length; i++) safe(sashUnsubs[i]);
        sashUnsubs = [];
        if (sashEl) { removeEl(sashEl); sashEl = null; }
      }

      function ensureSashMounted(strip, isFlat, stripSlot) {
        const doc = ctx.doc;
        if (!doc || !strip) return;
        const mountTarget = isFlat && stripSlot && stripSlot !== strip ? stripSlot : strip;
        qa(doc, '.ag-cs-vtabs-sash').forEach((n) => { if (n !== sashEl) removeEl(n); });
        if (!sashEl) {
          const sash = markOwned(doc.createElement('div'), false);
          sash.className = 'ag-cs-vtabs-sash';
          sa(sash, 'role', 'separator');
          sa(sash, 'aria-orientation', 'vertical');
          sa(sash, 'tabindex', '-1');
          const line = markOwned(doc.createElement('div'), false);
          line.className = 'ag-cs-vtabs-sash-line';
          sa(line, 'aria-hidden', 'true');
          sash.appendChild(line);
          sash.addEventListener?.('pointerdown', onSashPointerDown);
          sash.addEventListener?.('dblclick', onSashDblClick);
          sashUnsubs = [
            () => sash.removeEventListener?.('pointerdown', onSashPointerDown),
            () => sash.removeEventListener?.('dblclick', onSashDblClick),
          ];
          sashEl = sash;
        }
        if (sashEl.parentElement !== mountTarget) mountTarget.appendChild(sashEl);
      }

      function unmountToggle() {
        if (toggleClickUnsub) { safe(toggleClickUnsub); toggleClickUnsub = null; }
        if (toggleHeadEl) { removeEl(toggleHeadEl); toggleHeadEl = null; }
        toggleBtnEl = null;
        toggleArrowEl = null;
      }

      function onToggleClick(ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        ctx.toggleCollapsed();
      }

      function ensureToggleMounted(strip, effectiveCollapsed) {
        const doc = ctx.doc;
        if (!doc || !strip) return;
        qa(doc, '.ag-cs-vtabs-head').forEach((n) => { if (n !== toggleHeadEl) removeEl(n); });
        if (!toggleHeadEl || !toggleBtnEl) {
          const head = markOwned(doc.createElement('div'), false);
          head.className = 'ag-cs-vtabs-head';
          const btn = markOwned(doc.createElement('button'), true);
          btn.type = 'button';
          btn.className = 'ag-cs-vtabs-toggle';
          const icon = buildToggleIcon(doc, Boolean(effectiveCollapsed));
          btn.appendChild(icon.svg);
          head.appendChild(btn);
          btn.addEventListener?.('click', onToggleClick);
          toggleClickUnsub = () => btn.removeEventListener?.('click', onToggleClick);
          toggleHeadEl = head;
          toggleBtnEl = btn;
          toggleArrowEl = icon.arrow;
        }
        if (toggleHeadEl.parentElement !== strip) strip.appendChild(toggleHeadEl);
      }

      return {
        isDragging: () => dragging,
        hasDragState: () => Boolean(dragState),
        getSashEl: () => sashEl,
        getToggleHeadEl: () => toggleHeadEl,
        syncSashChrome, syncToggleChrome, ensureSashMounted, unmountSash,
        ensureToggleMounted, unmountToggle, finishDrag,
      };
    }

    function createDualTargetResizeManager(ctx) {
      let hostBoxWidth = 0;
      let clipBoxWidth = 0;
      let viewportVisibleWidth = 0;
      let ro = null;
      let roBusUnsubs = [];
      let roTarget = null;
      let roClipTarget = null;
      let winResizeBound = false;
      const winResizeSched = { id: null, isRaf: false };

      function computeEffectiveHostWidth() {
        let eff = hostBoxWidth > 0 ? hostBoxWidth : 0;
        if (clipBoxWidth > 0) eff = eff > 0 ? Math.min(eff, clipBoxWidth) : clipBoxWidth;
        if (viewportVisibleWidth > 0) eff = eff > 0 ? Math.min(eff, viewportVisibleWidth) : viewportVisibleWidth;
        return eff;
      }

      function measureViewportClampWidth(host, clipEl) {
        const winW = Number(ctx.win?.innerWidth) || 0;
        if (winW <= 0) return 0;
        const target = clipEl && clipEl.isConnected !== false ? clipEl : host;
        if (!target) return 0;
        const rect = safe(() => target.getBoundingClientRect?.());
        if (rect && Number.isFinite(rect.left) && Number.isFinite(rect.right) && rect.right > winW + 1) {
          return Math.max(1, Math.floor(winW - rect.left));
        }
        return 0;
      }

      function scheduleViewportClampRefresh() {
        const bh = ctx.getBoundHost();
        if (!ctx.isActive() || !bh || bh.isConnected === false || winResizeSched.id !== null) return;
        const run = () => {
          winResizeSched.id = null;
          winResizeSched.isRaf = false;
          const curHost = ctx.getBoundHost();
          if (!ctx.isActive() || !curHost || curHost.isConnected === false) return;
          const clipEl = roClipTarget && roClipTarget.isConnected !== false ? roClipTarget : null;
          viewportVisibleWidth = measureViewportClampWidth(curHost, clipEl);
          const eff = computeEffectiveHostWidth();
          if (eff > 0) ctx.applyWidth(eff);
        };
        const req = ctx.getReqRaf();
        if (req) { winResizeSched.isRaf = true; winResizeSched.id = req(run); }
        else { winResizeSched.isRaf = false; winResizeSched.id = ctx.setT(run, 0); }
      }

      function measureHostWidthForDrag() {
        const boundHost = ctx.getBoundHost();
        if (!boundHost) return ctx.getNarrowWidth() || 0;
        const hW = Number(safe(() => boundHost.getBoundingClientRect?.()?.width)) || Number(boundHost.clientWidth) || hostBoxWidth || 0;
        const cEl = roClipTarget && roClipTarget.isConnected !== false ? roClipTarget : null;
        const cW = cEl ? Number(safe(() => cEl.getBoundingClientRect?.()?.width)) || Number(cEl.clientWidth) || clipBoxWidth || 0 : 0;
        const vW = measureViewportClampWidth(boundHost, cEl);
        let eff = hW > 0 ? hW : ctx.getNarrowWidth() || 0;
        if (cW > 0) eff = eff > 0 ? Math.min(eff, cW) : cW;
        if (vW > 0) eff = eff > 0 ? Math.min(eff, vW) : vW;
        return eff;
      }

      function disconnectRo() {
        if (ro) { safe(() => ro.disconnect?.()); ro = null; }
        for (let i = 0; i < roBusUnsubs.length; i++) safe(roBusUnsubs[i]);
        roBusUnsubs = [];
        roTarget = null;
        roClipTarget = null;
        hostBoxWidth = 0;
        clipBoxWidth = 0;
        viewportVisibleWidth = 0;
      }

      function attachRo(host) {
        if (!host) return;
        const nextClip = findClipTarget(host);
        if (roTarget === host && roClipTarget === nextClip && (ro || roBusUnsubs.length > 0)) return;
        disconnectRo();
        roTarget = host;
        roClipTarget = nextClip;

        hostBoxWidth = Number(host.clientWidth) || Number(safe(() => host.getBoundingClientRect?.()?.width)) || 0;
        clipBoxWidth = nextClip ? Number(nextClip.clientWidth) || Number(safe(() => nextClip.getBoundingClientRect?.()?.width)) || 0 : 0;
        viewportVisibleWidth = measureViewportClampWidth(host, nextClip);
        const initEff = computeEffectiveHostWidth();
        ctx.setInitialWidthState(initEff, initEff > 0 && initEff < NARROW_WIDTH_PX);

        const handleTargetWidth = (isClip, w) => {
          if (ctx.isDestroyed()) return;
          const bh = ctx.getBoundHost();
          if (!bh || bh.isConnected === false) { ctx.scheduleSync(); return; }
          if (typeof w !== 'number' || !Number.isFinite(w) || w < 0) return;
          if (isClip) clipBoxWidth = w;
          else hostBoxWidth = w;
          const eff = computeEffectiveHostWidth();
          if (eff > 0) ctx.applyWidth(eff);
          if (viewportVisibleWidth > 0) scheduleViewportClampRefresh();
        };

        const bus = getOwnDomBus(ctx.win);
        if (bus && isFn(bus.observeSize)) {
          const uHost = safe(() => bus.observeSize(host, (sz) => handleTargetWidth(false, sz?.width)));
          if (isFn(uHost)) roBusUnsubs.push(uHost);
          if (nextClip) {
            const uClip = safe(() => bus.observeSize(nextClip, (sz) => handleTargetWidth(true, sz?.width)));
            if (isFn(uClip)) roBusUnsubs.push(uClip);
          }
          if (roBusUnsubs.length > 0) return;
        }

        const ROCtor = ctx.win?.ResizeObserver || G.ResizeObserver;
        if (isFn(ROCtor)) {
          ro = new ROCtor((entries) => {
            if (ctx.isDestroyed()) return;
            const bh = ctx.getBoundHost();
            if (!bh || bh.isConnected === false) { ctx.scheduleSync(); return; }
            let updated = false;
            if (Array.isArray(entries)) {
              for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                if (!entry) continue;
                const w = readResizeEntryWidth(entry);
                if (w < 0) continue;
                if (entry.target && roClipTarget && entry.target === roClipTarget) { clipBoxWidth = w; updated = true; }
                else if (!entry.target || entry.target === bh) { hostBoxWidth = w; updated = true; }
              }
            }
            if (updated) {
              const eff = computeEffectiveHostWidth();
              if (eff > 0) ctx.applyWidth(eff);
              if (viewportVisibleWidth > 0) scheduleViewportClampRefresh();
            }
          });
          safe(() => ro.observe(host));
          if (nextClip) safe(() => ro.observe(nextClip));
        }
      }

      function onWinResize() {
        if (!ctx.isActive() || ctx.isDispatchingHoleResize()) return;
        scheduleViewportClampRefresh();
      }

      function bindWinResizeListener(on) {
        if (!ctx.win || winResizeBound === on) return;
        if (on) {
          if (isFn(ctx.win.addEventListener)) {
            safe(() => ctx.win.addEventListener('resize', onWinResize, { passive: true }));
            winResizeBound = true;
          }
        } else {
          if (isFn(ctx.win.removeEventListener)) {
            safe(() => ctx.win.removeEventListener('resize', onWinResize, { passive: true }));
            safe(() => ctx.win.removeEventListener('resize', onWinResize));
          }
          winResizeBound = false;
        }
      }

      return {
        attachRo,
        disconnectRo,
        hasActiveRo: () => Boolean(ro || roBusUnsubs.length > 0),
        bindWinResizeListener,
        cancelWinResize: () => ctx.cancelScheduled(winResizeSched),
        measureHostWidthForDrag,
      };
    }

    Object.assign(ns, { createSashAndToggleManager, createDualTargetResizeManager });
  }

  if (typeof __vtabsInit === 'function') __vtabsInit(init);
  else if (typeof module === 'object' && module && module.exports) module.exports = init;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
