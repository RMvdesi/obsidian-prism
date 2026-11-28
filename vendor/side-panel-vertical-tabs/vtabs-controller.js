// Obsidian Prism - Right Side Panel Vertical Tabs Controller & Singleton Entry (vtabs-controller.js)
(function (G) {
  'use strict';

  function initController(ns) {
    const {
      STORAGE_COLLAPSED_KEY, STORAGE_WIDTH_KEY, STYLE_ID, NARROW_WIDTH_PX, EXPANDED_WIDTH_PX,
      COLLAPSED_WIDTH_PX, MIN_EXPANDED_WIDTH_PX, MAX_EXPANDED_WIDTH_PX, SNAP_COLLAPSE_WIDTH_PX,
      TOP_INSET_CSS_VALUE, ALL_MARK_ATTRS, VTABS_SWEEP_SEL, OWNED_NODE_SEL, VTABS_I18N,
      safe, isFn, clampNum, ga, ha, sa, ra, setAttrIfChanged, qs, qa, isOnFlag,
      setCssVar, removeCssVar, parseStoredWidth, computeMaxExpandedWidth, markOwned, removeEl,
      normalizeLang, isPerfBlurFreezeMode, isReducedMotionActive, createObserverAndEventManager,
      getTabId, isTabActive, discoverSidePanel, findTabListContainer, stampStripTopology,
      extractTextExcluding, detectCloseButton, hasNonCloseIcon, inspectTabElements,
      classifyFromDom, detectBrowserHole, hasHostTopRightCluster, upsertOrdChip, removeOrdChips,
      stripNodeVtabsAttrs, cleanupOrphanDom, isRelevantMutation,
      resolveReadOnlyReduxContext, matchReduxTab, classifyFromReduxTab,
      extractSideQuestionCascadeId, createHostSubscriptionManager,
      createSashAndToggleManager, createDualTargetResizeManager, createVtabsMotionManager,
    } = ns;

    function createSidePanelVerticalTabsController(opts = {}) {
      const win = opts.win || (typeof window !== 'undefined' ? window : G);
      const doc = opts.doc || win?.document || (typeof document !== 'undefined' ? document : null);
      const storage = opts.storage !== undefined ? opts.storage : safe(() => win?.localStorage) || safe(() => G.localStorage) || null;
      const getLangOpt = isFn(opts.getLang) ? opts.getLang : null;
      const getConfigOpt = isFn(opts.getConfig) ? opts.getConfig : null;
      const explicitCssText = typeof opts.cssText === 'string' ? opts.cssText : null;

      const readStoredCollapsed = () => safe(() => storage?.getItem?.(STORAGE_COLLAPSED_KEY)) === '1';
      const writeStoredCollapsed = (val) => { safe(() => storage?.setItem?.(STORAGE_COLLAPSED_KEY, val ? '1' : '0')); };
      const readStoredWidth = () => parseStoredWidth(safe(() => storage?.getItem?.(STORAGE_WIDTH_KEY)));
      const writeStoredWidth = (px) => {
        safe(() => storage?.setItem?.(STORAGE_WIDTH_KEY, String(Math.round(clampNum(px, MIN_EXPANDED_WIDTH_PX, MAX_EXPANDED_WIDTH_PX)))));
      };

      let destroyed = false;
      let enabled = false;
      let lastCfg = null;
      let userCollapsed = readStoredCollapsed();
      let userExpandedWidth = readStoredWidth();
      let autoCollapsed = false;
      let narrowWidth = 0;
      let tabCount = 0;
      let hasBrowserHole = false;
      let lastEffectiveCollapsed = false;
      let lastEffectiveWidth = 0;
      let internalMutating = false;
      let unbinding = false;
      let dispatchingHoleResize = false;
      let activeTitleMutSet = null;
      let activeStyleMutSet = null;

      let boundHost = null;
      let boundStrip = null;
      let boundStripSlot = null;
      let boundBody = null;
      let styleEl = null;

      const resizeSched = { id: null, isRaf: false };
      let prevMarked = new Map();
      const touchedNodes = new Set();
      const titleStamped = new Set();
      let lastCascadeId = '';
      let lastTabKeySet = new Set();
      let lastTabElSet = new Set();

      const getReqRaf = () => (isFn(win?.requestAnimationFrame) ? (fn) => win.requestAnimationFrame(fn) : isFn(G.requestAnimationFrame) ? (fn) => G.requestAnimationFrame(fn) : null);
      const getCxlRaf = () => (isFn(win?.cancelAnimationFrame) ? (id) => win.cancelAnimationFrame(id) : isFn(G.cancelAnimationFrame) ? (id) => G.cancelAnimationFrame(id) : null);
      const setT = (fn, ms) => (isFn(win?.setTimeout) ? win.setTimeout(fn, ms) : setTimeout(fn, ms));
      const clrT = (id) => (isFn(win?.clearTimeout) ? win.clearTimeout(id) : clearTimeout(id));

      function cancelScheduled(slot) {
        if (slot.id === null) return;
        const id = slot.id;
        const wasRaf = slot.isRaf;
        slot.id = null;
        slot.isRaf = false;
        if (wasRaf) { const cxl = getCxlRaf(); if (cxl) safe(() => cxl(id)); }
        else safe(() => clrT(id));
      }

      const writeCssVarTracked = (el, name, val) => { if (setCssVar(el, name, val)) activeStyleMutSet?.add(el); };
      const clearCssVarTracked = (el, name) => { if (removeCssVar(el, name)) activeStyleMutSet?.add(el); };

      function recordMark(map, el, attr) {
        if (!el) return;
        let set = map.get(el);
        if (!set) { set = new Set(); map.set(el, set); }
        set.add(attr);
        touchedNodes.add(el);
      }

      const obsMgr = createObserverAndEventManager({
        doc, win, storage, getReqRaf, setT, cancelScheduled,
        isActive: () => !destroyed && enabled,
        isInternalMutating: () => internalMutating,
        getBoundHost: () => boundHost,
        scanAndSync: () => scanAndSync(),
        isRelevantMutation: (records, ownTitles, ownStyles) => isRelevantMutation(records, ownTitles, ownStyles, {
          boundStrip, boundStripSlot, toggleHeadEl: sashMgr.getToggleHeadEl(), sashEl: sashMgr.getSashEl(),
        }),
        handleStorageChange: (ev, key, isClear) => {
          let changed = false;
          if (isClear || key === STORAGE_COLLAPSED_KEY) {
            const nextC = ev && key === STORAGE_COLLAPSED_KEY && 'newValue' in ev ? ev.newValue === '1' : readStoredCollapsed();
            if (nextC !== userCollapsed) { userCollapsed = nextC; changed = true; }
          }
          if (isClear || key === STORAGE_WIDTH_KEY) {
            const nextW = ev && key === STORAGE_WIDTH_KEY && 'newValue' in ev ? parseStoredWidth(ev.newValue) : readStoredWidth();
            if (nextW !== userExpandedWidth) { userExpandedWidth = nextW; changed = true; }
          }
          if (changed) applyCollapseState(false, false, false);
        },
      });

      const hostSubs = createHostSubscriptionManager({
        doc,
        isActive: () => !destroyed && enabled,
        getBoundStrip: () => boundStrip,
        scheduleSync: () => obsMgr.scheduleSync(),
      });

      const motionMgr = createVtabsMotionManager({
        doc, win, setT, clrT,
        isDestroyed: () => destroyed,
        isDragging: () => sashMgr.isDragging(),
        getBoundStrip: () => boundStrip,
        runInternalMut: (fn) => runInternalMut(fn),
        recordPrevMark: (el, attr) => recordMark(prevMarked, el, attr),
        deletePrevMark: (el, attr) => prevMarked.get(el)?.delete(attr),
      });

      const resizeMgr = createDualTargetResizeManager({
        win, getReqRaf, setT, cancelScheduled,
        isDestroyed: () => destroyed,
        isActive: () => !destroyed && enabled,
        isDispatchingHoleResize: () => dispatchingHoleResize,
        getBoundHost: () => boundHost,
        getNarrowWidth: () => narrowWidth,
        setInitialWidthState: (w, nextAuto) => { narrowWidth = w; autoCollapsed = nextAuto; },
        scheduleSync: () => obsMgr.scheduleSync(),
        applyWidth: (w) => applyWidth(w),
      });

      const sashMgr = createSashAndToggleManager({
        doc, win, getReqRaf, cancelScheduled,
        isDestroyed: () => destroyed,
        isUnbinding: () => unbinding,
        isActive: () => !destroyed && enabled,
        isAutoCollapsed: () => autoCollapsed,
        getBoundHost: () => boundHost,
        getBoundStrip: () => boundStrip,
        getBoundBody: () => boundBody,
        getHasBrowserHole: () => hasBrowserHole,
        getUserState: () => ({ userCollapsed, userExpandedWidth }),
        setUserState: (c, w) => { userCollapsed = Boolean(c); userExpandedWidth = w; },
        setNarrowWidth: (w) => { narrowWidth = w; },
        measureHostWidth: () => resizeMgr.measureHostWidthForDrag(),
        computeEffectiveWidth: (w) => computeEffectiveWidth(w),
        applyWidth: (w) => applyWidth(w),
        applyCollapseState: (f, s, sup) => applyCollapseState(f, s, sup),
        toggleCollapsed: () => toggleCollapsed(),
        resolveLang: () => resolveLang(),
        writeStoredCollapsed, writeStoredWidth,
        cancelGlideSession: () => motionMgr.cancelGlideSession(),
        cancelResizeSched: () => cancelScheduled(resizeSched),
        dispatchHoleResizeNow: () => dispatchHoleResizeNow(),
        runInternalMut: (fn) => runInternalMut(fn),
        recordPrevMark: (el, attr) => recordMark(prevMarked, el, attr),
        deletePrevMark: (el, attr) => prevMarked.get(el)?.delete(attr),
      });

      function computeEffectiveWidth(hostWidth = narrowWidth) {
        if (autoCollapsed || userCollapsed) return COLLAPSED_WIDTH_PX;
        return Math.round(clampNum(userExpandedWidth, MIN_EXPANDED_WIDTH_PX, computeMaxExpandedWidth(hostWidth)));
      }

      function resolveLang() {
        return (
          (getLangOpt ? normalizeLang(safe(getLangOpt)) : '') ||
          (lastCfg?.language ? normalizeLang(lastCfg.language) : '') ||
          normalizeLang(ga(doc?.documentElement, 'data-ag-cs-lang')) ||
          normalizeLang(doc?.documentElement?.lang) ||
          normalizeLang(win?.navigator?.language || G.navigator?.language) ||
          'en'
        );
      }

      function resolveMotionTier() {
        if (isReducedMotionActive(doc, win)) return 'off';
        const rawAttr = ga(doc?.documentElement, 'data-ag-cs-motion');
        if (rawAttr === 'off' || rawAttr === 'subtle' || rawAttr === 'standard' || rawAttr === 'ultra') return rawAttr;
        const eng = win?.__agMotionEngine || G.__agMotionEngine;
        const engTier = isFn(eng?.getMotionTier) ? safe(() => eng.getMotionTier()) : '';
        if (engTier === 'off' || engTier === 'subtle' || engTier === 'standard' || engTier === 'ultra') return engTier;
        return 'ultra';
      }

      function resolveCssText() {
        if (explicitCssText !== null) return explicitCssText;
        if (typeof win?.__agPrismSidePanelVtabsCss === 'string' && win.__agPrismSidePanelVtabsCss) return win.__agPrismSidePanelVtabsCss;
        if (typeof G.__agPrismSidePanelVtabsCss === 'string' && G.__agPrismSidePanelVtabsCss) return G.__agPrismSidePanelVtabsCss;
        return '';
      }

      function resolveEnabled(cfgArg) {
        if (cfgArg && typeof cfgArg === 'object') lastCfg = cfgArg;
        const htmlAttr = ga(doc?.documentElement, 'data-ag-cs-side-panel-vertical-tabs');
        if (htmlAttr === 'off') return false;
        const cfg = lastCfg || (getConfigOpt ? safe(getConfigOpt) : null) || null;
        if (cfg && typeof cfg === 'object' && 'sidePanelVerticalTabs' in cfg) return isOnFlag(cfg.sidePanelVerticalTabs);
        return htmlAttr === 'on';
      }

      function dispatchHoleResizeNow() {
        if (!win || !isFn(win.dispatchEvent)) return;
        dispatchingHoleResize = true;
        try {
          safe(() => {
            const EvCtor = win.Event || G.Event;
            win.dispatchEvent(isFn(EvCtor) ? new EvCtor('resize') : { type: 'resize' });
          });
        } finally { dispatchingHoleResize = false; }
      }

      function scheduleHoleResize() {
        if (destroyed || !win || !isFn(win.dispatchEvent) || resizeSched.id !== null) return;
        const fire = () => { resizeSched.id = null; resizeSched.isRaf = false; if (!destroyed) dispatchHoleResizeNow(); };
        const req = getReqRaf();
        if (req) { resizeSched.isRaf = true; resizeSched.id = req(fire); }
        else { resizeSched.isRaf = false; resizeSched.id = setT(fire, 0); }
      }

      function runInternalMut(fn) {
        const prev = internalMutating;
        internalMutating = true;
        if (!prev) { activeTitleMutSet = new Set(); activeStyleMutSet = new Set(); }
        let missed = false;
        try {
          return fn();
        } finally {
          if (!prev) {
            const ownTitles = activeTitleMutSet;
            const ownStyles = activeStyleMutSet;
            activeTitleMutSet = null;
            activeStyleMutSet = null;
            const drained = obsMgr.drainAllPending();
            internalMutating = false;
            if (!unbinding && enabled && !destroyed && drained.length) {
              const rel = isRelevantMutation(drained, ownTitles, ownStyles, {
                boundStrip, boundStripSlot, toggleHeadEl: sashMgr.getToggleHeadEl(), sashEl: sashMgr.getSashEl(),
              });
              if (rel) missed = true;
            }
          }
          if (missed) {
            if (doc?.hidden === true) obsMgr.markPendingHidden();
            else obsMgr.scheduleSync();
          }
        }
      }

      function ensureStyleInjected() {
        if (!doc) return;
        const css = resolveCssText();
        const target = doc.head || doc.documentElement || doc.body;
        if (!target) return;
        let el = styleEl && styleEl.isConnected !== false ? styleEl : doc.getElementById?.(STYLE_ID) || qs(doc, '#' + STYLE_ID);
        if (!el) {
          el = doc.createElement('style');
          el.id = STYLE_ID;
          markOwned(el, false);
          el.textContent = css;
          target.appendChild(el);
        } else {
          markOwned(el, false);
          if (css && el.textContent !== css) el.textContent = css;
          if (el.isConnected === false) target.appendChild(el);
        }
        styleEl = el;
      }

      function removeStyleTag() {
        if (styleEl) { removeEl(styleEl); styleEl = null; }
        const orphan = doc?.getElementById?.(STYLE_ID) || qs(doc, '#' + STYLE_ID);
        if (orphan) removeEl(orphan);
      }

      function applyCollapseState(forceNotifyHole, syncResizeNow, suppressHoleNotify) {
        const effectiveCollapsed = Boolean(autoCollapsed || userCollapsed);
        const maxW = computeMaxExpandedWidth(narrowWidth);
        const effW = computeEffectiveWidth(narrowWidth);
        const collapsedChanged = effectiveCollapsed !== lastEffectiveCollapsed;
        const widthChanged = effW !== lastEffectiveWidth;
        lastEffectiveCollapsed = effectiveCollapsed;
        lastEffectiveWidth = effW;

        if (collapsedChanged || widthChanged) motionMgr.cancelGlideSession();
        if (!boundHost || !boundStrip) return;
        hasBrowserHole = detectBrowserHole(doc, boundHost, boundBody);

        runInternalMut(() => {
          for (const el of [boundHost, boundStrip]) {
            writeCssVarTracked(el, '--ag-vtabs-w', `${effW}px`);
            for (const [flag, attr] of [
              [effectiveCollapsed, 'data-ag-vtabs-collapsed'],
              [autoCollapsed, 'data-ag-vtabs-auto-collapsed'],
              [hasBrowserHole, 'data-ag-vtabs-hole'],
            ]) {
              if (flag) { setAttrIfChanged(el, attr, '1'); recordMark(prevMarked, el, attr); }
              else { if (ha(el, attr)) ra(el, attr); prevMarked.get(el)?.delete(attr); }
            }
          }
          sashMgr.syncToggleChrome(effectiveCollapsed, autoCollapsed);
          sashMgr.syncSashChrome(effW, maxW);
        });

        if (!suppressHoleNotify && (collapsedChanged || widthChanged || forceNotifyHole) && hasBrowserHole) {
          if (syncResizeNow) dispatchHoleResizeNow();
          else scheduleHoleResize();
        }
      }

      function applyWidth(width) {
        if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) return;
        narrowWidth = width;
        const nextAuto = width < NARROW_WIDTH_PX;
        const autoChanged = nextAuto !== autoCollapsed;
        autoCollapsed = nextAuto;
        if (autoCollapsed && sashMgr.isDragging()) sashMgr.finishDrag(false);
        const nextEffW = computeEffectiveWidth(width);
        if (autoChanged || Boolean(autoCollapsed || userCollapsed) !== lastEffectiveCollapsed || nextEffW !== lastEffectiveWidth) {
          applyCollapseState(false, false, false);
        }
      }

      function unbindPanel(forceSweep) {
        const hadBound = Boolean(boundHost || boundStrip || boundBody);
        const hadHole = Boolean(boundHost && (hasBrowserHole || detectBrowserHole(doc, boundHost, boundBody)));
        if (
          !forceSweep && !hadBound && !styleEl && !sashMgr.getToggleHeadEl() && !sashMgr.getSashEl() &&
          !sashMgr.hasDragState() && !motionMgr.hasTimersOrState() && !resizeMgr.hasActiveRo() &&
          !obsMgr.hasStripTextMo() && touchedNodes.size === 0 && titleStamped.size === 0 && !hostSubs.hasActiveSubscriptions()
        ) {
          hostSubs.teardownAll();
          hostSubs.invalidate();
          return;
        }
        sashMgr.finishDrag(false);
        resizeMgr.disconnectRo();
        obsMgr.disconnectStripTextObserver();
        hostSubs.teardownAll();
        hostSubs.invalidate();
        const prevUnbinding = unbinding;
        unbinding = true;
        try {
          runInternalMut(() => {
            motionMgr.clearAllCausticsAndReady();
            motionMgr.unmountGlideBar();
            sashMgr.unmountSash();
            sashMgr.unmountToggle();
            removeStyleTag();
            for (const el of touchedNodes) stripNodeVtabsAttrs(el, activeStyleMutSet);
            for (const el of titleStamped) stripNodeVtabsAttrs(el, activeStyleMutSet);
            prevMarked.clear();
            touchedNodes.clear();
            titleStamped.clear();
            if (doc && (forceSweep || hadBound)) {
              qa(doc, OWNED_NODE_SEL).forEach(removeEl);
              qa(doc, VTABS_SWEEP_SEL).forEach((el) => stripNodeVtabsAttrs(el, activeStyleMutSet));
            }
          });
        } finally { unbinding = prevUnbinding; }
        boundHost = boundStrip = boundStripSlot = boundBody = null;
        motionMgr.resetForUnbind();
        lastCascadeId = '';
        lastTabKeySet = new Set();
        lastTabElSet = new Set();
        tabCount = 0;
        autoCollapsed = false;
        narrowWidth = 0;
        hasBrowserHole = false;
        lastEffectiveCollapsed = false;
        lastEffectiveWidth = 0;
        if (hadHole) dispatchHoleResizeNow();
      }

      function deactivate(forceSweep) {
        obsMgr.clearPending();
        obsMgr.cancelSync();
        cancelScheduled(resizeSched);
        resizeMgr.cancelWinResize();
        obsMgr.disconnectObservers();
        obsMgr.bindStorageListener(false);
        obsMgr.bindVisibilityListener(false);
        resizeMgr.bindWinResizeListener(false);
        unbindPanel(forceSweep);
      }

      function scanAndSync() {
        if (destroyed) return getState();
        obsMgr.clearPending();
        if (!enabled || !doc || !resolveEnabled(undefined) || (explicitCssText === null && !resolveCssText())) {
          unbindPanel(false);
          return getState();
        }
        obsMgr.ensureObservers();
        const found = discoverSidePanel(doc);
        if (!found) { unbindPanel(false); return getState(); }

        const { host, strip, body, tabs, stripSlot, stripWraps, bodySlot } = found;
        const wasMounted = Boolean(boundHost && boundStrip && boundBody);
        const prevHasBrowserHole = hasBrowserHole;
        const hostChanged = host !== boundHost;
        const stripChanged = strip !== boundStrip;

        if (hostChanged || stripChanged) hostSubs.invalidate();
        if (stripChanged) { sashMgr.unmountToggle(); sashMgr.unmountSash(); motionMgr.unmountGlideBar(); }

        boundHost = host;
        boundStrip = strip;
        boundStripSlot = stripSlot || null;
        boundBody = body;
        tabCount = tabs.length;

        resizeMgr.attachRo(host);
        obsMgr.attachStripTextObserver(strip);

        hasBrowserHole = detectBrowserHole(doc, host, body);
        const effectiveCollapsed = Boolean(autoCollapsed || userCollapsed);
        const maxW = computeMaxExpandedWidth(narrowWidth);
        const effW = computeEffectiveWidth(narrowWidth);
        const collapsedChanged = effectiveCollapsed !== lastEffectiveCollapsed;
        const widthChanged = effW !== lastEffectiveWidth;
        lastEffectiveCollapsed = effectiveCollapsed;
        lastEffectiveWidth = effW;

        const motionTier = resolveMotionTier();
        const blurFrozen = isPerfBlurFreezeMode(doc);
        const isResizing = ga(doc?.documentElement, 'data-ag-cs-resizing') === '1';

        const { store: reduxStore, agentMgr } = hostSubs.getCachedHostContext(strip);
        const reduxCtx = resolveReadOnlyReduxContext(doc, win, strip, reduxStore);
        const { state: reduxState, cascadeId, reduxTabs } = reduxCtx;
        const stripActiveTabId = String(ga(strip, 'data-active-tab-id') || '').trim();
        const reduxActiveTabId = String(safe(() => reduxCtx?.pane?.activeTabId || reduxCtx?.pane?.selectedTabId) || '').trim();

        const tabInfos = [];
        const catTotals = Object.create(null);
        const claimedReduxTabs = new Set();
        const activeBtwSqIds = new Set();
        const runningBtwSqIds = new Set();
        const currentScopeKeys = new Set();
        const currentRunKeys = new Set();
        const currentTabEls = new Set();
        let nextActiveTab = null;
        let nextActiveCloseBtn = null;

        for (let i = 0; i < tabs.length; i++) {
          const tab = tabs[i];
          const closeBtn = detectCloseButton(tab);
          const visibleText = extractTextExcluding(tab, closeBtn);
          const tabId = getTabId(tab, closeBtn);
          const matchedRedux = matchReduxTab(tab, i, visibleText, tabs.length, reduxTabs, claimedReduxTabs, tabId, closeBtn);
          const cat = classifyFromReduxTab(matchedRedux) || classifyFromDom(tab, closeBtn, visibleText, tabId);
          catTotals[cat] = (catTotals[cat] || 0) + 1;
          const sqCascadeId = cat === 'btw' ? extractSideQuestionCascadeId(matchedRedux, tabId) : '';
          if (sqCascadeId) activeBtwSqIds.add(sqCascadeId);
          const stableId = String(tabId || safe(() => matchedRedux?.id || matchedRedux?.tabId) || '').trim();
          const runKey = stableId || tab;
          const active = isTabActive(tab, stripActiveTabId, reduxActiveTabId, tabId, closeBtn);
          if (active && !nextActiveTab) { nextActiveTab = tab; nextActiveCloseBtn = closeBtn; }
          currentScopeKeys.add(stableId || `${cat}:${visibleText}:${i}`);
          currentRunKeys.add(runKey);
          currentTabEls.add(tab);
          tabInfos.push({ tab, closeBtn, visibleText, matchedRedux, cat, sqCascadeId, stableId, runKey, active });
        }

        let scopeChanged = !wasMounted || hostChanged || stripChanged || Boolean(cascadeId && lastCascadeId && cascadeId !== lastCascadeId);
        if (!scopeChanged && lastTabKeySet.size > 0 && currentScopeKeys.size > 0) {
          let keyOverlap = false;
          for (const k of currentScopeKeys) if (lastTabKeySet.has(k)) { keyOverlap = true; break; }
          let elOverlap = false;
          for (const el of currentTabEls) if (lastTabElSet.has(el)) { elOverlap = true; break; }
          if (!keyOverlap && !elOverlap) scopeChanged = true;
        }

        const tabParent = findTabListContainer(strip, tabs);
        const isFlat = tabParent === strip;
        const glideContainer = isFlat ? strip : tabParent;
        const glideSession = motionMgr.getGlideSession();

        if (scopeChanged) {
          motionMgr.resetForScopeChange();
        } else if (
          glideSession &&
          ((motionTier !== 'ultra' && motionTier !== 'standard') || blurFrozen || isResizing || sashMgr.isDragging() || doc?.hidden === true || collapsedChanged || widthChanged || glideSession.container !== glideContainer)
        ) {
          motionMgr.cancelGlideSession();
        }
        lastCascadeId = cascadeId;
        lastTabKeySet = currentScopeKeys;
        lastTabElSet = currentTabEls;

        const nextMarked = new Map();
        const stamp = (el, attr, val = '1') => { if (!el) return; setAttrIfChanged(el, attr, val); recordMark(nextMarked, el, attr); };
        const prevActiveBeforeSync = motionMgr.getPrevActiveTab();
        const needTopInset = hasHostTopRightCluster(host, doc);

        runInternalMut(() => {
          ensureStyleInjected();
          stamp(host, 'data-ag-vtabs-host');
          stamp(strip, 'data-ag-vtabs-strip');
          stamp(body, 'data-ag-vtabs-body');
          writeCssVarTracked(host, '--ag-vtabs-w', `${effW}px`);
          writeCssVarTracked(strip, '--ag-vtabs-w', `${effW}px`);

          if (needTopInset) { stamp(strip, 'data-ag-vtabs-top-inset'); writeCssVarTracked(strip, '--ag-vtabs-top-inset', TOP_INSET_CSS_VALUE); }
          else clearCssVarTracked(strip, '--ag-vtabs-top-inset');

          if (stripSlot && stripSlot !== strip) stamp(stripSlot, 'data-ag-vtabs-strip-slot');
          if (Array.isArray(stripWraps)) for (let i = 0; i < stripWraps.length; i++) stamp(stripWraps[i], 'data-ag-vtabs-strip-wrap');
          if (bodySlot && bodySlot !== body) stamp(bodySlot, 'data-ag-vtabs-body-slot');

          if (effectiveCollapsed) { stamp(host, 'data-ag-vtabs-collapsed'); stamp(strip, 'data-ag-vtabs-collapsed'); }
          if (autoCollapsed) { stamp(host, 'data-ag-vtabs-auto-collapsed'); stamp(strip, 'data-ag-vtabs-auto-collapsed'); }
          if (hasBrowserHole) { stamp(host, 'data-ag-vtabs-hole'); stamp(strip, 'data-ag-vtabs-hole'); }
          if (sashMgr.isDragging()) { stamp(host, 'data-ag-vtabs-dragging'); stamp(strip, 'data-ag-vtabs-dragging'); }
          const curGlide = motionMgr.getGlideSession();
          if (curGlide && curGlide.container === glideContainer) stamp(glideContainer, 'data-ag-vtabs-gliding');

          stampStripTopology(strip, tabs, tabParent, isFlat, stamp);

          const nextTitleNodes = new Set();
          const catSeen = Object.create(null);
          for (let i = 0; i < tabInfos.length; i++) {
            const info = tabInfos[i];
            const { tab, closeBtn, visibleText, cat, sqCascadeId, active } = info;
            stamp(tab, 'data-ag-vtabs-tab');
            if (active) stamp(tab, 'data-ag-vtabs-active');
            if (closeBtn) stamp(closeBtn, 'data-ag-vtabs-close');
            if (!hasNonCloseIcon(tab, closeBtn)) stamp(tab, 'data-ag-vtabs-no-icon');

            const { labelEl, metaEls, iconWrappers } = inspectTabElements(tab, closeBtn);
            if (labelEl) stamp(labelEl, 'data-ag-vtabs-label');
            for (let j = 0; j < metaEls.length; j++) stamp(metaEls[j], 'data-ag-vtabs-meta');
            for (let j = 0; j < iconWrappers.length; j++) stamp(iconWrappers[j], 'data-ag-vtabs-icon');

            const ord = (catSeen[cat] || 0) + 1;
            catSeen[cat] = ord;
            stamp(tab, 'data-ag-vtabs-cat', cat);
            stamp(tab, 'data-ag-vtabs-tone', String((ord - 1) % 4));
            if (catTotals[cat] >= 2) { stamp(tab, 'data-ag-vtabs-ord', String(ord)); upsertOrdChip(doc, tab, ord); }
            else removeOrdChips(tab);

            const curTitle = ga(tab, 'title');
            const prismOwnedTitle = ga(tab, 'data-ag-vtabs-title') === '1';
            if (prismOwnedTitle || curTitle === null || curTitle === '') {
              if (visibleText) {
                if (curTitle !== visibleText) { sa(tab, 'title', visibleText); activeTitleMutSet?.add(tab); }
                stamp(tab, 'data-ag-vtabs-title');
                titleStamped.add(tab);
                nextTitleNodes.add(tab);
              } else if (prismOwnedTitle) {
                ra(tab, 'title'); activeTitleMutSet?.add(tab); ra(tab, 'data-ag-vtabs-title'); titleStamped.delete(tab);
              }
            }

            motionMgr.processTabBtwState(info, { reduxState, body, agentMgr, subProv: hostSubs.getBtwSubProvider(sqCascadeId), motionTier, blurFrozen, runningBtwSqIds });
            if (motionMgr.isTabCaustic(tab)) stamp(tab, 'data-ag-vtabs-caustic');
            if (motionMgr.isTabReady(tab) && !active) stamp(tab, 'data-ag-vtabs-ready');
          }

          motionMgr.pruneStaleTabState(currentRunKeys, currentTabEls);

          for (const [el, oldAttrs] of prevMarked.entries()) {
            const curAttrs = nextMarked.get(el);
            for (const attr of oldAttrs) {
              if (!curAttrs || !curAttrs.has(attr)) {
                if (attr === 'data-ag-vtabs-title' && ga(el, 'data-ag-vtabs-title') === '1') {
                  ra(el, 'title'); activeTitleMutSet?.add(el); ra(el, 'data-ag-vtabs-title'); titleStamped.delete(el);
                } else if (ha(el, attr)) ra(el, attr);
              }
            }
            if (!curAttrs) {
              removeOrdChips(el);
              if (oldAttrs.has('data-ag-vtabs-host') || oldAttrs.has('data-ag-vtabs-strip') || oldAttrs.has('data-ag-vtabs-top-inset')) {
                clearCssVarTracked(el, '--ag-vtabs-w');
                clearCssVarTracked(el, '--ag-vtabs-top-inset');
              }
              touchedNodes.delete(el);
            }
          }
          for (const el of Array.from(titleStamped)) {
            if (!nextTitleNodes.has(el)) {
              if (ga(el, 'data-ag-vtabs-title') === '1') { ra(el, 'title'); activeTitleMutSet?.add(el); ra(el, 'data-ag-vtabs-title'); }
              titleStamped.delete(el);
            }
          }
          prevMarked = nextMarked;

          sashMgr.ensureToggleMounted(strip, effectiveCollapsed);
          sashMgr.ensureSashMounted(strip, isFlat, stripSlot);
          motionMgr.ensureGlideBarMounted(glideContainer);
          sashMgr.syncToggleChrome(effectiveCollapsed, autoCollapsed);
          sashMgr.syncSashChrome(effW, maxW);
        });

        hostSubs.syncBtwLiveSubscriptions(agentMgr, reduxStore, reduxState, activeBtwSqIds, runningBtwSqIds);

        if (!scopeChanged && prevActiveBeforeSync && nextActiveTab && prevActiveBeforeSync !== nextActiveTab) {
          motionMgr.triggerActiveTabMotion(prevActiveBeforeSync, nextActiveTab, tabs, glideContainer, nextActiveCloseBtn, motionTier, blurFrozen, isResizing, effectiveCollapsed);
        }
        motionMgr.setPrevActiveTab(nextActiveTab);

        if (hasBrowserHole && (!wasMounted || hostChanged || stripChanged || collapsedChanged || widthChanged || !prevHasBrowserHole)) {
          scheduleHoleResize();
        }
        return getState();
      }

      function getState() {
        const toggleHeadEl = sashMgr.getToggleHeadEl();
        const mounted = Boolean(!destroyed && boundHost && boundStrip && boundBody && toggleHeadEl && toggleHeadEl.isConnected !== false);
        const active = Boolean(enabled && !destroyed && boundHost && boundStrip && boundBody);
        return {
          active, mounted,
          collapsed: active ? Boolean(autoCollapsed || userCollapsed) : false,
          userCollapsed: Boolean(userCollapsed),
          autoCollapsed: active ? Boolean(autoCollapsed) : false,
          narrowWidth: active ? narrowWidth : 0,
          expandedWidth: userExpandedWidth,
          effectiveWidth: active ? computeEffectiveWidth(narrowWidth) : 0,
          dragging: Boolean(active && sashMgr.isDragging()),
          tabCount: active ? tabCount : 0,
          hasBrowserHole: active ? Boolean(hasBrowserHole) : false,
          lang: resolveLang(),
        };
      }

      function setCollapsed(nextVal) {
        if (destroyed || autoCollapsed) return getState();
        userCollapsed = Boolean(nextVal);
        writeStoredCollapsed(userCollapsed);
        applyCollapseState(false, false, false);
        return getState();
      }

      function toggleCollapsed() {
        return destroyed || autoCollapsed ? getState() : setCollapsed(!userCollapsed);
      }

      function setExpandedWidth(px) {
        if (destroyed) return getState();
        const n = Number(px);
        if (!Number.isFinite(n)) return getState();
        const clamped = Math.round(clampNum(n, MIN_EXPANDED_WIDTH_PX, MAX_EXPANDED_WIDTH_PX));
        userExpandedWidth = clamped;
        writeStoredWidth(clamped);
        if (boundHost && boundStrip) applyCollapseState(false, false, false);
        return getState();
      }

      function sync(cfg) {
        if (destroyed) return getState();
        enabled = resolveEnabled(cfg);
        if (!enabled) { deactivate(false); return getState(); }
        if (safe(() => isFn(storage?.getItem))) { userCollapsed = readStoredCollapsed(); userExpandedWidth = readStoredWidth(); }
        obsMgr.bindStorageListener(true);
        obsMgr.bindVisibilityListener(true);
        resizeMgr.bindWinResizeListener(true);
        obsMgr.ensureObservers();
        return scanAndSync();
      }

      function refresh() {
        if (destroyed) return getState();
        enabled = resolveEnabled(undefined);
        if (!enabled) { deactivate(false); return getState(); }
        return scanAndSync();
      }

      function destroy() {
        if (destroyed) return;
        destroyed = true;
        enabled = false;
        deactivate(true);
        lastCfg = null;
      }

      return { sync, setCollapsed, toggleCollapsed, setExpandedWidth, refresh, destroy, getState };
    }

    let singletonCtl = null;

    function resolveSingletonLang() {
      const win = typeof window !== 'undefined' ? window : G;
      const doc = win?.document || (typeof document !== 'undefined' ? document : null);
      return normalizeLang(ga(doc?.documentElement, 'data-ag-cs-lang')) || normalizeLang(doc?.documentElement?.lang) || normalizeLang(win?.navigator?.language || G.navigator?.language) || 'en';
    }

    function singletonDestroy() {
      if (singletonCtl) { safe(() => singletonCtl.destroy()); singletonCtl = null; }
      else cleanupOrphanDom((typeof window !== 'undefined' ? window?.document : null) || G.document || null);
    }

    function singletonGetState() {
      if (singletonCtl) return singletonCtl.getState();
      return {
        active: false, mounted: false, collapsed: false, userCollapsed: false, autoCollapsed: false,
        narrowWidth: 0, expandedWidth: EXPANDED_WIDTH_PX, effectiveWidth: 0, dragging: false,
        tabCount: 0, hasBrowserHole: false, lang: resolveSingletonLang(),
      };
    }

    function singletonSync(cfg) {
      const win = typeof window !== 'undefined' ? window : G;
      const doc = win?.document || (typeof document !== 'undefined' ? document : null);
      const htmlAttr = ga(doc?.documentElement, 'data-ag-cs-side-panel-vertical-tabs');
      let effCfg = cfg !== undefined ? cfg : safe(() => (win || G).__agPrism?.getState?.()?.cfg) || null;
      const hasCfgKey = Boolean(effCfg && typeof effCfg === 'object' && 'sidePanelVerticalTabs' in effCfg);
      const shouldRun = htmlAttr !== 'off' && (hasCfgKey ? isOnFlag(effCfg.sidePanelVerticalTabs) : cfg === undefined && htmlAttr === 'on');
      if (!shouldRun) { singletonDestroy(); return singletonGetState(); }
      if (!singletonCtl) singletonCtl = createSidePanelVerticalTabsController({ win, doc });
      return singletonCtl.sync(effCfg || { sidePanelVerticalTabs: 'on' });
    }

    safe(() => G.__agPrismSidePanelVtabs?.destroy?.());
    if (G.window && G.window !== G) safe(() => G.window.__agPrismSidePanelVtabs?.destroy?.());

    const api = {
      STORAGE_COLLAPSED_KEY, STORAGE_WIDTH_KEY, STYLE_ID, NARROW_WIDTH_PX, EXPANDED_WIDTH_PX,
      COLLAPSED_WIDTH_PX, MIN_EXPANDED_WIDTH_PX, MAX_EXPANDED_WIDTH_PX, SNAP_COLLAPSE_WIDTH_PX,
      ALL_MARK_ATTRS, VTABS_I18N, normalizeLang,
      createSidePanelVerticalTabsController, sync: singletonSync, destroy: singletonDestroy, getState: singletonGetState,
    };

    G.__agPrismSidePanelVtabs = api;
    if (G.window && G.window !== G) G.window.__agPrismSidePanelVtabs = api;
    return api;
  }

  if (typeof __vtabsInit === 'function') {
    __vtabsInit(initController);
  } else if (typeof module === 'object' && module && module.exports) {
    const ns = {};
    require('./vtabs-constants.js')(ns);
    require('./vtabs-dom.js')(ns);
    require('./vtabs-fiber.js')(ns);
    require('./vtabs-sash.js')(ns);
    require('./vtabs-motion.js')(ns);
    module.exports = initController(ns);
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
